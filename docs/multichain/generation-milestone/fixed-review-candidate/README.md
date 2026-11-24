# Isolated generation-1 review replacement

This candidate replaces only `arcade-bnb-run-review`. Its frozen package policy
is `review-only`, approved generation `1`, and `gameplayAuthorized: false`.
It reuses the existing database binding without changing any environment value.
Any legacy review enablement or generation setting fails closed before reading
credentials. Another generation requires an explicit source/package review;
client input or environment values cannot widen the policy.

The first environment-based attempt requested all 61 function ZIPs. This
replacement instead preserves every static path, all other 60 complete function
provider records, five schedules, runtime and protected environment metadata.
The candidate builder accepts at most one upload: the exact new review ZIP.
An unrelated upload requirement stops the process before uploading any package.
The builder has no environment-mutation or publication API path.

## Checks

- Fixed policy, conflicting legacy settings and incomplete database binding.
- Real handler denies unauthenticated requests and missing platform context
  without network calls; no cookies or gameplay grants are returned.
- Existing HTTP/coordinator tests retain origin, forged identity, replay,
  expiry, revocation, ownership loss, stale proof and retired backing denials.
- Extracted ZIP is loaded outside the checkout and tested with both conflicting
  legacy settings and a valid-shaped binding plus missing identity. No database
  credential is put into the ZIP; smoke credentials are synthetic test strings.
- Candidate request preserves all 691 static paths and 60 unrelated packages;
  generation expansion, missing rate limits and missing smoke proof are rejected.
- Hosted candidate verifies complete provider/runtime records, inventory and
  unchanged environment before/after. The noncanonical candidate denies origin;
  the canonical production route must remain disabled throughout this stage.

Commands:

```
node --test tests/bnb-fixed-review-candidate.test.mjs tests/multichain-bnb-run-runtime.test.mjs tests/multichain-bnb-run-http.test.mjs tests/multichain-bnb-run-authorization.test.mjs
node scripts/package-bnb-run-review.mjs --outdir /tmp/FRESH-PACKAGE-DIRECTORY
node scripts/create-bnb-fixed-review-candidate.mjs /tmp/FRESH-PACKAGE-DIRECTORY /tmp/FRESH-EVIDENCE-DIRECTORY
```

The final command requires the existing Netlify CI binding. Do not export it.
No Sui contract, reader, SDK, authentication, payment or game implementation is
changed. Existing chain evidence shows generation 1 retired/completed; this
policy does not make that pass eligible. No wallet transaction is needed.

## Remaining publication checks

Independently revalidate the reviewed artifact hash, source and complete live
baseline, wait for all queued builds, and publish only the newly verified
candidate. Then check canonical no-cookie 401, nonexistent-session 403, unchanged
existing BNB authentication, fresh retired-chain denial and zero review records.
Do not claim authenticated live-wallet acceptance from negative request tests.
If a fix is needed after publication, publish a fresh corrected isolated package
while preserving all other production records; never restore an old site build.
Public sales, payment, new custody/generation allocation and gameplay are separate
milestones. The manual retention ownership arrangement remains unchanged.
