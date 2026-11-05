# Arcade Missions sign-in refresh fix

The user reported three approvals/transactions while signing in. Source inspection found one explicit Wallet Standard connection and one personal-message signature per successful sign-in, with no transaction submission capability in the Arcade adapter. Check-ins and quest requests reuse the saved session without signing. This does not establish what appeared in the user’s wallet UI.

A reproducible adapter defect could cause repeated signing attempts: a Wallet Standard accounts-change event containing the same authorized mainnet address incremented the connection generation during signing. A valid signature was then discarded as a wallet change. The focused fix refreshes that same-address account object without invalidating the pending signature. Removal, unsupported accounts, a real address switch, a disconnected/replaced wallet, and stale results still invalidate through the existing clear()/generation guards. Server challenge, signature, origin, session and NFTree checks are unchanged.

The regression test failed before the source fix with “The wallet changed during verification. Please connect again.” It passes after the fix. Controller integration covers two same-account notifications during one approval: one connection, one signature, one challenge/session, then progress refresh and check-in without another signature. Existing account-switch and rejection tests remain intact.

Guidance checked live: MystenLabs/skills README, frontend-apps/SKILL.md, frontend-apps/transactions.md (personal-message authentication). This is a focused correction in the existing pinned adapter, with no SDK migration or dependency update. Existing vendor/nftree-mint/package-lock.json is reused for the bundle build.

The publication overlays only assets/arcade/arcade-growth-wallet.js over baseline 6aebe7578c57bc8e8c7e1b53. All 43 complete function/provider records and exact packages, five schedules, 50 environment entries and unrelated static files must remain exact. No standard dashboard build or backend rebuild. No real wallet signature or transaction is performed by the agent; a user retest is needed to establish whether this accounts for the reported three prompts.

Validation: 11 wallet-adapter behavior checks and 57 controller/social/campaign UI checks passed. The rebuilt module uses the exact pinned dependency versions. After normalizing build-path comments, its only executable change is removing the generation increment for a same-address account refresh. The canonical deployed adapter hash matched the inspected baseline before release.

Published and locked deploy `6aebec00ada2550dc6f59eee` at `2026-11-05T02:39:51.291Z` from source `4effd89502ee8f6215cbbf942a71436f54539ec7`. The canonical asset matches the tested bundle exactly. All 43 original complete function/provider records, five schedules, 50 environment entries and 289 unrelated files remained exact.
