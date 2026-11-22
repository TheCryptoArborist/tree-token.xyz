# Validation — November 21, 2026 (America/Chicago)

Local Codex Cloud validation:

- **52/52 Move tests passed** with official checksum-verified Sui
  `1.83.1-6a567faf6de1`, no compiler warnings. Includes singleton allocation,
  wrong type/ID/capability, wrong endpoint/peer/chain, malformed v1/v2/v3 payloads,
  zero request/recipient/generation, duplicate and changed release requests,
  completion-before-release rejection, acknowledgement-without-retirement reuse
  rejection, stale redemption/retirement after reallocation, and owner redeposit.
- **16/16 EVM tests passed** on local Ganache, Solidity 0.8.30, optimizer 200,
  Shanghai target, OpenZeppelin 5.4.0 and LayerZero protocol 3.0.168. Covers binding,
  endpoint/origin/route forgery, conflicting GUIDs, malformed messages, skipped
  generations, private purchase control, exact 25 USDT treasury receipt,
  false/short/no-return/reentrant transfers, ERC721 receiver rejection, current
  owner versus approved operator, replay, transfer-after-lock, pause/retry,
  failed endpoint sends, two complete generations and permanently burned old IDs.
- Move release build produced only the two production modules (vault/codec).
  Solidity release compilation passed. No test helper is part of either release.
- Golden v3 vectors agree across languages, including nontrivial u64 byte order.
- Every file tracked at baseline main is unchanged, checked byte-for-byte against
  Git objects; `validation.json` records the count and release-build digest.
  Root/production builds and live release workflows were not run.
- Fresh stable Sui GraphQL observations confirm candidate #2720's exact identity
  and dev-wallet ownership. A finalized BNB read confirms the fixed USDT address,
  contract presence and 18 decimals. Saved observations are not future deposit
  authority and do not attest to a not-yet-deployed route.

Saved console output: `move-tests.txt`, `evm-tests.txt`. Ganache used its supported
JavaScript fallback because a native µWS binary was unavailable for Node 24.

The tests establish application state-machine behavior under authenticated-peer
assumptions, not an independent audit, live bridge delivery, production access
acceptance or a real-original-NFT deposit simulation. See README.md for remaining
governance, exact-type simulation, route configuration and activation gates.

The new GitHub workflow repeats both test suites and release builds on the
feature branch and PR. Its run status is recorded in the PR checks; do not treat
this local report as a claim that hosted CI has passed before that run finishes.
