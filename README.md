# WhopBench

WhopBench is an executable benchmark for measuring whether AI agents can operate a synthetic Whop business safely and economically—not merely call tools or produce plausible recommendations.

Live benchmark: https://whopbench-evaluation.alignedai.chatgpt.site

## Current status

Level 2 is complete across five measured slices: 40 workflow families, 120 outcomes per model, and 360 graded outcomes.

Level 3 has one measured slice and four additional executable suites whose controlled model cohorts are pending:

| Slice | Families | Variants/model | Status |
| --- | ---: | ---: | --- |
| Growth & Retention Experimentation | 8 | 24 | Measured and frozen |
| Business Resilience & Incident Response | 8 | 24 | Implemented; cohort pending |
| Product, Offer & Customer Value | 8 | 24 | Implemented; cohort pending |
| Financial & Operational Resource Allocation | 8 | 24 | Implemented; cohort pending |
| Trust, Safety & Governance | 8 | 24 | Implemented; cohort pending |

The four new suites contain 32 families, 96 hidden variants, and 1,536 finite initial-action × adaptation paths. Their deterministic references strict-pass 96/96 episodes in exactly 80 calls per attempt. This does not count as model evidence: the completion aggregator fails closed until four provenance-consistent nine-cell Sol/Terra/Luna cohorts are accepted.

## Evaluation design

Level 2 measures directed execution: resolve entities and authority, perform the requested operation, and verify final state.

Level 3 measures bounded autonomous operation: the objective, authority, constraints, and horizon are fixed, but the agent must diagnose ambiguous state, choose among several legal actions or restraint, precommit a plan, execute, verify, observe an interim checkpoint, adapt, and reach a final economic or safety outcome.

Slices 2–5 share a deterministic ten-call lifecycle:

1. Open the episode.
2. Read diagnostic evidence.
3. Read the finite package catalog.
4. Submit an immutable structured plan.
5. Apply one bounded initial package or explicit hold.
6. Verify canonical post-action state.
7. Advance to T1.
8. Read interim evidence.
9. Apply one finite adaptation package.
10. Advance to T2 and receive the canonical terminal result.

Every accepted attempt uses medium reasoning, eight episodes, a 96-call ceiling, three counterbalanced seeds, opaque public package IDs, ordered evidence, unique idempotency keys, and programmatic execution grading. Critical authority or safety violations are a hard attempt-qualification gate.

## Repository map

```text
app/                                         public benchmark site
bench/level3-growth-retention-v0.1/          frozen measured Slice 1
bench/level3-operations-v0.1/                shared engine and controls for Slices 2–5
bench/level3-business-resilience-v0.1/       Slice 2
bench/level3-product-customer-value-v0.1/    Slice 3
bench/level3-resource-allocation-v0.1/       Slice 4
bench/level3-trust-governance-v0.1/          Slice 5
bench/level3-completion-v0.1/                fail-closed five-slice gate
tests/                                       existing release and render checks
```

The measured Slice 1 namespace and artifacts are unchanged. Its 20-file accepted artifact set is pinned by checksum in `slice1-adapter.mjs`.

## Run locally

Requirements: Node.js 22.13+ and npm.

```bash
npm ci
npm run whopbench:level3:new:reference
npm run whopbench:level3:new:test
npm test
npm run lint
```

`npm run whopbench:level3:new:test` runs 55 deterministic checks covering all 96 variants, finite response matrices, opaque identifiers, 80-call references, ordered evidence, immutable plan/action sequencing, verification, idempotency, namespace isolation, unsafe broad-action rejection, the global call ceiling, the frozen Slice 1 checksum, and the fail-closed completion gate.

The completion command is expected to exit nonzero while cohorts are pending:

```bash
npm run whopbench:level3:completion
```

## Controlled model cohorts

Running model cells requires `/opt/codex/bin/codex` and an explicitly supplied authentication file. The harness never commits credentials:

```bash
export WHOPBENCH_CODEX_AUTH_FILE=/absolute/path/to/auth.json
npm run whopbench:level3:resilience:run
npm run whopbench:level3:product:run
npm run whopbench:level3:allocation:run
npm run whopbench:level3:governance:run
```

Each runner refuses to overwrite preserved artifacts. Infrastructure-invalid cells are excluded and must be rerun unchanged. Aggregate a slice only after all nine cells are complete:

```bash
npm run whopbench:level3:resilience:aggregate
npm run whopbench:level3:product:aggregate
npm run whopbench:level3:allocation:aggregate
npm run whopbench:level3:governance:aggregate
```

No benchmark action connects to production Whop, moves real money, contacts real customers, or reads external business data. All entities and outcomes are synthetic fixtures.

## Site runtime

The public interface is a Vinext/React application deployed through ChatGPT Sites. Useful commands:

```bash
npm run dev
npm run build
npm run validate:artifact
```

The source includes synthetic raw benchmark traces for reproducibility. Generated dependencies, build output, local runtime state, environment files, and credentials are excluded from Git.
