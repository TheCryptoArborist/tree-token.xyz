# Netlify schema and gateway boundary rehearsal

Latest: [wallet-link and checkout review UI](bnb-review-ui.md).

Latest: [authenticated BNB checkout boundary](bnb-http.md).

Latest: [native BNB checkout/session bridge](native-bnb-checkout.md).

Latest: [explicit BNB wallet-link protocol isolation](link-protocol-v2.md).

Latest: [BNB recorded-payment import and journal](bnb-journal.md).

Latest: [BNB payment completion verification](bnb-completion.md).

Latest: [verified native payment completion](completion.md).

Latest: [pending stores and recovery controls](recovery-controls.md).

Latest: [bundled native offer and shared checkout](bundled-checkout.md).

Latest: [host assembly and canonical checkout transport](host.md).

Follow-on: [authenticated composition and cutover tests](composition.md) now
implements the HTTP adapters; the earlier remaining-work notes below describe
the initial dispatcher milestone. Hosted wiring and activation remain pending.

November 24, 2026 (America/Chicago). Source and disposable local tests only.
No hosted migration, route registration, deployment or payment activation.

The successful hosted catalog audit in `../native-database-audit/` found the
existing native database healthy, with no private schema or proposed shared
tables. This proposal uses its existing `netlifydb_owner` and
`netlifydb_readonly` roles, not Supabase roles. Ten private tables combine the
seven shared native/session/delivery tables and three BNB ledger tables.
`schema-sources.json` hashes the four input schemas; regenerate/check with:

```
node scripts/multichain/build-netlify-continue-schema.mjs
node scripts/multichain/build-netlify-continue-schema.mjs --check
NETLIFY_CONTINUE_SCHEMA=1 BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-native-sui-session-postgres.mjs
node --test tests/multichain-native-gateway.test.mjs
```

Install the existing pinned pg dependency with `npm ci --prefix
vendor/bnb-continue-store --ignore-scripts`. PostgreSQL binaries must run as a
non-root OS user. Set BNB_PG_SHARE if using relocated PostgreSQL binaries. Tests
create temporary databases on Unix sockets and remove them afterward; they do
not accept a hosted connection URL.

## Evidence and permission limits

`local-database-tests.json`: 35 checks passed on PostgreSQL 17, including native
payment recognition, atomic redemption/counter rollback, replay denial,
credential recovery, owner-role evidence mutation denial and readonly denial.
The unchanged restricted-role variant also passed all 33 checks. Five gateway
tests passed, including composition with the actual authenticated restore HTTP
handler. These gateway tests use injected services; they are not a deployed
native runtime or a complete payment flow. Hosted PostgreSQL 18 migration
execution is not yet tested.

Native columns and relation grants remain identical through the rehearsal.
Reapplying the proposal fails and rolls back without overwriting an existing
private schema. The proposal is deliberately outside automatic migration
folders. Do not run it until the exact database identity, fresh schema baseline,
backup and migration review are established.

Netlify's owner bypasses RLS on its own tables. The test caught that the original
insert-only evidence grants do not restrict an owner: this proposal adds explicit
UPDATE/DELETE/TRUNCATE denial on native Sui payment evidence. Existing lifecycle
triggers remain. This does not constrain malicious owner DDL or make every table
append-only. Server validation and trusted owner credentials remain essential;
a separate restricted runtime role would require an additional hosting review.

## Gateway scope and remaining work

`scripts/multichain/native-continue-gateway.mjs` is an undeployed dispatcher.
Default legacy mode preserves existing native routes. Shared mode blocks the
three legacy payment routes and requires prepare/activate/record/recover/offer
adapters together. Failed policy, missing adapters and handler errors deny with
no payment request or restoration grant, never falling back to old redemption.
Ordinary native authentication and game paths keep their original handler.

Next: implement and test the record/recover/offer HTTP adapters and a complete
composition against the pinned native runtime, then run the actual browser
through that composition. The current dispatcher requires those adapters but
does not implement them. Add a durable cutover procedure: a mode flag alone does
not stop requests already executing on an older deployment. Drain/block legacy
payment writers and test overlap/recovery before enabling shared consumption.
Do not claim cross-version race safety from these dispatcher tests.

The host must obtain mode from trusted reviewed configuration. No endpoint or
client can select it. Complete both-chain settlement, preserved native gameplay,
scoring and tournament checks before reviewing any live activation.

Concurrent Treeforce work remains isolated: reviewed remote
`review/treeforce-canonical-r15` at
`1d6f47984e55cff1b3ec010455b37828fd5c0067` describes an additive
`/play/treeforce89/review/` publication preserving the game/backend. No files on
that branch were changed. Refresh both branches and the complete live inventory
before integration/publication; do not publish the historical root build.
