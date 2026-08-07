import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { manifest } from "./cases.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const models = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"];

function run(model, attemptId, seed) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(here, "run-model.mjs"), model, attemptId, String(seed)], {
      cwd: new URL("../../..", import.meta.url),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("close", (code, signal) => resolve({ model, attemptId, seed, code, signal, stdout, stderr }));
  });
}

const failures = [];
for (let index = 0; index < manifest.attemptCount; index += 1) {
  const attemptId = `a${String(index + 1).padStart(2, "0")}`;
  const seed = manifest.seeds[index];
  process.stdout.write(`Starting ${attemptId} (seed ${seed}) across ${models.join(", ")}\n`);
  const wave = await Promise.all(models.map((model) => run(model, attemptId, seed)));
  for (const result of wave) {
    process.stdout.write(`${result.model} ${result.attemptId}: exit ${result.code ?? "null"}\n`);
    if (result.code !== 0) {
      failures.push(result);
      process.stderr.write(result.stderr || result.stdout);
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.length} invalid cell(s); preserve artifacts and rerun only those cells.\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Completed ${manifest.attemptCount * models.length} controlled runs.\n`);
}
