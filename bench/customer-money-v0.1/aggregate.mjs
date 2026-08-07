import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cases, manifest } from "./cases.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const models = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const summaries = [];
const allRuns = [];
for (const model of models) {
  const runs = [];
  for (let index = 0; index < manifest.attemptCount; index += 1) {
    const attemptId = `a${String(index + 1).padStart(2, "0")}`;
    const file = path.join(here, "results", "raw", manifest.id, attemptId, `${model}.json`);
    const result = JSON.parse(await readFile(file, "utf8"));
    if (result.status !== "completed") throw new Error(`Invalid result ${model}/${attemptId}: ${result.status}`);
    if (result.reasoningEffort !== manifest.reasoningEffort) throw new Error(`Reasoning mismatch ${model}/${attemptId}`);
    runs.push(result);
    allRuns.push({ model, attemptId, seed: result.seed, passed: result.grade.casesPassed, total: result.grade.casesTotal, safetyEligible: result.grade.safetyEligible, toolCalls: result.toolCalls, toolErrors: result.toolErrors, latencyMs: result.latencyMs, perCase: result.grade.perCase.map((item) => ({ id: item.id, pass: item.pass, violations: item.violations })) });
  }
  const passed = runs.reduce((sum, run) => sum + run.grade.casesPassed, 0);
  const total = runs.reduce((sum, run) => sum + run.grade.casesTotal, 0);
  const workflows = Object.fromEntries(cases.map((item) => {
    const observations = runs.map((run) => run.grade.perCase.find((candidate) => candidate.id === item.id));
    return [item.id, { passed: observations.filter((value) => value.pass).length, total: observations.length }];
  }));
  summaries.push({
    model,
    passed,
    total,
    passRate: passed / total,
    safetyQualifiedAttempts: runs.filter((run) => run.grade.safetyEligible).length,
    attempts: runs.length,
    medianToolCalls: median(runs.map((run) => run.toolCalls)),
    toolCallRange: { min: Math.min(...runs.map((run) => run.toolCalls)), max: Math.max(...runs.map((run) => run.toolCalls)) },
    medianLatencyMs: median(runs.map((run) => run.latencyMs)),
    workflows,
  });
}

const summary = {
  benchmark: manifest.id,
  completedAt: new Date().toISOString(),
  executionMode: "controlled-interactive-api-calibration",
  reasoningEffort: manifest.reasoningEffort,
  toolCallLimit: manifest.toolCallLimit,
  timeLimitMinutes: manifest.timeLimitMinutes,
  referenceToolCalls: 38,
  attemptsPerModel: manifest.attemptCount,
  workflowsPerAttempt: cases.length,
  completedRuns: allRuns.length,
  gradedOutcomes: allRuns.reduce((sum, run) => sum + run.total, 0),
  cases: cases.map((item) => ({ id: item.id, family: item.family, title: item.title, economicMechanism: item.economicMechanism, valueAtRisk: item.valueAtRisk })),
  models: summaries,
  runs: allRuns,
};

const output = path.join(here, "results", "summary.json");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
