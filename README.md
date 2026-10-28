# PromisePay


## Simplified workspace (October 2026)

- Connect a wallet to load available/savings balances automatically; each amount is shown in ordinary USDC (six decimal places are converted internally).
- My plans discovers existing agreements by name and shows incoming invitations for the connected participant. Create personal plans or add teammates through ordinary wallet/amount fields; no JSON entry is required.
- Review each payment split, acceptance, storage registration, or withdrawal before a wallet approval is requested. The interface waits for NEAR final execution and checks receipt failures and allocation/withdrawal events.
- Successful transactions refresh balances and plans. Activity is a per-wallet, per-network list stored in this browser and is not a complete chain indexer.
- The existing contract has no indexed agreement list: discovery reads consecutive agreements in bounded batches, offers a continuation button, and stops at the first missing ID. This is suitable for the testnet prototype; a production indexer or paginated contract view is needed at scale.
- Mainnet is disabled in the user interface until configured and tested. Savings are liquid contract balances, not interest-earning deposits. Savings apply to payments sent through PromisePay, not unrelated wallet transfers.
- Motion reference: Aurex Finance on MotionSites (https://motionsites.ai/?prompt=aurex-finance), adapted as original organic line artwork and restrained movement with a reduced-motion option. No third-party source code or media assets are bundled.

Use `npm ci`, copy `.env.example` to `.env`, and run `npm run dev`. `npm test` covers allocation, exact USDC conversions, teammate input validation, payment previews, and transaction result handling; `npm run build` checks the production bundle. Browser wallet signing still requires the user's own wallet.

Income allocation and automatic personal savings for freelance teams.

## Current status
Pre-hackathon preparation, created October 26, 2026. Do not represent this work as created during November 1–14. Confirm eligibility with organizers before using pre-event implementation in a submission.

Implemented source: deterministic accounting; agreement acceptance; authenticated NEP-141 receiver; contributor claims; personal liquid savings; callback-based withdrawal restoration; testnet/mainnet configuration; wallet login and a simplified workspace. Testnet contract: `promisepay-mikecity.testnet`, initialized with Circle testnet USDC. [Deployment transaction](https://testnet.nearblocks.io/txns/13yVg9X8un3KhxqxaL91BS6ZoJeMew5nzhSX1gKgPkXe). Mainnet has no deployed contract. Yield is disabled.

## Run
`npm ci`, `npm test`, `npm run dev`. Production frontend: `npm run build`. Copy `.env.example` to `.env` to use the verified testnet contract and token accounts. Mainnet accounts must be independently verified and configured before use. Empty configuration blocks wallet actions. See docs/DEPLOYMENT.md.

## Validation
24 Node tests pass, including contract-method tests with a mocked NEAR host, exact token arithmetic, wrong-token and unaccepted-agreement rejection, withdrawal accounting, and network guards. The frontend production build passes. Mocked-host tests strip SDK decorators and do not test WASM, SDK access control, or real cross-contract execution.

The compiler blocker is resolved. Contract WASM compilation and export validation pass. The build is 549,487 bytes; SHA-256 and source fingerprints are in contract/BUILD.json. The only callable exports are the nine intended public methods.

Local sandbox execution was attempted but stopped before contract execution: near-sandbox requires 65,535 file descriptors and this environment permits 16,384. The sandbox scenario is preserved in integration/sandbox.mjs, and the GitHub verification workflow will attempt it on a standard runner. That scenario uses an authorized mock token account, not a complete NEP-141 token implementation, and does not prove successful token delivery. User-provided testnet receipts confirmed personal-plan funding, 5% savings, savings and available-balance withdrawals, teammate acceptance, allocation, and teammate withdrawal. The redesigned interface has automated DOM tests; wallet signing through the new screens still requires a user check. Mainnet transactions remain unverified.

## Reproduce contract build
On Linux x86_64: `cd contract && npm ci --ignore-scripts`, then from the repository root run `bash scripts/install-toolchain.sh`, `npm run build --prefix contract`, and `node scripts/verify-contract.mjs`. The recovery installer downloads the SDK's pinned official compiler assets and verifies their SHA-256 hashes. CI also runs the frontend build, unit tests, and sandbox scenario. A successful CI run uploads the WASM as an artifact; no deployment or wallet secrets are used.

## Demo
The demo is separate from onchain balances. An example 100 USDC payment with 20 USDC owed to a team and a 5% savings rate allocates 20 to the team, 4 to savings, and 76 to the owner. No yield is simulated. The workspace uses configured testnet accounts and explicit wallet approval.

## Allocation policy
Recipients have fixed entitlements accepted before funding. Each receipt funds outstanding commitments proportionally, with largest-remainder integer rounding. Only the remainder belongs to the owner and is eligible for their chosen savings rate. Savings never reduce another recipient's entitlement. This prototype implements one policy, not arbitrary priority schedules.

## Contract architecture and remaining work
NEP-141 token receiver; agreement acceptance by each participant; immutable activated allocations; user-owned savings balances; pull-based claims with failed-transfer restoration; asynchronous callback accounting and replay protection. A verified yield adapter is optional. If a yield deposit fails, funds remain attributed to liquid savings. Yield must not include unpaid contributor funds.

RHEA is a candidate, not an active integration. Verify token contracts, deposit/withdraw interfaces, active market status and liquidity before implementation. Do not display invented APY or guarantee instant withdrawals. Keep liquid savings separate from yield positions.

## Limits
Only funds explicitly routed through the app can be allocated. No arbitrary wallet interception. Client nonpayment remains possible. An allocation is an accounting entitlement until a real payout succeeds. Demo amounts are simulated. Workspace balances represent actual testnet tokens with no real-money value.

