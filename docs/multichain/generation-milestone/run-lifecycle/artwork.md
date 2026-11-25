# Original artwork on every destination-chain pass

User requirement, November 24, 2026: a purchaser arriving from BNB or another
non-Sui chain should be able to enjoy the artwork of the original NFT backing the
game pass, both through the pass in compatible wallets and within the Arcade.
The display must clearly say **game pass backed by NFTree**, identify the original
collection/token and link to its Sui provenance. It must not imply the wallet
holds the original Sui NFT or that the pass grants additional artwork/IP rights.

## Inspected gap

`contracts/bnb-generation/src/TreeSuitePass.sol` inherits OpenZeppelin ERC721
without overriding `tokenURI` or `_baseURI` and has no metadata setter. The pinned
ERC721 implementation returns an empty URI for an existing token when the base
URI is empty. Burned tokens revert at `_requireOwned`. The current pass therefore
supplies no standard image metadata for wallets to render. This is a source
finding, not a claim that a live wallet rendering test was performed.

The existing deployed contract cannot gain a setter through a website update.
Do not redeploy, redirect an existing backing route, remint retired generation 1,
or promise that a metadata refresh alone fixes it. A wallet-compatible contract
revision/new deployment and its custody/adapter route plan need separate review.
An Arcade-only artwork panel is possible through the trusted backing mapping but
does not solve the wallet metadata gap.

## Required next design and tests

- Resolve original identity, display image/media and provenance from the approved
  original collection; confirm what the image represents and applicable rights.
  Use the generation registry's original ID, never a client-selected image/URL.
- Define stable ERC-721 JSON metadata with `name`, `description`, `image`, canonical
  `external_url`, original collection/object ID, source/destination chains and
  generation. Preserve the original artwork; label the pass in metadata/UI.
- Choose durable media hosting and pin/content-hash the approved asset. Review
  MIME types, broken media behavior, safe rendering, attribution and availability.
  Any external image URLs are media, not wallet-connect or signing pages; wallet
  handoffs remain exclusively under `https://tree-token.xyz/play/`.
- Ensure different originals cannot show each other's artwork; transfers retain
  the correct mapping, new generations cannot reuse a retired entitlement, and
  burning/redeeming removes access even if a wallet caches an old image. Artwork
  is presentation, never evidence of current eligibility.
- Test tokenURI JSON and media resolution, then actual MetaMask/Ledger NFT display
  and Arcade rendering. Wallets vary in auto-discovery, metadata refresh and media
  support; document supported behavior and any manual import procedure.
- Make artwork readiness a prerequisite before another paid pass trial. No new
  contract, deposit, purchase or public sale is authorized by this requirement.

This turn records the requirement and source gap; it does not change the deployed
pass or claim wallet artwork support is already available.

The owner clarified that each of the collection’s described 5,000 originals has
individual artwork. Expanded custody must account for each admitted object
separately; see [individual inventory requirements](../individual-inventory-requirements.md).
