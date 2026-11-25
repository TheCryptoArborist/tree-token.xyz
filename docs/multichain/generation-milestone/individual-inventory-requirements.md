# Individual NFT inventory and artwork requirements

Owner clarification, November 24, 2026. These requirements govern future expanded
cross-chain pass inventory. They do not authorize deposits, minting, delisting,
sales, deployment or changing the retired trial route.

The collection is described by the owner as 5,000 NFTs, each with unique artwork.
Every admitted original must be accounted for individually. An aggregate balance
or fungible inventory count is insufficient to authorize a destination pass.
The intended collection size does not prove that all 5,000 are currently minted,
owned by the dev wallet, available for sale or reconciled. The inherited audit's
18-serial gap remains unresolved until refreshed evidence closes it; this record
is not a new chain inventory audit.

## Sources and allocation

The owner controls two different sources: a random-mint trade pool and already
minted originals in the dev wallet. They must remain distinct in admission data.
The current contracts do not automatically mint from that pool or select from
the wallet when a pass is purchased. Initial expansion should admit explicitly
selected, verified dev-wallet originals through a reviewed deposit process.
No particular batch has been selected by this conversation.

A hypothetical offering of 250 simultaneously available NFT-backed BNB passes
requires 250 distinct admitted originals reserved in custody, one per allocation.
This is a planning example, not an approved batch or an implemented capacity.
Sale/listing conflicts must be resolved before deposit and backing confirmation.
A random-mint source requires its own reviewed claim/mint integration before it
can supply custody inventory. No original may remain separately available for
sale while used as backing.

## Identity and lifecycle per original

Admission and audit evidence must identify:

- Canonical original collection type and exact Sui object ID; serial/display name
  is supplementary and cannot substitute for object identity.
- Source location, current ownership and listing/availability evidence, checked
  again immediately before deposit.
- The original's individual artwork/media URI, verified content hash and metadata
  provenance, plus the destination pass's metadata/artwork mapping.
- Registry/custody identity, lifecycle generation, destination chain, adapter/pass
  contract and token ID, with transaction/message evidence for transitions.
- Current allocation/custody state and redemption/retirement history.

There must be one global authoritative allocation per original across all chains.
Parallel admissions, duplicate deposits/allocations, stale generations/messages,
chain changes, transfers and redemption must not create a second active playable
pass. Missing/ambiguous identity or artwork must block admission/readiness rather
than borrowing another NFT's media. Original artwork is display data, not proof
of current access, ownership or additional IP rights.

## Artwork and existing limits

The destination pass and Arcade must display the artwork of their specific
backing NFT, labeled as an NFTree-backed game pass with original provenance.
A wallet showing cached media must not retain gameplay after burn/redemption.
See run-lifecycle/artwork.md for metadata fields, media checks and wallet testing.
The deployed pass currently lacks tokenURI/baseURI metadata support; a website
change cannot add that contract capability. Expanded inventory and compatible
metadata require reviewed contract/route design and tests. Do not reuse retired
generation 1 or reopen the old trial route.

The current custody registry permits only the exact approved #2720 original.
It has no bulk-admission setter or extra slot. Supporting 250 or the reconciled
collection is separate contract work, not a configuration toggle.

## Relationship to paid continues

Existing Sui NFT holders paying 1 USDT on BNB retain their existing access identity.
That payment is for a continue; it neither deposits their NFT nor creates another
NFT-backed pass. Wallet-link/payment-protocol work may proceed independently,
but cannot be presented as expanded custody or artwork readiness.

Before public pass expansion: reconcile inventory, select the batch, implement
and test per-original global allocation plus metadata, validate artwork in wallets
and Arcade, review the custody/deposit plan, then separately authorize live steps.
Existing Sui authentication, payment, scoring and tournament behavior remains
protected throughout. Preserve the current live site and concurrent Treeforce
work; never deploy the historical root snapshot as the new site.
