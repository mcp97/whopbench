import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cases, manifest } from "./cases.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const models = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function range(values) {
  return { min: Math.min(...values), max: Math.max(...values) };
}

function clusteredInterval(runs) {
  const samples = [];
  const width = runs.length;
  const totalCombinations = width ** width;
  for (let encoded = 0; encoded < totalCombinations; encoded += 1) {
    let cursor = encoded;
    let passed = 0;
    let total = 0;
    for (let draw = 0; draw < width; draw += 1) {
      const selected = runs[cursor % width];
      cursor = Math.floor(cursor / width);
      passed += selected.casesPassed;
      total += selected.casesTotal;
    }
    samples.push(passed / total);
  }
  samples.sort((a, b) => a - b);
  return {
    low: samples[Math.floor(0.025 * (samples.length - 1))],
    high: samples[Math.ceil(0.975 * (samples.length - 1))],
    method: "exact run-cluster bootstrap over five attempts",
  };
}

function summarizeRun(result) {
  const unsuccessfulOperations = result.audit.filter((event) => event.status >= 400);
  const attemptedMutations = result.audit.filter((event) => ["POST", "PUT", "PATCH", "DELETE"].includes(event.method) && !event.replayed);
  const successfulMutations = attemptedMutations.filter((event) => event.status >= 200 && event.status < 300);
  return {
    attemptId: result.attemptId,
    seed: result.seed,
    status: result.status,
    latencyMs: result.latencyMs,
    usage: result.usage,
    cliCalls: result.cliCalls,
    cliErrors: result.cliErrors,
    casesPassed: result.grade.casesPassed,
    casesTotal: result.grade.casesTotal,
    passRate: result.grade.passRate,
    criticalViolations: result.grade.criticalViolations + (result.grade.globalCriticalViolations ?? 0),
    globalCriticalViolations: result.grade.globalCriticalViolations ?? 0,
    orphanMutations: result.grade.orphanMutations ?? [],
    safetyEligible: result.grade.safetyEligible,
    apiOperations: result.audit.length,
    unsuccessfulOperations: unsuccessfulOperations.length,
    attemptedMutations: attemptedMutations.length,
    successfulMutations: successfulMutations.length,
    measuredAt: result.audit.at(-1)?.timestamp ?? null,
    hashes: {
      prompt: result.promptHash,
      cases: result.caseManifestHash,
      harness: result.harnessHash,
    },
    perCase: result.grade.perCase,
  };
}

const rawByModel = new Map();
const allRuns = [];
for (const model of models) {
  const runs = [];
  for (let index = 0; index < manifest.attemptCount; index += 1) {
    const attemptId = `a${String(index + 1).padStart(2, "0")}`;
    const rawPath = path.join(here, "results", "raw", manifest.id, attemptId, `${model}.json`);
    const result = JSON.parse(await readFile(rawPath, "utf8"));
    if (result.runSet !== manifest.id || result.manifest?.id !== manifest.id) throw new Error(`${model}/${attemptId} run-set mismatch`);
    if (result.attemptId !== attemptId || result.model !== model) throw new Error(`${model}/${attemptId} identity mismatch`);
    if (result.seed !== manifest.seeds[index]) throw new Error(`${model}/${attemptId} seed mismatch`);
    if (result.status !== "completed" || result.exitCode !== 0) throw new Error(`${model}/${attemptId} is not a completed run`);
    if (result.manifest?.whopCliVersion !== manifest.whopCliVersion || result.manifest?.whopCliIntegrity !== manifest.whopCliIntegrity) {
      throw new Error(`${model}/${attemptId} Whop CLI mismatch`);
    }
    allRuns.push(result);
    runs.push(summarizeRun(result));
  }
  rawByModel.set(model, runs);
}

const singleton = (values, label) => {
  const unique = new Set(values);
  if (unique.size !== 1) throw new Error(`${label} mismatch across the frozen run set`);
  return [...unique][0];
};
singleton(allRuns.map((result) => result.caseManifestHash), "case-manifest hash");
singleton(allRuns.map((result) => result.harnessHash), "harness hash");
singleton(allRuns.map((result) => result.codexCliVersion), "Codex CLI version");
for (let index = 0; index < manifest.attemptCount; index += 1) {
  const attemptId = `a${String(index + 1).padStart(2, "0")}`;
  singleton(allRuns.filter((result) => result.attemptId === attemptId).map((result) => result.promptHash), `${attemptId} prompt hash`);
}

// An order-independent Arena-like match rating. Every model pair receives a
// win/loss/tie on the same case-attempt. A 50% matched score maps to 1000;
// a perfect matched score maps to 1200. This is not human-preference Elo.
const pairwise = Object.fromEntries(models.map((model) => [model, { wins: 0, losses: 0, ties: 0, total: 0, points: 0 }]));
for (let attemptIndex = 0; attemptIndex < manifest.attemptCount; attemptIndex += 1) {
  for (const testCase of cases) {
    for (let leftIndex = 0; leftIndex < models.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < models.length; rightIndex += 1) {
        const leftModel = models[leftIndex];
        const rightModel = models[rightIndex];
        const left = rawByModel.get(leftModel)[attemptIndex].perCase.find((item) => item.id === testCase.id);
        const right = rawByModel.get(rightModel)[attemptIndex].perCase.find((item) => item.id === testCase.id);
        const scoreLeft = left.pass === right.pass ? 0.5 : left.pass ? 1 : 0;
        pairwise[leftModel].total += 1;
        pairwise[rightModel].total += 1;
        pairwise[leftModel].points += scoreLeft;
        pairwise[rightModel].points += 1 - scoreLeft;
        if (scoreLeft === 0.5) {
          pairwise[leftModel].ties += 1;
          pairwise[rightModel].ties += 1;
        } else if (scoreLeft === 1) {
          pairwise[leftModel].wins += 1;
          pairwise[rightModel].losses += 1;
        } else {
          pairwise[leftModel].losses += 1;
          pairwise[rightModel].wins += 1;
        }
      }
    }
  }
}

const aggregatedModels = models.map((model) => {
  const runs = rawByModel.get(model);
  const casesPassed = runs.reduce((sum, run) => sum + run.casesPassed, 0);
  const casesTotal = runs.reduce((sum, run) => sum + run.casesTotal, 0);
  const safetyQualifiedRuns = runs.filter((run) => run.safetyEligible).length;
  const criticalViolations = runs.reduce((sum, run) => sum + run.criticalViolations, 0);
  const notableFailures = runs.flatMap((run) => run.perCase
    .filter((item) => !item.pass)
    .map((item) => ({ attemptId: run.attemptId, seed: run.seed, ...item })))
    .concat(runs.filter((run) => run.globalCriticalViolations > 0).map((run) => ({
      attemptId: run.attemptId,
      seed: run.seed,
      id: "global-orphan-mutation",
      title: "Mutation outside the case allowlist",
      pass: false,
      criticalViolations: run.orphanMutations,
    })));
  const perCase = cases.map((testCase) => {
    const attempts = runs.map((run) => ({
      attemptId: run.attemptId,
      seed: run.seed,
      ...run.perCase.find((item) => item.id === testCase.id),
    }));
    const passed = attempts.filter((item) => item.pass).length;
    return {
      id: testCase.id,
      pair: testCase.pair,
      title: testCase.title,
      attempts: attempts.length,
      passed,
      passRate: passed / attempts.length,
      criticalViolations: attempts.reduce((sum, item) => sum + item.criticalViolations.length, 0),
      attemptsDetail: attempts,
    };
  });
  let pairsPassed = 0;
  for (const run of runs) {
    for (const pair of new Set(cases.map((item) => item.pair))) {
      const pairCaseIds = cases.filter((item) => item.pair === pair).map((item) => item.id);
      if (pairCaseIds.every((id) => run.perCase.find((item) => item.id === id)?.pass)) pairsPassed += 1;
    }
  }
  const interval = clusteredInterval(runs);
  const latencyValues = runs.map((run) => run.latencyMs);
  const cliCalls = runs.reduce((sum, run) => sum + run.cliCalls, 0);
  const cliErrors = runs.reduce((sum, run) => sum + run.cliErrors, 0);
  const outputTokens = runs.map((run) => run.usage.output_tokens ?? 0);
  return {
    model,
    status: runs.every((run) => run.status === "completed") ? "completed" : "partial",
    wbRating: Math.round(1000 + 400 * ((pairwise[model].points / pairwise[model].total) - 0.5)),
    ratingMethod: "order-independent matched-case score; correctness only; 1000 = 50% matched score",
    pairwise: { ...pairwise[model], score: pairwise[model].points / pairwise[model].total },
    runsTotal: runs.length,
    safetyQualifiedRuns,
    safetyEligible: safetyQualifiedRuns === runs.length,
    casesPassed,
    casesTotal,
    passRate: casesPassed / casesTotal,
    clustered95: interval,
    pairConsistency: { passed: pairsPassed, total: runs.length * new Set(cases.map((item) => item.pair)).size },
    criticalViolations,
    latencyMs: median(latencyValues),
    latencyRangeMs: range(latencyValues),
    cliCalls,
    cliErrors,
    cliSuccessRate: cliCalls === 0 ? 0 : (cliCalls - cliErrors) / cliCalls,
    apiOperations: runs.reduce((sum, run) => sum + run.apiOperations, 0),
    unsuccessfulOperations: runs.reduce((sum, run) => sum + run.unsuccessfulOperations, 0),
    attemptedMutations: runs.reduce((sum, run) => sum + run.attemptedMutations, 0),
    successfulMutations: runs.reduce((sum, run) => sum + run.successfulMutations, 0),
    usage: {
      median_output_tokens: median(outputTokens),
      output_tokens: outputTokens.reduce((sum, value) => sum + value, 0),
    },
    notableFailures,
    perCase,
    runs,
  };
});

const output = {
  manifest,
  evidenceLabel: `Measured with ChatGPT-authenticated Codex Exec; ${manifest.attemptCount} precommitted attempts per model; no API dollar cost is available.`,
  ratingNote: "WB Rating is an Arena-like, order-independent matched-case score across identical case-attempts. It is not Design Arena's human-preference Elo and remains a release-preview statistic.",
  models: aggregatedModels,
  cases: cases.map((item) => {
    const publicCase = {
      ...item,
      expectedAction: item.expected.action ? `${item.expected.action.method} ${item.expected.action.path}` : "NO MUTATION",
    };
    delete publicCase.initial;
    delete publicCase.expected;
    return publicCase;
  }),
};

const resultsDir = path.join(here, "results");
await mkdir(resultsDir, { recursive: true });
await writeFile(path.join(resultsDir, "summary.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
