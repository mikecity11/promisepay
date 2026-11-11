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

PromisePay helps medium-sized businesses turn project payments into team allocations, business reserves, and available working capital. Agencies, contractors, service companies, and production businesses are the primary audience; creators and larger organisations are additional audiences. Dollar examples represent USDC amounts, not bank-dollar payment support. Business roles, multiple approvers, accounting integrations, and production-scale indexing are future work.

## Current status
Pre-hackathon preparation, created October 26, 2026. Do not represent this work as created during November 1–14. Confirm eligibility with organizers before using pre-event implementation in a submission.

Implemented source: deterministic accounting; agreement acceptance; authenticated NEP-141 receiver; contributor claims; personal liquid savings; callback-based withdrawal restoration; testnet/mainnet configuration; wallet login and a simplified workspace. Testnet contract: `promisepay-mikecity.testnet`, initialized with Circle testnet USDC. [Deployment transaction](https://testnet.nearblocks.io/txns/13yVg9X8un3KhxqxaL91BS6ZoJeMew5nzhSX1gKgPkXe). Mainnet has no deployed contract. Optional wallet-owned RHEA lending is enabled on testnet.

## Run
`npm ci`, `npm test`, `npm run dev`. Production frontend: `npm run build`. Copy `.env.example` to `.env` to use the verified testnet contract and token accounts. Mainnet accounts must be independently verified and configured before use. Empty configuration blocks wallet actions. See docs/DEPLOYMENT.md.

## Validation
24 Node tests pass, including contract-method tests with a mocked NEAR host, exact token arithmetic, wrong-token and unaccepted-agreement rejection, withdrawal accounting, and network guards. The frontend production build passes. Mocked-host tests strip SDK decorators and do not test WASM, SDK access control, or real cross-contract execution.

The compiler blocker is resolved. Contract WASM compilation and export validation pass. The build is 549,487 bytes; SHA-256 and source fingerprints are in contract/BUILD.json. The only callable exports are the nine intended public methods.

Local sandbox execution was attempted but stopped before contract execution: near-sandbox requires 65,535 file descriptors and this environment permits 16,384. The sandbox scenario is preserved in integration/sandbox.mjs, and the GitHub verification workflow will attempt it on a standard runner. That scenario uses an authorized mock token account, not a complete NEP-141 token implementation, and does not prove successful token delivery. User-provided testnet receipts confirmed personal-plan funding, 5% savings, savings and available-balance withdrawals, teammate acceptance, allocation, and teammate withdrawal. The redesigned interface has automated DOM tests; wallet signing through the new screens still requires a user check. Mainnet transactions remain unverified.

## Reproduce contract build
On Linux x86_64: `cd contract && npm ci --ignore-scripts`, then from the repository root run `bash scripts/install-toolchain.sh`, `npm run build --prefix contract`, and `node scripts/verify-contract.mjs`. The recovery installer downloads the SDK's pinned official compiler assets and verifies their SHA-256 hashes. CI also runs the frontend build, unit tests, and sandbox scenario. A successful CI run uploads the WASM as an artifact; no deployment or wallet secrets are used.

## Demo
The demo is separate from onchain balances. An example $10,000 USDC payment with $6,000 owed to recipients and a 10% reserve rate allocates $6,000 to the team, $400 to reserves, and $3,600 to available working capital. No yield is simulated. The workspace uses configured testnet accounts and explicit wallet approval.

## Allocation policy
Recipients have fixed entitlements accepted before funding. Each receipt funds outstanding commitments proportionally, with largest-remainder integer rounding. Only the remainder belongs to the owner and is eligible for their chosen savings rate. Savings never reduce another recipient's entitlement. This prototype implements one policy, not arbitrary priority schedules.

## Contract architecture and remaining work
NEP-141 token receiver; agreement acceptance by each participant; immutable activated allocations; user-owned savings balances; pull-based claims with failed-transfer restoration; asynchronous callback accounting and replay protection. A verified yield adapter is optional. If a yield deposit fails, funds remain attributed to liquid savings. Yield must not include unpaid contributor funds.

RHEA is integrated as an optional wallet-owned testnet lending position, separate from the PromisePay ledger. Do not display invented APY or guarantee instant withdrawals. Keep liquid savings separate from yield positions.

## Limits
Only funds explicitly routed through the app can be allocated. No arbitrary wallet interception. Client nonpayment remains possible. An allocation is an accounting entitlement until a real payout succeeds. Demo amounts are simulated. Workspace balances represent actual testnet tokens with no real-money value.



## Optional RHEA savings lending (testnet)

Savings held in PromisePay remain liquid and do not earn interest. The Savings screen offers a separate, wallet-owned RHEA supply position. This is an explicit two-step flow, not automatic yield routing:

1. Register the connected account with RHEA if needed (live storage minimum; currently 0.1 test NEAR).
2. Withdraw the chosen PromisePay savings amount to that wallet. Wait for FINAL and a successful withdrawal callback.
3. Choose Continue deposit; separately approve USDC `ft_transfer_call` to RHEA with an empty message. Confirm FINAL, no receipt failures, and the full amount consumed.
4. Read `get_account` supplied balance and live `get_asset` supply APR. APR changes and is not a promise of returns. Balances include outside-app supplies; they are not an app-specific earnings calculation.
5. Withdraw with RHEA `execute` / `Withdraw`. Confirm a matching NEP-141 USDC transfer before reporting success. Returned funds are in the wallet, not the PromisePay ledger. Withdrawals depend on market liquidity.

Pinned market: `contract.1689937928.burrow.testnet`; only the configured Circle test USDC is enabled. Its extra precision is read from the live asset config (currently 12). The app does not borrow or enable collateral. Mainnet remains disabled. Continuation reminders are local to the browser/account/network; clearing browser storage removes the reminder but does not move or lose wallet funds.

Primary references: [RHEA SDK](https://github.com/burrowHQ/burrow-sdk-python), [contract API](https://github.com/NearDeFi/burrowland/blob/main/contract/API.md), [token receiver implementation](https://github.com/NearDeFi/burrowland/blob/main/contract/src/fungible_token.rs), [RHEA withdrawal implementation](https://github.com/burrowHQ/burrow-cash/blob/main/store/actions/withdraw.ts).

Validation: automated precision, deposit-refund, transfer-proof and DOM review tests; read-only live market/config checks. The user completed a $0.05 test USDC deposit and withdrawal on November 11, 2026, reported the funds returned to their wallet, and provided screenshots showing the supplied balance change from 0.05 to 0.00 USDC. Automated tests do not prove protocol safety. Use test tokens only.
