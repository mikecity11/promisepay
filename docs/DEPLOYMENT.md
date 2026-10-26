# Separate NEAR deployments

Source supports both networks. Neither deployment exists yet. These are operator instructions, not evidence of deployment.

1. Create and fund a distinct deployment account on each network using your own wallet. Never commit keys.
2. Verify the selected NEP-141 token contract and its decimals on that network. Register the PromisePay account with that token using the token's `storage_deposit`. Recipient accounts also need token storage registration before withdrawing.
3. Build using the recovery instructions in README.md, then run `node scripts/verify-contract.mjs`. Check contract/BUILD.json and the GitHub verification run. Local WASM compilation now passes; blockchain integration verification remains pending.
4. Deploy `build/promisepay.wasm` and call `init({"token_id":"VERIFIED_TOKEN_ACCOUNT"})` in the same transaction from the deployment account. Initialization is restricted to the contract account; repeat initialization is rejected by the SDK.
5. Configure the corresponding VITE_TESTNET_* or VITE_MAINNET_* addresses. No guessed default addresses are provided. Rebuild the frontend after changing environment variables.
6. Call `create_agreement` with 0.1 NEAR attached for bounded agreement storage, a title, up to ten `{account_id,amount}` commitments (decimal strings in token base units), and savings_bps (500 = 5%). Personal mode uses an empty commitments array.
7. Each contributor calls `accept_agreement({id})`. Then fund using the configured token's `ft_transfer_call({receiver_id:contract,amount,msg:JSON.stringify({agreement_id:id})})` with one yoctoNEAR attached.
8. View `get_agreement` and `get_balances`. Allocations are claims, not completed payouts. Call `withdraw({bucket:'available' or 'savings',amount})` with one yoctoNEAR. Check the callback result and actual token balance. Failed transfers restore the claim.

## Release gates

Before a mainnet deployment: compile WASM, exercise sandbox and testnet token transfers, agreement authorization, wrong-token rejection, unaccepted agreement refunds, simultaneous/repeated withdrawals and failed-transfer restoration. Review storage funding, gas and contract upgrade permissions. Unit tests do not establish mainnet readiness.

Yield remains disabled in `get_config`. No yield provider is configured, no funds are lent, and no APY is shown. Verify a provider's active markets, security status and exact interfaces before introducing an adapter. Keep contributor claims out of yield positions.

## Current frontend limits

The network selector and wallet login are implemented. Basic agreement creation, acceptance, funding, balance lookup and withdrawal forms call the wallet helpers. Amount entry currently uses raw token base units. The dashboard is explicitly a local simulation and must not be mistaken for wallet balances. Automated outgoing-transfer savings top-ups are not yet implemented onchain.
