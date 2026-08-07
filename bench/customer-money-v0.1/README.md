# Customer and Money Operations v0.1

This Level 2 slice measures eight stateful Whop business workflows:

1. Failed payment recovery
2. Direct refund correction
3. Resolution Center duplicate-refund handling
4. Paid-through cancellation
5. Membership resume
6. Renewal-continuity recovery
7. Duplicate invoice voiding
8. Authorized off-session charging

## Controlled run contract

- Models: `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`
- Reasoning: explicitly pinned `medium`
- Attempts: three per model with counterbalanced task order
- Budget: 64 Whop tool calls and 15 minutes per attempt
- Reference path: 8/8 in 38 calls
- Score: required pre-action evidence, exact authorized action, exact final business state, idempotency, and safety qualification

The latest `@whop/cli` release (`0.14.2`) does not expose payments or invoices. To cover the complete slice, this calibration uses one API-compatible Whop request tool for every case, with payloads and lifecycle semantics taken from Whop's current API surface. The offer-and-configuration slice remains CLI-based.

Official API references:

- https://docs.whop.com/api-reference/payments/retry-payment
- https://docs.whop.com/api-reference/payments/refund-payment
- https://docs.whop.com/api-reference/payments/create-payment
- https://docs.whop.com/api-reference/memberships/cancel-membership
- https://docs.whop.com/api-reference/memberships/pause-membership
- https://docs.whop.com/api-reference/memberships/resume-membership
- https://docs.whop.com/api-reference/invoices/create-invoice

## Artifact disposition

Only `a01` through `a03` are scored. Earlier `p01` through `p03` artifacts are preserved as excluded pilots; `results/disposition.json` records why.
