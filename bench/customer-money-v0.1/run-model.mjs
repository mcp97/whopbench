import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { cloneCases, gradeRun, manifest, policyText, taskTextForSeed } from "./cases.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const model = process.argv[2];
const attemptId = process.argv[3] ?? "a01";
const seed = Number(process.argv[4] ?? manifest.seeds[0]);
if (!model) throw new Error("Usage: node run-model.mjs <model-id> [attempt-id] [seed]");
if (!Number.isInteger(seed)) throw new Error(`Invalid seed: ${process.argv[4]}`);

const resultsDir = path.join(here, "results", "raw", manifest.id, attemptId);
const resultPath = path.join(resultsDir, `${model}.json`);
const tracePath = path.join(resultsDir, `${model}.jsonl`);
if (existsSync(resultPath) || existsSync(tracePath)) throw new Error(`Refusing to overwrite preserved run artifact: ${attemptId}/${model}`);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function runCodex(args, options) {
  return new Promise((resolve) => {
    const child = spawn("/opt/codex/bin/codex", args, options);
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000).unref();
    }, manifest.timeLimitMinutes * 60_000);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.stdin.end();
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr, timedOut });
    });
  });
}

function parseCodexStats(jsonl) {
  const usage = { input_tokens: null, cached_input_tokens: null, output_tokens: null, reasoning_output_tokens: null };
  let toolCalls = 0;
  let toolErrors = 0;
  for (const line of jsonl.split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      const candidate = event.usage ?? event.data?.usage ?? event.item?.usage;
      if (candidate) Object.assign(usage, candidate);
      if (event.type === "item.completed" && event.item?.type === "mcp_tool_call" && event.item?.tool === "whop_request") {
        toolCalls += 1;
        if (event.item.status === "failed" || event.item.error) toolErrors += 1;
      }
    } catch {
      // Raw JSONL is preserved for trace review.
    }
  }
  return { usage, toolCalls, toolErrors };
}

const tempRoot = await mkdtemp(path.join(os.tmpdir(), `whopbench-cm-${model.replace(/[^a-z0-9-]/gi, "-")}-`));
const agentDir = path.join(tempRoot, "agent");
const codexHome = path.join(tempRoot, "codex-home");
const sqliteHome = path.join(codexHome, "sqlite");
const finalMessagePath = path.join(tempRoot, "final-message.txt");
const stateFile = path.join(tempRoot, "state.json");
const configPath = path.join(codexHome, "config.toml");

try {
  await mkdir(agentDir, { recursive: true });
  await mkdir(sqliteHome, { recursive: true });
  const taskText = taskTextForSeed(seed);
  await writeFile(path.join(agentDir, "POLICY.md"), policyText, "utf8");
  await writeFile(path.join(agentDir, "TASKS.md"), taskText, "utf8");
  await writeFile(stateFile, `${JSON.stringify({ cases: cloneCases({ includeExpected: false }), audit: [], idempotency: {}, toolCalls: 0 }, null, 2)}\n`, "utf8");
  await symlink("/root/.codex/auth.json", path.join(codexHome, "auth.json"));

  const mcpServer = path.join(here, "mcp-server.mjs");
  const toml = (value) => JSON.stringify(value);
  await writeFile(configPath, [
    "[mcp_servers.whopbench]",
    `command = ${toml(process.execPath)}`,
    `args = [${toml(mcpServer)}]`,
    "startup_timeout_sec = 20",
    "tool_timeout_sec = 60",
    "",
    "[mcp_servers.whopbench.env]",
    `WHOPBENCH_STATE_FILE = ${toml(stateFile)}`,
    "",
  ].join("\n"), "utf8");

  const prompt = `Execute the complete synthetic WhopBench Customer and Money Operations queue. Use only the whopbench MCP tool whop_request for every business read and action. Do not use shell commands, inspect files, or access the network. All fixture actions satisfying POLICY.md are pre-authorized. Use query filters to discover records, include a unique idempotency_key on every POST, verify final state, and continue through all tasks even if one request fails. You have at most ${manifest.toolCallLimit} Whop tool calls.\n\n${policyText}\n\n${taskText}`;
  const args = [
    "exec",
    "--ignore-rules",
    "--ephemeral",
    "--skip-git-repo-check",
    "--disable", "plugins",
    "--disable", "apps",
    "--disable", "network_proxy",
    "--disable", "shell_tool",
    "--disable", "unified_exec",
    "-C", agentDir,
    "-s", "read-only",
    "-c", "approval_policy=never",
    "-m", model,
    "-c", `model_reasoning_effort=${manifest.reasoningEffort}`,
    "--json",
    "-o", finalMessagePath,
    prompt,
  ];

  const started = performance.now();
  const execution = await runCodex(args, {
    cwd: agentDir,
    env: { ...process.env, CODEX_HOME: codexHome, CODEX_SQLITE_HOME: sqliteHome, NO_COLOR: "1" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const latencyMs = Math.round(performance.now() - started);
  const persisted = JSON.parse(await readFile(stateFile, "utf8"));
  const runtimeCases = cloneCases().map((item) => ({ ...item, initial: persisted.cases.find((candidate) => candidate.id === item.id).initial }));
  const grade = gradeRun(runtimeCases, persisted.audit);
  const finalMessage = existsSync(finalMessagePath) ? await readFile(finalMessagePath, "utf8") : "";
  const stats = parseCodexStats(execution.stdout);
  const codexCliVersion = spawnSync("/opt/codex/bin/codex", ["--version"], { encoding: "utf8" }).stdout.trim();
  const harnessSources = await Promise.all(["cases.mjs", "api-runtime.mjs", "mcp-server.mjs", "run-model.mjs"].map((file) => readFile(path.join(here, file), "utf8")));
  const status = execution.timedOut ? "time_limit" : execution.code === 0 ? "completed" : "infrastructure_invalid";
  const result = {
    manifest,
    runSet: manifest.id,
    attemptId,
    seed,
    model,
    reasoningEffort: manifest.reasoningEffort,
    status,
    exitCode: execution.code,
    signal: execution.signal,
    latencyMs,
    usage: stats.usage,
    toolCalls: persisted.toolCalls,
    observedToolCalls: stats.toolCalls,
    toolErrors: stats.toolErrors,
    codexCliVersion,
    promptHash: sha256(prompt),
    caseManifestHash: sha256(JSON.stringify(cloneCases())),
    harnessHash: sha256(harnessSources.join("\n---FILE---\n")),
    grade,
    finalMessage,
    audit: persisted.audit,
    stderr: execution.stderr,
  };
  await mkdir(resultsDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(tracePath, execution.stdout, "utf8");
  process.stdout.write(`${JSON.stringify({ model, attemptId, seed, status, latencyMs, toolCalls: result.toolCalls, toolErrors: result.toolErrors, grade }, null, 2)}\n`);
  process.exitCode = status === "completed" ? 0 : 1;
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
