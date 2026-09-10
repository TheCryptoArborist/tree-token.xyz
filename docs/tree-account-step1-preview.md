# TREE Account — step 1 preview

This is an isolated identity foundation in the central TREE Arcade repository, paired with TREE FORCE '89. It does not change production, the existing Sui game contracts, NFTree ownership, or Canopy Credits. The foundation branch is not merged.

## Test addresses

Game: https://deploy-preview-1--treeforce89.netlify.app/
Central sign-in: https://deploy-preview-18--tree-token.netlify.app/play/account/

Start from the game's SIGN IN button. The popup establishes the game's one-use state and PKCE challenge before going to the central page. Sign with either Sui or EVM, select Continue to TREE FORCE '89, and return to the original game tab. A direct visit to the central page signs into the central preview only; open SIGN IN in the game to authorize that game's session.

## Delivered scope

- Standalone Sui Mainnet personal-message authentication, using the existing Sui wallet manager and official Mysten server verification. No transaction or ownership write.
- Standalone EVM SIWE on BNB Smart Chain Testnet (97) and Robinhood Chain Testnet (46630). Uses EIP-6963 wallet discovery with injected-wallet fallback. viem verifies EOA signatures; the public client provides contract-wallet verification on the signed chain. Actual installed-wallet and contract-wallet RPC acceptance must still be tested.
- Random account UUID stored centrally under a verified alias. Reauthenticating the same Sui wallet, or the same EOA across the two EVM testnets, resolves the same preview identity. Contract aliases are chain-specific to avoid conflating different contracts at identical addresses.
- Five-minute browser-bound challenges, atomic nonce consumption, rate limits, thirty-minute HttpOnly/Secure/SameSite=Lax sessions. Tokens are hashed at rest and never placed in localStorage or message payloads.
- Sixty-second one-use game grants bound to the exact game origin and PKCE challenge. The game's server exchanges the grant, sets its own HttpOnly cookie, and reads identity server-to-server. Callback state, issuer, origin, expiry and identity fields are validated. No wildcard CORS or arbitrary redirect targets.
- Central logout invalidates dependent game sessions at their next verification. Game logout revokes its own child session only. Frontend identity is display context; later score, access and payment APIs must authenticate the server session themselves.
- Existing guest scores and achievements remain browser-local, unchanged and unverified. They are not imported, merged or promoted. Signing in does not grant NFTree access, credits or verified rankings.

## Isolation/configuration

Only deploy-preview function-scoped values were added:
Central site: TREE_ACCOUNT_PREVIEW_ENABLED=true; TREE_ACCOUNT_PREVIEW_ORIGIN=https://deploy-preview-18--tree-token.netlify.app; TREE_ACCOUNT_GAME_ORIGIN=https://deploy-preview-1--treeforce89.netlify.app.
Game site: TREE_ACCOUNT_AUTH_ORIGIN=https://deploy-preview-18--tree-token.netlify.app; TREE_ACCOUNT_GAME_ORIGIN=https://deploy-preview-1--treeforce89.netlify.app.

The central identity store is a new `tree-account-preview-v1-<hash-of-origin>` strong-consistency Netlify Blobs namespace. It never reads or modifies production accounts or a financial ledger. Stable preview hostnames must be used; immutable deploy hostnames are intentionally rejected for authentication. These are preview identities, not a completed production account migration.

## Not implemented in step 1

Optional account-level wallet linking/recovery, NFTree entitlement lookup or purchase, pilot profile/callsign synchronization, verified online scores and achievements, Canopy Credits balances, and paid continues remain separate steps. Existing dual-wallet NFTree verification is left intact; its browser-local linked proof is not silently imported as a central account or automatically merged. A future linking flow must require an authenticated session and fresh signatures, resolve conflicts explicitly, and revoke old sessions. Never auto-merge funded accounts.

Expired authentication records are rejected during reads. Add an explicit retention/cleanup policy and production-grade abuse monitoring before public rollout. The storage adapter is only for this non-monetary preview; it is not a substitute for the approved transactional credit ledger.

## Verification

32 dependency-free tests passed locally: 22 central identity tests and 10 game BFF tests. Central preview build also runs 5 official-SDK signature tests, including actual generated Sui and EOA signatures; contract verification delegation/outage tests use a stub RPC client. Deployment success alone is not an installed-wallet end-to-end pass.

Acceptance: sign in from the game using a Sui-only wallet; repeat with an EVM-only wallet on each testnet; decline a signature; switch accounts mid-signature; retry expired/replayed callbacks; reopen from another device with the same wallet; sign out centrally and confirm game identity clears; confirm local scores and all gameplay remain unchanged. No deposit, token approval or payment is required for these tests.
