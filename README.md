# PromisePay

Income allocation and automatic personal savings for freelance teams.

## Current status
Pre-hackathon preparation, created October 26, 2026. Do not represent this work as created during November 1–14. Confirm eligibility with organizers before using pre-event implementation in a submission.

Implemented source: deterministic accounting; agreement acceptance; authenticated NEP-141 receiver; contributor claims; personal liquid savings; callback-based withdrawal restoration; testnet/mainnet configuration; wallet login and basic onchain forms. Neither network has a deployed contract. Yield is disabled.

## Run
`npm ci`, `npm test`, `npm run dev`. Production frontend: `npm run build`. Copy `.env.example` to `.env` and supply independently verified deployment/token accounts per network. Empty configuration blocks wallet actions. See docs/DEPLOYMENT.md.

## Validation
13 Node tests pass, including contract-method tests with a mocked NEAR host, exact token arithmetic, wrong-token and unaccepted-agreement rejection, withdrawal accounting, and network guards. The frontend production build passes. Mocked-host tests strip SDK decorators and do not test WASM, SDK access control, or real cross-contract execution.

The compiler blocker is resolved. Contract WASM compilation and export validation pass. The build is 549,487 bytes; SHA-256 and source fingerprints are in contract/BUILD.json. The only callable exports are the nine intended public methods.

Local sandbox execution was attempted but stopped before contract execution: near-sandbox requires 65,535 file descriptors and this environment permits 16,384. The sandbox scenario is preserved in integration/sandbox.mjs, and the GitHub verification workflow will attempt it on a standard runner. That scenario uses an authorized mock token account, not a complete NEP-141 token implementation, and does not prove successful token delivery. Public testnet/mainnet transactions remain unverified.

## Reproduce contract build
On Linux x86_64: `cd contract && npm ci --ignore-scripts`, then from the repository root run `bash scripts/install-toolchain.sh`, `npm run build --prefix contract`, and `node scripts/verify-contract.mjs`. The recovery installer downloads the SDK's pinned official compiler assets and verifies their SHA-256 hashes. CI also runs the frontend build, unit tests, and sandbox scenario. A successful CI run uploads the WASM as an artifact; no deployment or wallet secrets are used.

## Demo
The local simulation is separate from onchain balances. Simulate $150: $100 editor, $50 designer, $150 still owed. Simulate $450 next: remaining commitments allocated, $15 saved, $285 available. No yield is simulated. Real onchain forms require configured deployed accounts and explicit wallet signing.

## Allocation policy
Recipients have fixed entitlements accepted before funding. Each receipt funds outstanding commitments proportionally, with largest-remainder integer rounding. Only the remainder belongs to the owner and is eligible for their chosen savings rate. Savings never reduce another recipient's entitlement. This prototype implements one policy, not arbitrary priority schedules.

## Contract architecture and remaining work
NEP-141 token receiver; agreement acceptance by each participant; immutable activated allocations; user-owned savings balances; pull-based claims with failed-transfer restoration; asynchronous callback accounting and replay protection. A verified yield adapter is optional. If a yield deposit fails, funds remain attributed to liquid savings. Yield must not include unpaid contributor funds.

RHEA is a candidate, not an active integration. Verify token contracts, deposit/withdraw interfaces, active market status and liquidity before implementation. Do not display invented APY or guarantee instant withdrawals. Keep liquid savings separate from yield positions.

## Limits
Only funds explicitly routed through the app can be allocated. No arbitrary wallet interception. Client nonpayment remains possible. An allocation is an accounting entitlement until a real payout succeeds. All prototype dollars are simulated.
