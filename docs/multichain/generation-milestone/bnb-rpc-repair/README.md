# BNB handoff read RPC repair

The user saw “RPC endpoint returned HTTP client error” after the verified first
adapter deployment. The screenshot alone cannot identify the exact failing RPC
method or the wallet's configured endpoint. Independent reads reproduced the
complete next-step review successfully, and the existing Sui receipt endpoint
was healthy. The page previously depended on the wallet's RPC for every BNB read.

The page now falls back to `https://bsc-rpc.publicnode.com` after a wallet read
fails. It checks chain 56, bounds request time, validates RPC envelopes and permits
only an explicit list of read methods (including non-submitting gas estimation).
Further reads use the backup for that connection. No account requests, chain
switches, signatures or submissions can enter the fallback. Wallet permissions,
network checking, the selected Ledger account, transaction bytes, approval cap,
receipt checks and saved progress format are unchanged. Errors identify the read
method that failed. If both read transports fail, signing stays disabled.

Validation: 39 focused tests passed, covering receipt and preservation regressions,
failed wallet RPC, wrong backup chain, malformed responses and rejection of all
signing/submission methods. Six browser scenarios passed, including all three
steps with wallet read failures and successful backup responses. A real read-only
review using the user's verified adapter receipt, with simulated wallet transport
failure, prepared step 2 successfully: remaining fee-limit allowance at that quote
was 0.0001181764 BNB. The deployed adapter remains unbound; no transaction was sent.
Public RPC responses allow the canonical origin via CORS. Real wallet retry is
still for the user to perform.

Reproduce from the repository root:

```
node tools/bnb-generation/build.mjs
node --test contracts/bnb-generation/test/read-rpc.test.mjs contracts/bnb-generation/test/handoff.test.mjs tests/bnb-rpc-release.test.mjs
node contracts/bnb-generation/scripts/handoff-browser.mjs
```

Release changes only `/play/bnb-generation/app.js`, capturing fresh baseline
`6b03a2c688e99f705a3b9f3e` (the newer Canopy mobile review). Preserve all other paths,
all 54 complete backend records, five schedules and protected configuration.
No root build or backend rebuild is involved. The existing localStorage progress
key is retained. After publication, reload the same canonical page, reconnect the
Ledger admin and check receipts before refreshing step 2. Do not redeploy adapter.

Published and locked: `6b03af26a54fc9961a7944cc`; see `publication.json`.
Canonical assets passed all six scenarios. Reload the same page with Ctrl+Shift+R,
connect MetaMask, Check receipts, then Refresh deployment review. Saved adapter
progress is retained. Signatures and submissions still require MetaMask/Ledger.
