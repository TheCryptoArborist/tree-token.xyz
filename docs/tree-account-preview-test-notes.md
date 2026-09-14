# Step 1 account preview — validation notes

## Confirmed locally

- Reran 22 central identity-service tests plus 10 game-session tests: 32 passed, 0 failed. These use an in-memory conditional-write store and mocked verification/upstream dependencies to exercise the service contracts.
- Rendered the actual authored portal HTML, CSS, and sign-in JavaScript in installed Chromium at 1200x900, 390x844 and 320x700. Verified the anonymous view, simulated EVM connect/sign-in, account UUID display, sign-out, no horizontal page overflow, and zero uncaught page errors. Wallet and HTTP responses were mocked; this is an isolated UI test, not an installed-wallet integration test.
- The first central Netlify preview build at commit 600603b66f01c2eb632fe58fb23d00075caba21e succeeded. Its configured build runs the 22 service tests plus five signature tests that use actual generated Sui and EOA signatures; contract-wallet delegation/outage tests use a stub RPC client.
- The game preview at commit 63f73901c5c597229ce504d3764317a376c8f856 reports a successful test-gated deployment.

## Configuration/release boundaries

The central preview was built before the explicit function-scoped preview environment values were added. This commit triggers a configured redeploy. Use the stable paired preview addresses from tree-account-step1-preview.md, not immutable deployment aliases, because the authentication origin allowlist is exact.

PR 18 remains DRAFT and must not be merged. It targets main solely to meet the hosting platform's preview-build policy, but the head preserves the older NFTree access foundation. Its comparison to main contains pre-existing foundation changes. A future production integration must extract the reviewed identity changes onto an approved portal baseline, not merge this entire preview branch.

## Not verified

Live API requests and installed-wallet popup sign-in could not be exercised from this runtime because outbound browser access was blocked. Successful builds do not prove that deployment runtime configuration, external wallet UX, or live contract-signature RPC requests work end-to-end. Test those with a real wallet before declaring Step 1 accepted.

No Sui/EVM funds were moved, no token approvals were requested, no production branch was updated, and no production rollout is authorized. NFTree entitlement, optional multi-wallet linking, synced pilot fields, shared verified records, and paid continues remain separate work.
