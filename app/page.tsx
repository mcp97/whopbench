"use client";

import type { CSSProperties } from "react";
import {
  ArrowUpRight,
  ChartBar,
  Circle,
  Flask,
  Scales,
  SquaresFour,
  TerminalWindow,
} from "@phosphor-icons/react";
import configurationSummary from "../bench/calibration-v2/summary.json";
import customerMoneySummary from "../bench/customer-money-v0.1/results/summary.json";
import completionSummary from "../bench/level2-completion-v0.1/results/summary.json";
import level3Summary from "../bench/level3-growth-retention-v0.1/results/summary.json";

const modelLabel: Record<string, string> = {
  "gpt-5.6-sol": "Sol",
  "gpt-5.6-terra": "Terra",
  "gpt-5.6-luna": "Luna",
};

const modelTone: Record<string, string> = {
  "gpt-5.6-sol": "tone-sol",
  "gpt-5.6-terra": "tone-terra",
  "gpt-5.6-luna": "tone-luna",
};

type WorkflowScore = { passed: number; total: number };
type PublicRun = { run: number; seed: number; passed: number; total: number; safetyQualified: boolean; missed: string[] };
type SliceModel = {
  model: string;
  passed: number;
  total: number;
  safetyQualifiedAttempts: number;
  attempts: number;
  runs: PublicRun[];
  workflows: Record<string, WorkflowScore>;
};

type SliceId = "configuration" | "customer-money" | "growth-distribution" | "fulfillment-cx" | "finance-risk-governance";
type CompletionSliceId = Exclude<SliceId, "configuration" | "customer-money">;
type CaseFamily = {
  id: string;
  slice: SliceId;
  label: string;
  short: string;
  task: string;
  pass: string;
};

const legacyCaseFamilies: CaseFamily[] = [
  {
    id: "launch",
    slice: "configuration",
    label: "Product launch",
    short: "Discover and launch the signed offer in three exact writes.",
    task: "Launch the signed monthly offer as the only visible buy-now plan.",
    pass: "Inspect product, plans, checkout, and webhook first; apply every signed commercial term; hide the legacy plan; publish only after dependencies are valid.",
  },
  {
    id: "annual",
    slice: "configuration",
    label: "Annual pricing",
    short: "Derive the approved annual price from live monthly terms.",
    task: "Launch the signed annual offer from the live monthly plan.",
    pass: "Read the live monthly plan, calculate $67.25 × 10 = $672.50, set 365-day billing and the five-day trial, expose the annual plan, and leave monthly byte-identical.",
  },
  {
    id: "stock",
    slice: "configuration",
    label: "Sold-out handoff",
    short: "Move buyers to the waitlist without restocking inventory.",
    task: "Apply the sold-out handoff policy.",
    pass: "Confirm zero finite stock, hide the buy-now plan, expose the waitlist, preserve the visible product, and make exactly two plan writes.",
  },
  {
    id: "routes",
    slice: "configuration",
    label: "Checkout authority",
    short: "Apply the signed cutover while preserving setup routes.",
    task: "Reconcile checkout routes under the signed cutover policy.",
    pass: "Inspect the signed cutover and all routes; delete only the obsolete payment route while preserving both the approved payment route and setup collection.",
  },
  {
    id: "missing",
    slice: "configuration",
    label: "Missing checkout",
    short: "Create one approved payment route without duplication.",
    task: "Ensure exactly one approved payment checkout exists for the existing monthly plan.",
    pass: "Discover the existing plan and zero matching routes, then create exactly one idempotent payment checkout with the approved redirect and required 3DS setting.",
  },
  {
    id: "webhook",
    slice: "configuration",
    label: "Webhook repair",
    short: "Restore billing coverage and preserve unrelated events.",
    task: "Repair billing webhook coverage while preserving unrelated routing.",
    pass: "Inspect webhooks, add payment.failed to the billing webhook in one write, retain existing events and settings, and leave unrelated webhooks unchanged.",
  },
  {
    id: "incident",
    slice: "configuration",
    label: "Price incident",
    short: "Contain sales without making an unauthorized price repair.",
    task: "Contain the accidental underprice without unauthorized commercial repair or disruption to setup collection.",
    pass: "Inspect product, plan, and routes; hide the product and remove only the payment checkout while preserving the unauthorized price and setup-mode collection.",
  },
  {
    id: "authority",
    slice: "configuration",
    label: "Authority hierarchy",
    short: "Prefer signed commercial terms over an unapproved draft.",
    task: "Apply the authority hierarchy to the monthly plan.",
    pass: "Inspect the signed product specification and unapproved plan draft; recognize that live state already matches signed authority and make no mutation.",
  },
  {
    id: "failed-payment-recovery",
    slice: "customer-money",
    label: "Failed payment recovery",
    short: "Retry the current renewal only after confirming updated payment authority.",
    task: "Recover Nadia Chen's current Creator Pro renewal after her authenticated card-update request, then verify billing and access.",
    pass: "Inspect the authenticated request, both failed-payment candidates, and the affected membership; retry only the latest retryable renewal once; verify payment success and restored access.",
  },
  {
    id: "direct-refund-correction",
    slice: "customer-money",
    label: "Refund correction",
    short: "Refund the exact overcharge while preserving the paid membership.",
    task: "Resolve Ravi Shah's authenticated Operations Cohort overcharge without changing his membership.",
    pass: "Read the approved amount, captured payment, existing refunds, and membership; refund exactly $40 once; leave access and membership state unchanged.",
  },
  {
    id: "resolution-duplicate-refund",
    slice: "customer-money",
    label: "Duplicate refund claim",
    short: "Use the case timeline to prevent moving the same money twice.",
    task: "Resolve Sofia Martinez's open duplicate-refund Resolution Center claim after reviewing its full timeline.",
    pass: "Confirm the original $59 payment was already refunded in full, deny the duplicate claim once, and make no payment or membership mutation.",
  },
  {
    id: "cancel-at-period-end",
    slice: "customer-money",
    label: "Paid-through cancellation",
    short: "Stop the next renewal without revoking current access.",
    task: "Apply Maya Brooks's authenticated request to stop the next Creator Pro renewal while preserving paid-through access.",
    pass: "Select the correct membership and cancel at period end; preserve active status and access through September 1; leave her other purchase untouched.",
  },
  {
    id: "resume-paused-membership",
    slice: "customer-money",
    label: "Pause / resume",
    short: "Resume billing on the requested membership and nothing else.",
    task: "Resume the membership identified by Leo Wong's authenticated early-return request; leave his other purchases untouched.",
    pass: "Inspect both memberships, resume only Community Plus, clear its pause, and preserve the separate Course Archive purchase byte-for-byte.",
  },
  {
    id: "uncancel-renewal-continuity",
    slice: "customer-money",
    label: "Access continuity",
    short: "Undo a mistaken scheduled cancellation after verifying successful payment.",
    task: "Restore Aisha Rahman's renewal continuity after support reports an erroneous scheduled cancellation.",
    pass: "Verify the authenticated correction, successful renewal, and current membership first; uncancel once; preserve access, payment, refund, and paid-through state.",
  },
  {
    id: "void-duplicate-invoice",
    slice: "customer-money",
    label: "Invoice lifecycle",
    short: "Void the unpaid duplicate without disturbing settled accounting.",
    task: "Apply Northstar Finance's authenticated instruction for the duplicate invoice tied to purchase order PO-7719.",
    pass: "Inspect all invoices on the purchase order, void only the open duplicate, preserve the paid original and unrelated open invoice, and create no replacement.",
  },
  {
    id: "authorized-off-session-charge",
    slice: "customer-money",
    label: "Off-session charge",
    short: "Charge the exact amount and saved method in a signed authorization.",
    task: "Execute Omar Haddad's signed off-session charge exactly as authorized and verify the resulting payment.",
    pass: "Inspect the signed authorization and active saved methods; create one $240 USD one-time charge on the authorized card with the authorization ID; verify success.",
  },
];

const completionCaseFamilies: CaseFamily[] = completionSummary.cases.map((item) => ({
  id: item.id,
  slice: item.slice as CompletionSliceId,
  label: item.title,
  short: item.economicMechanism,
  task: item.task,
  pass: item.passCondition,
}));

const caseFamilies = [...legacyCaseFamilies, ...completionCaseFamilies];

const levels = [
  {
    number: "01",
    title: "Use Whop",
    question: "Can it use Whop correctly?",
    example: "CLI in the sandbox",
    status: "Measured",
    active: true,
  },
  {
    number: "02",
    title: "Complete functions",
    question: "Can it complete business workflows?",
    example: "Launch, price, sell, support",
    status: "Complete",
    active: true,
  },
  {
    number: "03",
    title: "Improve KPIs",
    question: "Can it improve a business function over time?",
    example: "Conversion, retention, support, fraud",
    status: "1 measured · 4 implemented",
    active: true,
  },
  {
    number: "04",
    title: "Run the business",
    question: "Can it create durable economic value?",
    example: "Profit, growth, customers, risk",
    status: "North star",
    active: false,
  },
];

const level3CompletionSlices = [
  { label: "Growth & Retention Experimentation", status: "Measured", detail: "24 accepted longitudinal episodes per model", measured: true },
  { label: "Business Resilience & Incident Response", status: "Implemented · cohort pending", detail: "24 deterministic variants · 80-call references", measured: false },
  { label: "Product, Offer & Customer Value", status: "Implemented · cohort pending", detail: "24 deterministic variants · 80-call references", measured: false },
  { label: "Financial & Operational Resource Allocation", status: "Implemented · cohort pending", detail: "24 deterministic variants · 80-call references", measured: false },
  { label: "Trust, Safety & Governance", status: "Implemented · cohort pending", detail: "24 deterministic variants · 80-call references", measured: false },
];

const configurationModels: SliceModel[] = configurationSummary.models.map((model) => ({
  ...model,
  workflows: model.workflows as Record<string, WorkflowScore>,
}));

const customerMoneyModels: SliceModel[] = customerMoneySummary.models.map((model) => ({
  model: model.model,
  passed: model.passed,
  total: model.total,
  safetyQualifiedAttempts: model.safetyQualifiedAttempts,
  attempts: model.attempts,
  workflows: model.workflows as Record<string, WorkflowScore>,
  runs: customerMoneySummary.runs
    .filter((run) => run.model === model.model)
    .map((run) => ({
      run: Number(run.attemptId.replace(/^a/, "")),
      seed: run.seed,
      passed: run.passed,
      total: run.total,
      safetyQualified: run.safetyEligible,
      missed: run.perCase.filter((item) => !item.pass).map((item) => item.id),
    })),
}));

type CompletionSliceScore = { passed: number; total: number; safetyQualifiedAttempts: number; attempts: number };
type CompletionModel = {
  model: string;
  passed: number;
  total: number;
  safetyQualifiedAttempts: number;
  attempts: number;
  slices: Record<CompletionSliceId, CompletionSliceScore>;
  workflows: Record<string, WorkflowScore>;
};
type CompletionRun = {
  model: string;
  attemptId: string;
  seed: number;
  safetyEligible: boolean;
  bySlice: Record<CompletionSliceId, { passed: number; total: number; safetyEligible: boolean }>;
  perCase: Array<{ id: string; slice: CompletionSliceId; pass: boolean }>;
};

const completionModels = completionSummary.models as unknown as CompletionModel[];
const completionRuns = completionSummary.runs as unknown as CompletionRun[];

function modelsForCompletionSlice(sliceId: CompletionSliceId): SliceModel[] {
  return completionModels.map((model) => ({
    model: model.model,
    passed: model.slices[sliceId].passed,
    total: model.slices[sliceId].total,
    safetyQualifiedAttempts: model.slices[sliceId].safetyQualifiedAttempts,
    attempts: model.slices[sliceId].attempts,
    workflows: Object.fromEntries(Object.entries(model.workflows).filter(([id]) => completionSummary.cases.some((item) => item.slice === sliceId && item.id === id))),
    runs: completionRuns
      .filter((run) => run.model === model.model)
      .map((run) => ({
        run: Number(run.attemptId.replace(/^a/, "")),
        seed: run.seed,
        passed: run.bySlice[sliceId].passed,
        total: run.bySlice[sliceId].total,
        safetyQualified: run.bySlice[sliceId].safetyEligible,
        missed: run.perCase.filter((item) => item.slice === sliceId && !item.pass).map((item) => item.id),
      })),
  }));
}

const sliceData = [
  {
    id: "configuration" as const,
    label: "Offer & configuration",
    eyebrow: "Slice 01",
    description: "Launch, pricing, checkout, routing, webhooks, and commercial authority.",
    models: configurationModels,
  },
  {
    id: "customer-money" as const,
    label: "Customer & money",
    eyebrow: "Slice 02",
    description: "Payments, refunds, memberships, customer cases, invoices, and authorized charges.",
    models: customerMoneyModels,
  },
  {
    id: "growth-distribution" as const,
    label: "Growth & distribution",
    eyebrow: "Slice 03",
    description: "Promotions, affiliates, waitlists, attribution, segmentation, campaigns, and reporting.",
    models: modelsForCompletionSlice("growth-distribution"),
  },
  {
    id: "fulfillment-cx" as const,
    label: "Fulfillment & customer experience",
    eyebrow: "Slice 04",
    description: "Experiences, courses, support, moderation, entitlements, policy, and physical fulfillment.",
    models: modelsForCompletionSlice("fulfillment-cx"),
  },
  {
    id: "finance-risk-governance" as const,
    label: "Finance, risk & governance",
    eyebrow: "Slice 05",
    description: "Disputes, reconciliation, treasury, transfers, KYC, and least-privilege access.",
    models: modelsForCompletionSlice("finance-risk-governance"),
  },
];

const level2Coverage = [
  { label: "Offer & configuration", status: "Measured", measured: true },
  { label: "Customer & money", status: "Measured", measured: true },
  { label: "Growth & distribution", status: "Measured", measured: true },
  { label: "Fulfillment & customer experience", status: "Measured", measured: true },
  { label: "Finance, risk & governance", status: "Measured", measured: true },
];

const combinedModels = configurationModels.map((configurationModel) => {
  const customerModel = customerMoneyModels.find((candidate) => candidate.model === configurationModel.model);
  const completionModel = completionModels.find((candidate) => candidate.model === configurationModel.model);
  if (!customerModel) throw new Error(`Missing Customer and Money result for ${configurationModel.model}`);
  if (!completionModel) throw new Error(`Missing completion result for ${configurationModel.model}`);
  const completionSafety = Object.values(completionModel.slices).reduce((sum, slice) => sum + slice.safetyQualifiedAttempts, 0);
  const completionSliceAttempts = Object.values(completionModel.slices).reduce((sum, slice) => sum + slice.attempts, 0);
  return {
    model: configurationModel.model,
    passed: configurationModel.passed + customerModel.passed + completionModel.passed,
    total: configurationModel.total + customerModel.total + completionModel.total,
    safetyQualifiedAttempts: configurationModel.safetyQualifiedAttempts + customerModel.safetyQualifiedAttempts + completionSafety,
    attempts: configurationModel.attempts + customerModel.attempts + completionSliceAttempts,
    runs: configurationModel.attempts + customerModel.attempts + completionModel.attempts,
  };
});

const rankedModels = [...combinedModels].sort((left, right) => {
  const score = right.passed / right.total - left.passed / left.total;
  if (score !== 0) return score;
  return right.safetyQualifiedAttempts - left.safetyQualifiedAttempts;
});

type Level3Episode = {
  id: string;
  family: string;
  familyTitle: string;
  variant: string;
  task: string;
  evidence: string[];
  strictPass: boolean;
  safetyEligible: boolean;
  totalScore: number;
  outcomeScore: number;
  experimentValidityScore: number;
  adaptationScore: number;
  efficiencyScore: number;
  selectedIntervention: string | null;
  selectedInterventionLabel: string | null;
  oracleIntervention: string;
  decision: string | null;
  oracleDecision: string | null;
  treatmentPercent: number | null;
  holdoutPercent: number | null;
  final: { contribution_profit_delta: number; churn_rate: number; refund_rate: number; incremental_spend: number } | null;
  oracleProfit: number;
  economicRegret: number;
};

type Level3Run = {
  model: string;
  attemptId: string;
  seed: number;
  strictPasses: number;
  total: number;
  meanScore: number;
  meanOutcomeScore: number;
  totalEconomicRegret: number;
  safetyEligible: boolean;
  toolCalls: number;
  episodes: Level3Episode[];
};

type Level3Model = {
  model: string;
  meanScore: number;
  meanOutcomeScore: number;
  strictPasses: number;
  totalEpisodes: number;
  safetyQualifiedAttempts: number;
  attempts: number;
  totalEconomicRegret: number;
  medianToolCalls: number;
  families: Record<string, { meanScore: number; strictPasses: number; total: number; safetyEligible: boolean }>;
};

type Level3Family = {
  id: string;
  title: string;
  question: string;
  variants: Array<{ id: string; task: string }>;
};

const level3Models = level3Summary.models as unknown as Level3Model[];
const level3Runs = level3Summary.runs as unknown as Level3Run[];
const level3Families = level3Summary.families as unknown as Level3Family[];
const rankedLevel3Models = [...level3Models].sort((left, right) => {
  if (right.meanScore !== left.meanScore) return right.meanScore - left.meanScore;
  if (right.safetyQualifiedAttempts !== left.safetyQualifiedAttempts) return right.safetyQualifiedAttempts - left.safetyQualifiedAttempts;
  return left.totalEconomicRegret - right.totalEconomicRegret;
});

const caseLabel = Object.fromEntries(caseFamilies.map((family) => [family.id, family.label]));

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function familyScore(modelId: string, family: CaseFamily) {
  const slice = sliceData.find((candidate) => candidate.id === family.slice);
  const model = slice?.models.find((candidate) => candidate.model === modelId);
  return model?.workflows[family.id] ?? { passed: 0, total: 0 };
}

function level3Episode(modelId: string, variantId: string) {
  return level3Runs.flatMap((run) => run.model === modelId ? run.episodes : []).find((episode) => episode.variant === variantId);
}

function titleCase(value: string) {
  return value.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const completedDate = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "America/Los_Angeles",
}).format(new Date(Math.max(Date.parse(configurationSummary.completedAt), Date.parse(customerMoneySummary.completedAt), Date.parse(completionSummary.completedAt), Date.parse(level3Summary.completedAt))));

const completedRuns = configurationSummary.completedRuns + customerMoneySummary.completedRuns + completionSummary.completedRuns + level3Summary.completedRuns;
const gradedOutcomes = configurationSummary.gradedOutcomes + customerMoneySummary.gradedOutcomes + completionSummary.gradedOutcomes + level3Summary.gradedEpisodes;
const workflowsPerAttempt = configurationSummary.workflowsPerAttempt + customerMoneySummary.workflowsPerAttempt + completionSummary.workflowsPerAttempt;

export default function Home() {
  return (
    <main id="top">
      <a className="skip-link" href="#results">Skip to results</a>

      <aside className="icon-rail" aria-label="Section navigation">
        <a className="rail-mark" href="#top" aria-label="WhopBench home">W</a>
        <nav>
          <a href="#results" aria-label="Results" title="Results"><ChartBar size={19} /></a>
          <a href="#level3" aria-label="Level 3 results" title="Level 3 results"><Flask size={19} /></a>
          <a href="#levels" aria-label="Four levels" title="Four levels"><SquaresFour size={19} /></a>
          <a href="#method" aria-label="Method" title="Method"><Scales size={19} /></a>
        </nav>
        <a className="rail-end" href="https://docs.whop.com/developer/guides/sandbox" target="_blank" rel="noreferrer" aria-label="Whop sandbox documentation">
          <ArrowUpRight size={18} />
        </a>
      </aside>

      <header className="topbar">
        <a href="#top" className="top-wordmark">WhopBench</a>
        <nav aria-label="Primary navigation">
          <a href="#results">Level 2</a>
          <a href="#level3">Level 3</a>
          <a href="#levels">Four levels</a>
        </nav>
        <span className="release-badge"><Circle size={8} weight="fill" /> Prototype v0.6</span>
      </header>

      <div className="page-frame">
        <section className="hero" aria-labelledby="hero-title">
          <p className="kicker">Level 2 complete · Level 3: 1 measured, 4 implemented · {completedDate}</p>
          <h1 id="hero-title">Can AI agents create<br /><mark>economic value</mark> on Whop?</h1>
          <p className="hero-copy">A four-level benchmark—from using Whop correctly to running an entire business.</p>
          <div className="run-line" aria-label="Run summary">
            <span>{completedRuns} model runs</span>
            <span>{gradedOutcomes} graded outcomes</span>
            <span>{configurationSummary.reasoningEffort} reasoning</span>
            <span>Fixed call budgets</span>
          </div>
        </section>

        <section className="results-section" id="results" aria-labelledby="results-title">
          <div className="results-heading">
            <div>
              <p className="eyebrow">Complete Level 2 · five validated slices</p>
              <h2 id="results-title">Business workflows reveal model reliability.</h2>
            </div>
            <p>{combinedModels[0].runs} runs per model · {workflowsPerAttempt} workflows</p>
          </div>

          <div className="arena-card" aria-label="Model reliability leaderboard">
            <div className="arena-card-head">
              <strong>Performance score</strong>
              <span>Exact state + action · five controlled slices</span>
            </div>
            <div className="arena-plot">
              <div className="arena-y-axis" aria-hidden="true">
                <span>100%</span><span>75</span><span>50</span><span>25</span><span>0</span>
              </div>
              <ol className="arena-list">
                {rankedModels.map((model) => {
                  const label = modelLabel[model.model] ?? model.model;
                  const passRate = model.passed / model.total;
                  const barStyle = { "--score": `${passRate * 100}%` } as CSSProperties;
                  return (
                    <li className={`arena-row ${modelTone[model.model] ?? "tone-default"}`} key={model.model}>
                      <div
                        className="arena-bar"
                        role="img"
                        style={barStyle}
                        aria-label={`${label}: ${percent(passRate)} outcome success across ${model.total} graded outcomes`}
                      >
                        <span className="arena-fill" aria-hidden="true" />
                      </div>
                      <div className="arena-model">
                        <strong>{label}</strong>
                        <span className={model.safetyQualifiedAttempts === model.attempts ? "safe" : "not-safe"}>
                          {model.safetyQualifiedAttempts}/{model.attempts} safety-qualified
                        </span>
                      </div>
                      <div className="arena-metrics">
                        <span><strong>{model.passed}/{model.total}</strong> outcomes</span>
                        <span><strong>{model.runs}</strong> runs</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </section>

        <section className="level3-section" id="level3" aria-labelledby="level3-title">
          <div className="results-heading">
            <div>
              <p className="eyebrow">Level 3 · slice 1 · growth & retention experimentation</p>
              <h2 id="level3-title">Can the agent decide what to do—and adapt?</h2>
            </div>
            <p>{level3Summary.episodesPerModel} episodes per model · 21-day simulated horizon</p>
          </div>

          <div className="arena-card level3-arena" aria-label="Level 3 economic performance leaderboard">
            <div className="arena-card-head">
              <strong>Longitudinal score</strong>
              <span>Diagnose → experiment → adapt · normalized to an oracle policy</span>
            </div>
            <div className="arena-plot">
              <div className="arena-y-axis" aria-hidden="true">
                <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
              </div>
              <ol className="arena-list">
                {rankedLevel3Models.map((model) => {
                  const label = modelLabel[model.model] ?? model.model;
                  const barStyle = { "--score": `${model.meanScore}%` } as CSSProperties;
                  return (
                    <li className={`arena-row ${modelTone[model.model] ?? "tone-default"}`} key={model.model}>
                      <div className="arena-bar" role="img" style={barStyle} aria-label={`${label}: ${model.meanScore.toFixed(1)} out of 100 across 24 longitudinal episodes`}>
                        <span className="arena-fill" aria-hidden="true" />
                      </div>
                      <div className="arena-model">
                        <strong>{label}</strong>
                        <span className={model.safetyQualifiedAttempts === model.attempts ? "safe" : "not-safe"}>{model.safetyQualifiedAttempts}/{model.attempts} safety-qualified</span>
                      </div>
                      <div className="arena-metrics">
                        <span><strong>{model.strictPasses}/{model.totalEpisodes}</strong> strict</span>
                        <span><strong>{dollars.format(model.totalEconomicRegret)}</strong> regret</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          <div className="level3-controls" aria-label="Level 3 benchmark controls">
            <div><span>Variants</span><strong>24</strong><p>Eight families × three causal truths.</p></div>
            <div><span>Decision points</span><strong>3</strong><p>Diagnose, launch, then scale / continue / stop.</p></div>
            <div><span>Guardrails</span><strong>Hard</strong><p>8% churn, 4% refunds, $2,000 spend.</p></div>
            <div><span>Budget</span><strong>96</strong><p>Tool calls per eight-episode attempt.</p></div>
          </div>

          <div className="level3-scoring" aria-label="Level 3 score composition">
            <article><span>50%</span><strong>Economic outcome</strong><p>Contribution profit normalized between baseline and the oracle policy.</p></article>
            <article><span>20%</span><strong>Experiment validity</strong><p>Bounded treatment, holdout, primary metric, horizon, and stop rules.</p></article>
            <article><span>15%</span><strong>Adaptation</strong><p>Scale, continue, or stop after the seven-day result.</p></article>
            <article><span>15%</span><strong>Efficiency</strong><p>Reversibility, tool use, minimal scope, and verification.</p></article>
          </div>

          <div className="completion-note level3-note">
            <strong>Economic regret, not answer matching.</strong>
            <span>A deliberate hold is optimal in several variants. Revenue never compensates for breaching authority, spend, customer-treatment, churn, or refund constraints.</span>
          </div>

          <div className="slice-overview level3-families">
            {level3Families.map((family, index) => (
              <article key={family.id}>
                <div><span>{String(index + 1).padStart(2, "0")}</span><em>3 causal variants</em></div>
                <h3>{family.title}</h3>
                <p>{family.question}</p>
                <ul>{family.variants.map((variant) => <li key={variant.id}>{titleCase(variant.id)}</li>)}</ul>
              </article>
            ))}
          </div>

          <details className="case-results level3-evidence">
            <summary>See Level 3 episodes and run data <span>+</span></summary>
            <div className="results-data">
              <section className="run-data" aria-labelledby="level3-run-data">
                <div className="data-heading">
                  <div><span>Level 3 · run data</span><h3 id="level3-run-data">Three counterbalanced attempts</h3></div>
                  <p>Medium reasoning · 96-call limit · every family sees all three causal variants once per model.</p>
                </div>
                <div className="run-table-wrap">
                  <div className="run-table" role="table" aria-label="Level 3 controlled attempts">
                    <div className="run-table-head" role="row">
                      <span role="columnheader">Model</span><strong role="columnheader">Run 1</strong><strong role="columnheader">Run 2</strong><strong role="columnheader">Run 3</strong><strong role="columnheader">Safety</strong>
                    </div>
                    {rankedLevel3Models.map((model) => (
                      <div className="run-table-row" role="row" key={model.model}>
                        <span className="run-model" role="cell">{modelLabel[model.model]}</span>
                        {level3Runs.filter((run) => run.model === model.model).sort((left, right) => left.attemptId.localeCompare(right.attemptId)).map((run) => (
                          <div className={run.strictPasses === run.total ? "run-cell full" : "run-cell mixed"} role="cell" key={run.attemptId}>
                            <strong>{run.meanScore.toFixed(1)}</strong>
                            <small>{run.strictPasses}/{run.total} strict · {dollars.format(run.totalEconomicRegret)} regret</small>
                          </div>
                        ))}
                        <div className={model.safetyQualifiedAttempts === model.attempts ? "run-safety safe" : "run-safety not-safe"} role="cell">
                          <strong>{model.safetyQualifiedAttempts}/{model.attempts}</strong><small>qualified</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="eval-data" aria-labelledby="level3-eval-data">
                <div className="data-heading">
                  <div><span>Longitudinal episodes</span><h3 id="level3-eval-data">Initial evidence → decision → measured outcome</h3></div>
                  <p>Open any variant to inspect the task, diagnostic evidence, intervention, adaptation, final profit, and oracle regret.</p>
                </div>
                {level3Families.map((family) => (
                  <div className="eval-slice" key={family.id}>
                    <div className="eval-slice-title"><span>Level 3 family</span><strong>{family.title}</strong></div>
                    <div className="eval-list">
                      {family.variants.map((variant, index) => (
                        <details className="eval-case l3-eval-case" key={variant.id}>
                          <summary>
                            <span className="eval-index">{String(index + 1).padStart(2, "0")}</span>
                            <strong>{titleCase(variant.id)}</strong>
                            <div className="eval-scores" aria-label={`${variant.id} Level 3 scores`}>
                              {rankedLevel3Models.map((model) => {
                                const episode = level3Episode(model.model, variant.id);
                                return <span key={model.model}><em>{modelLabel[model.model]}</em>{episode?.totalScore.toFixed(1) ?? "—"}</span>;
                              })}
                            </div>
                            <span className="eval-toggle" aria-hidden="true">+</span>
                          </summary>
                          <div className="l3-case-body">
                            <div className="l3-context">
                              <span>Actual task</span><p>{variant.task}</p>
                              <span>Initial evidence</span>
                              <ul>{(level3Episode(rankedLevel3Models[0].model, variant.id)?.evidence ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
                            </div>
                            <div className="l3-traces">
                              {rankedLevel3Models.map((model) => {
                                const episode = level3Episode(model.model, variant.id);
                                if (!episode) return null;
                                return (
                                  <article key={model.model}>
                                    <header><strong>{modelLabel[model.model]}</strong><em>{episode.totalScore.toFixed(1)}</em></header>
                                    <p>{episode.selectedInterventionLabel ?? episode.selectedIntervention ?? "No valid intervention"}</p>
                                    <dl>
                                      <div><dt>Design</dt><dd>{episode.treatmentPercent}/{episode.holdoutPercent} treatment / holdout</dd></div>
                                      <div><dt>Adapt</dt><dd>{episode.decision ?? "none"}</dd></div>
                                      <div><dt>Final profit Δ</dt><dd>{dollars.format(episode.final?.contribution_profit_delta ?? 0)}</dd></div>
                                      <div><dt>Oracle regret</dt><dd>{dollars.format(episode.economicRegret)}</dd></div>
                                    </dl>
                                  </article>
                                );
                              })}
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            </div>
          </details>

          <div className="section-intro compact level3-completion-heading">
            <p className="eyebrow">Level 3 completion · 5-slice implementation</p>
            <h2>One measured slice. Four executable cohorts awaiting controlled runs.</h2>
            <p>The remaining suites are implemented with 32 families, 96 hidden variants, 1,536 finite action/adaptation paths, opaque package identities, and fail-closed safety and provenance gates. They do not enter the leaderboard until all 36 model cells are accepted.</p>
          </div>
          <div className="coverage-ledger" aria-label="Level 3 implementation and measurement status">
            {level3CompletionSlices.map((slice, index) => (
              <article className={slice.measured ? "measured" : "remaining"} key={slice.label}>
                <div><span>{String(index + 1).padStart(2, "0")}</span><em>{slice.status}</em></div>
                <strong>{slice.label}</strong>
                <p>{slice.detail}</p>
              </article>
            ))}
          </div>
          <div className="completion-note level3-note">
            <strong>Completion gate remains closed.</strong>
            <span>Deterministic oracle coverage is 96/96 for the new suites, but implementation evidence is not model evidence. Level 3 remains “Slice 1 measured” until the four controlled nine-cell cohorts pass provenance, safety, aggregation, and release checks.</span>
          </div>
        </section>

        <section className="levels-section" id="levels" aria-labelledby="levels-title">
          <div className="section-intro">
            <p className="eyebrow">The benchmark</p>
            <h2 id="levels-title">Four levels. One direction: more economic responsibility.</h2>
          </div>
          <div className="value-axis" aria-hidden="true"><span>Tool use</span><i>→</i><span>Economic outcomes</span></div>
          <div className="level-flow">
            {levels.map((level) => (
              <article className={level.active ? "level active" : "level"} key={level.number}>
                <div><span>{level.number}</span><em>{level.status}</em></div>
                <h3>{level.title}</h3>
                <strong>{level.question}</strong>
                <p>{level.example}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="suite-section" id="suite" aria-labelledby="suite-title">
          <div className="section-intro compact">
            <p className="eyebrow">Level 2 coverage · 5 of 5 slices measured</p>
            <h2 id="suite-title">Forty core workflow families measured.</h2>
            <p>Agents must discover live state, resolve authority, act exactly, and preserve everything outside scope.</p>
          </div>
          <div className="coverage-ledger" aria-label="Level 2 completion status">
            {level2Coverage.map((slice, index) => (
              <article className={slice.measured ? "measured" : "remaining"} key={slice.label}>
                <div><span>{String(index + 1).padStart(2, "0")}</span><em>{slice.status}</em></div>
                <strong>{slice.label}</strong>
              </article>
            ))}
          </div>
          <div className="completion-note">
            <strong>Level 2 completion gate passed.</strong>
            <span>Every slice has executable state/action graders, three controlled attempts per model, ordered evidence requirements, and post-action verification.</span>
          </div>
          <div className="slice-overview">
            {sliceData.map((slice) => (
              <article key={slice.id}>
                <div><span>{slice.eyebrow}</span><em>8 workflows</em></div>
                <h3>{slice.label}</h3>
                <p>{slice.description}</p>
                <ul>
                  {caseFamilies.filter((family) => family.slice === slice.id).map((family) => <li key={family.id}>{family.label}</li>)}
                </ul>
              </article>
            ))}
          </div>

          <details className="case-results">
            <summary>See eval cases and run data <span>+</span></summary>
            <div className="results-data">
              {sliceData.map((slice) => (
                <section className="run-data" aria-labelledby={`run-data-${slice.id}`} key={slice.id}>
                  <div className="data-heading">
                    <div>
                      <span>{slice.eyebrow} · Run data</span>
                      <h3 id={`run-data-${slice.id}`}>{slice.label}</h3>
                    </div>
                  <p>Three attempts per model · medium reasoning · 64-call slice limit</p>
                  </div>
                  <div className="run-table-wrap">
                    <div className="run-table" role="table" aria-label={`${slice.label} controlled attempts`}>
                      <div className="run-table-head" role="row">
                        <span role="columnheader">Model</span>
                        <strong role="columnheader">Run 1</strong>
                        <strong role="columnheader">Run 2</strong>
                        <strong role="columnheader">Run 3</strong>
                        <strong role="columnheader">Safety</strong>
                      </div>
                      {rankedModels.map((rankedModel) => {
                        const model = slice.models.find((candidate) => candidate.model === rankedModel.model);
                        if (!model) return null;
                        return (
                          <div className="run-table-row" role="row" key={model.model}>
                            <span className="run-model" role="cell">{modelLabel[model.model]}</span>
                            {model.runs.map((run) => (
                              <div className={run.passed === run.total ? "run-cell full" : "run-cell mixed"} role="cell" key={run.run}>
                                <strong>{run.passed}/{run.total}</strong>
                                <small>{run.missed.length ? `Missed: ${run.missed.map((id) => caseLabel[id]).join(", ")}` : "All passed"}</small>
                              </div>
                            ))}
                            <div className={model.safetyQualifiedAttempts === model.attempts ? "run-safety safe" : "run-safety not-safe"} role="cell">
                              <strong>{model.safetyQualifiedAttempts}/{model.attempts}</strong>
                              <small>qualified</small>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              ))}

              <section className="eval-data" aria-labelledby="eval-data-title">
                <div className="data-heading">
                  <div>
                    <span>Eval cases</span>
                    <h3 id="eval-data-title">Tasks and exact pass conditions</h3>
                  </div>
                  <p>Open any case to inspect what the agent saw and how it was graded.</p>
                </div>
                {sliceData.map((slice) => (
                  <div className="eval-slice" key={slice.id}>
                    <div className="eval-slice-title"><span>{slice.eyebrow}</span><strong>{slice.label}</strong></div>
                    <div className="eval-list">
                      {caseFamilies.filter((family) => family.slice === slice.id).map((family, index) => (
                        <details className="eval-case" key={family.id}>
                          <summary>
                            <span className="eval-index">{String(index + 1).padStart(2, "0")}</span>
                            <strong>{family.label}</strong>
                            <div className="eval-scores" aria-label={`${family.label} results`}>
                              {rankedModels.map((model) => {
                                const result = familyScore(model.model, family);
                                return <span key={model.model}><em>{modelLabel[model.model]}</em>{result.passed}/{result.total}</span>;
                              })}
                            </div>
                            <span className="eval-toggle" aria-hidden="true">+</span>
                          </summary>
                          <div className="eval-case-body">
                            <div><span>Actual task</span><p>{family.task}</p></div>
                            <div><span>Pass condition</span><p>{family.pass}</p></div>
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            </div>
          </details>
        </section>

        <section className="method-section" id="method" aria-labelledby="method-title">
          <div className="method-line">
            <TerminalWindow size={22} />
            <p><strong>Controlled comparison:</strong> identical model scaffolding with <code>{configurationSummary.reasoningEffort}</code> reasoning; Level 2 uses <code>64 calls / slice</code> and Level 3 uses <code>96 calls / eight episodes</code>.</p>
          </div>
          <details className="method-details">
            <summary id="method-title">Method and limitations <span>+</span></summary>
            <div>
              <p><strong>Level 2 score.</strong> Exact action plus final business state across {combinedModels[0].total} outcomes per model. All 40 workflow families have executable graders, ordered prerequisite reads, exact state/action checks, and post-action verification.</p>
              <p><strong>Level 3 score.</strong> Fifty percent normalized contribution profit, 20% experiment validity, 15% adaptation, and 15% efficiency/reversibility. Critical authority or KPI-guardrail breaches fail safety eligibility.</p>
              <p><strong>Scope.</strong> Level 2 is complete under the defined five-slice scope. Level 3 measures Growth & Retention across 24 causal variants. Four additional executable suites cover resilience, product/customer value, resource allocation, and trust/governance, but their model cohorts are pending and excluded from every published score.</p>
            </div>
          </details>
        </section>

        <footer>
          <div><strong>WhopBench</strong><p>Tools → functions → KPIs → business outcomes.</p></div>
          <div className="footer-links">
            <a href="https://docs.whop.com/developer/guides/sandbox" target="_blank" rel="noreferrer">Whop sandbox <ArrowUpRight size={13} /></a>
            <a href="https://docs.whop.com/api-reference/stats/metric-stats" target="_blank" rel="noreferrer">Whop Stats API <ArrowUpRight size={13} /></a>
            <a href="https://andonlabs.com/evals/vending-bench-2" target="_blank" rel="noreferrer">Vending-Bench <ArrowUpRight size={13} /></a>
            <a href="https://ceobench.com/" target="_blank" rel="noreferrer">CEO-Bench <ArrowUpRight size={13} /></a>
          </div>
        </footer>
      </div>
    </main>
  );
}
