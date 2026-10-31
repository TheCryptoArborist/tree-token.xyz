# TREE FORCE 20,000 TREE continuation

The native game at `/play/treeforce89/` now includes an explicit paid-continuation checkout. After the third life is lost, the player may pay 20,000 TREE to replay the current wave with three lives, preserving the run ID, score and accumulated run statistics. The same option is available after later losses. NFTree ownership still grants entry; there is no entry payment. Payment is optional and requires a separate wallet approval.

The owner selected the existing TREE treasury, `0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f`, as recipient. The canonical mainnet TREE coin is `0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE`. Live mainnet metadata reports six decimals, making each continuation 20,000,000,000 base units. SUI gas is separate. The treasury itself cannot purchase a continuation.

## Payment and recovery

The server authenticates the signed NFTree session, rechecks direct NFTree ownership and issues a wallet/run-specific checkout with an expiry and a mainnet checkpoint anchor. The browser constructs an actual `Transaction` using the pinned Sui 2.37.0 SDK and hands that instance to the existing dApp Kit wallet integration. Wallet configuration and the game dependency lock remain byte-for-byte pinned.

The server independently reads mainnet effects and canonical TREE balance changes. A successful checkpointed transaction must come from the authenticated wallet, occur after the offer's checkpoint anchor and before its expiry, and deliver at least 20,000 TREE net to the confirmed treasury. No browser-supplied amount, recipient, effects or success flag can authorize a continuation. Mainnet gRPC is primary; trusted mainnet GraphQL supports recovery of older receipts pruned from gRPC. Mainnet reader compatibility was verified read-only against a recent receipt and an actual historical TREE receipt; those lookups moved no funds.

The isolated database atomically binds one receipt to one offer and continuation number. Unique indexes and row locks prevent concurrent reuse. Retrying the same confirmed receipt returns the same grant without another payment. A later continuation requires a new offer and receipt. Logout/expiry is rechecked under the lock after RPC work.

The browser stores only the public wallet, offer ID and transaction digest in session storage. Bearer credentials remain in memory. A cancelled or failed transaction grants no lives. A delayed confirmation or lost response offers **Verify existing payment**, not another checkout. After refresh, a fresh signed NFTree login can recover the original paid flight by transferring its current authentication lease to that flight. Pending receipts without a returned digest can be recovered using the wallet's transaction digest. The browser clears pending recovery only after accepting the server's grant.

## Gameplay trust boundary

Phaser reports the interrupted wave, score and run statistics at Game Over. The server authenticates and validates that snapshot and preserves it for the continuation, but does not independently simulate gameplay or establish a server-authoritative score/lives history. These client-reported checkpoints grant no prizes, leaderboard proof or token rewards. On-chain payment confirmation and single-use redemption are server-authoritative.

## Isolation and release

The additive migration is committed at `netlify/database/migrations/20261031045000_tree_paid_continue.sql`; the staged copy is kept identical. It adds nullable offer/snapshot fields and two unique indexes to the existing four-table authentication database. It neither deletes nor rewrites existing rows. Hosted schema changes are applied by Netlify's deploy migration mechanism only.

Read-only verification before promotion confirmed the integration branch's existing database fingerprint `df2f0abee059d9898495a125018fa0a291d50b9050c0d4557231f409bed53065`, distinct from both production databases, and the intact four-table base schema. Both preview and canonical game handlers fail closed on that exact identity and schema. The canonical release retains the explicit server-only binding to this isolated database. The existing DApp database and original TREE FORCE deployment are separate.

`TREEFORCE89_PAID_CONTINUES_ENABLED=true` is required in addition to the verified schema; automatic review previews leave it disabled. The release updates only the isolated `treeforce89-dev` API and native game files/Play description. All 38 unrelated production function packages, their provider/runtime configuration, five schedules and unrelated static paths are preserved from the actual locked live release.

## Validation

Client tests exercise the real pinned SDK transaction object, exact amount/recipient checks, wallet cancellation/failure, duplicate clicks, account changes, delayed verification, reload recovery and malformed grants. Database integration tests cover valid and repeated continuations, same wave/score and three lives, concurrent receipt/offer reuse, incorrect sender/coin/recipient/amount, old/unfinished/failed transactions, logout races, fresh-login recovery and strict same-origin HTTP inputs. Missing unique indexes fail readiness. Fixtures in these tests never transfer funds; CI repeats them against PostgreSQL 16.

A real NFTree holder must complete the final wallet lifecycle and first live 20,000 TREE continuation. The assistant has not signed or submitted any payment. Slush warning clearance is assessed separately and is not implied by a passing build or server test.
