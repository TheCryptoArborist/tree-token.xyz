# Application invariant review

This is a source review under the trusted endpoint/peer and unchanged-code
assumptions in README.md, supported by contract tests. It is not a formal
verification or independent security audit.

## At most one allocated entitlement per admitted original

The package initializer creates one Registry. Its sole slot and CallCap can be
consumed only once to create the typed Vault. No public Registry/Vault constructor
exists, and the production registry pins one exact type and object ID. An owned
Move NFT cannot be copied; a deposit wraps it while atomically incrementing the
shared Vault's generation. No second deposit can enter Held or Released.

Released remains allocated until authenticated kind 4 matches the current
request/recipient. Kind 4 can be sent by the paired adapter only after the pass
is Retired and burned. A new reserve is generated only after another successful
deposit. Consequently any next-generation entitlement follows retirement of the
prior entitlement and reacquisition of the actual original. The only destination
is BNB; there is no second-chain allocation interface.

This guarantee is scoped to the approved registry and counterpart deployment.
Another unrelated or malicious package is not an approved global registry, and
must never be accepted by a future entitlement reader.

## A playable contract pass has backing

The only transition into Active is a successful purchase from Ready. Ready requires
an authenticated reserve for the next generation, which Sui can emit only while
holding the approved original. The only custody exit is an authenticated redemption
message from the paired BNB adapter. That adapter derives the payload only from a
Locked pass. Active → Locked disables both playability and transfer before any
release can occur. Locked has no transition back to Active; its only completion
is Retired/burned. A reserve retry cannot change that state.

Thus, under authenticated delivery, Sui cannot release the backing while the paired
pass remains playable. Reordering cannot violate this: premature acknowledgements
fail, early new reserves fail, future/stale generations fail, and identical current
generation retries leave state unchanged. Transport failure affects availability,
not authorization.

## Redemption has one fixed recipient

Only the current ERC721 owner may request redemption. The request commits to wire
version, chain, pass contract, route, NFT, generation, owner and recipient. Locked
state prevents replacing it. Permissionless senders can pay fees but cannot supply
any payload field. Sui rejects zero identities and stores the first authenticated
request/recipient before transferring the NFT. Repeated requests must match, and
repeats never extract a second NFT. Release acknowledgement and retirement confirmation
must match the same record. No admin entry can override the recipient.

## Preservation and boundaries

Admin pause does not bypass a release or create a withdrawal. Purchase pause does
not stop owner redemption or completion; source pause does not stop kinds 2/3/4.
The OApp and upgrade authorities can affect availability or change trusted code;
those governance risks are explicit pre-funding gates, not solved by these tests.

The live Arcade does not consume this new contract predicate. Existing session,
payment, run, scoring and tournament behavior remains untouched and BNB gameplay
continues to be denied. A later integration needs fresh, server-side cross-chain
backing and owner checks; authentication alone never proves entitlement.
