# Canopy Breaker Telegram completion integration

The read-only `/play/canopy-breaker/api/completions` route derives results from
server-replayed saved runs. Terminal `won` and `gameover` runs are included,
including runs that do not beat a personal best. Pauses and active runs are not.
No new database schema, score write endpoint, credential, or wallet permission
is introduced. No changes to payment or NFT access handling are required.

Output is limited to an opaque MD5 fingerprint of the random run UUID, terminal
status, score, grove, saved timestamp, and optional already-public username.
Wallets, raw run UUIDs, payment details and sessions remain private. Missing
usernames use an anonymous label in Telegram. SQL uses bound timestamp/hash
cursors, deterministic ordering and 100-row pages. Responses disable caching.
POST and malformed cursors are rejected; database errors do not reveal details.

The Railway gardenbattles notifier polls this route every 30 seconds, records its
baseline before enabling, skips historical results and deduplicates by run
fingerprint. Telegram failures retain progress for retry. A paid continue creates
a new run, so its eventual ending produces a new alert. Existing Garden Bot,
NFT mint and purchase alerts are unchanged.

Validation: six completion endpoint tests and four Railway listener tests pass;
existing non-database Canopy tests pass; syntax checks and isolated hosted build
pass. Two existing database test files could not start NetlifyDB in this runtime
(the isolated database startup exits with status 137), so these require a runtime
where the test database can start. The completion endpoint does not write data.

Release target is the isolated `canopy-breaker` Netlify project only, site ID
`f054a440-1ff7-4fac-85da-3b8b9afcf8b0`. Verified prior production deployment:
`6aef64eb6cafc47f69d4fcdb` with one breaker-access function and no schedules.
Do not deploy the parent Tree Token historical build. Publish the new feed first,
verify HTTP 200/405 and private-field exclusions, then release the Railway listener
and verify the one-time activation message. Do not claim activation before this.
