# PromisePay

Income allocation and automatic personal savings for freelance teams.

## Current status
Pre-hackathon preparation, created October 26, 2026. Do not represent this work as created during November 1–14. Confirm eligibility with organizers before using pre-event implementation in a submission.

Working locally: deterministic allocation engine, partial-payment accounting, percentage savings from the owner's remainder, personal savings mode, and savings top-ups. Run `npm test`.

Not deployed: NEAR contract, wallet connection, real token payouts, yield deposits, withdrawals, cross-chain settlement. No real funds should be sent. The browser demo uses local simulated balances only.

## Try it
Run `npm start`, open http://localhost:3000, and simulate a $150 receipt. Observe $100 to editor, $50 to designer, $150 still owed, and no personal savings. Simulate $450 next: remaining team commitments are allocated, $15 goes to simulated savings, and $285 becomes available. Reload retains the local demo ledger. Reset removes only demo data.

## Allocation policy
Recipients have fixed entitlements accepted before funding. Each receipt funds outstanding commitments proportionally, with largest-remainder integer rounding. Only the remainder belongs to the owner and is eligible for their chosen savings rate. Savings never reduce another recipient's entitlement. This prototype implements one policy, not arbitrary priority schedules.

## Planned NEAR implementation
NEP-141 token receiver; agreement acceptance by each participant; immutable activated allocations; user-owned savings balances; pull-based claims with failed-transfer restoration; asynchronous callback accounting and replay protection. A verified yield adapter is optional. If a yield deposit fails, funds remain attributed to liquid savings. Yield must not include unpaid contributor funds.

RHEA is a candidate, not an active integration. Verify token contracts, deposit/withdraw interfaces, active market status and liquidity before implementation. Do not display invented APY or guarantee instant withdrawals. Keep liquid savings separate from yield positions.

## Limits
Only funds explicitly routed through the app can be allocated. No arbitrary wallet interception. Client nonpayment remains possible. An allocation is an accounting entitlement until a real payout succeeds. All prototype dollars are simulated.
