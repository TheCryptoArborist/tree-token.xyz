# NFTree multichain website preview

Branch-only review page: `/play/multichaintest/`. First chain BNB, suite pass 25 USDT,
in-game payments USDT, first game Tree Force ’89. This is a connection preview;
it does not implement pass issuance, eligibility, payments or game integration.

The page is derived from the prepared Tree-Multichain-Web-Files.zip (2026-11-12).
Its bundled SDK prefix is retained in wallet-vendor.js with the original licenses.
The original application's pilot bytecode and transaction-publication handlers
are excluded. A readable connection-only app uses the same existing bundled
dApp Kit and gRPC client; no dependency or SDK upgrade is made. Auto-connect
and the Slush web-wallet fallback remain off. Connection is optional. The page
uses its actual origin for copy/open-in-Slush links, including on Netlify previews.
Do not bypass a wallet security warning; this release does not establish that
Slush has cleared its earlier warning for the old signing host.

Only the feature-preview build includes these three page files. Production
snapshot build, manifest, production functions, scheduled jobs, existing games,
wallet/session/payment modules and Netlify configuration are unchanged. A Netlify
Deploy Preview is a separate wallet origin and uses the repository's existing
read-only preview functions. It must not be promoted as the production site.
Publication under the canonical domain requires a separately verified additive
release from a newly captured complete live inventory.

Validation: `node --test tests/multichain-preview.test.mjs tests/sti-preview-build.test.mjs`.
The existing snapshot test now counts the three explicit preview additions and
continues verifying byte-exact production output and every other preview path.
No wallet signature, blockchain transaction or token payment is part of validation.

Guidance consulted: current MystenLabs/skills README,
frontend-apps/SKILL.md and frontend-apps/non-react.md. The repository's own
AGENTS.md and production/README.md govern deployment preservation.
