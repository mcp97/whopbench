# WhopBench Hosted Sandbox

The publishable WhopBench lane runs only against Whop's hosted sandbox at `https://sandbox-api.whop.com/api/v1`. It does not use the local API-compatible simulator and cannot access production.

The previous local-simulator pilot is invalidated. Its policy conflicted with one scored outcome, and its results must not appear in the public leaderboard. The older simulator source remains in this repository only as development history while the hosted harness is completed.

## Current release gate

- 12 cases across six counterfactual pairs
- Sol, Terra, and Luna
- five precommitted attempts per model
- task-order seeds 101, 211, 307, 419, and 523
- real `@whop/cli` 0.14.2
- Whop-hosted test state and test transactions
- direct final-state verification outside the agent context
- no interim scores and no partial-run aggregation

## Configure access

Create a key in the [Whop sandbox developer dashboard](https://sandbox.whop.com/dashboard/developer). Sandbox credentials are separate from production credentials.

Configure the key in the process environment without writing it into this repository:

```bash
export WHOP_SANDBOX_API_KEY=apik_xxx
npm run whop:sandbox:preflight
```

The preflight calls only `sandbox-api.whop.com`, returns a sanitized test-business identity, and reports `productionAccess: false`.

Run one CLI command through the fail-closed launcher:

```bash
npm run whop:sandbox -- products list --format json
```

The launcher pins the sandbox host, uses a fresh isolated CLI config directory, never stores the key, and prints a persistent sandbox warning.

## CLI finding

The hosted sandbox exists, and `@whop/cli` 0.14.2 can reach it through `WHOP_API_BASE_URL`. The CLI does not expose a first-class `--sandbox` or `--environment sandbox` option, and saved auth profiles do not persist their environment. A proper upstream change should add environment-aware profiles, credential isolation, a visible SANDBOX marker, structured-output environment metadata, and fail-closed host validation.
