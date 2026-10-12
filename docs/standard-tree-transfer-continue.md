# Standard 20,000 TREE continue

The game preview uses a standard TREE coin transfer to the approved sales recipient. The separate checkout-publication page redirects to the game. No custom Move package, quote signing key, admin publication, installer or support report is required by the payment flow.

After same-page Sui sign-in, approve **CONTINUE — 20,000 TREE**. SUI gas is separate. The backend independently reads successful checkpoint inclusion, exact sender and TREE balance changes, and the wallet-signed saved-flight reference. Existing durable receipt claims and paid-delivery activation restore **3 lives once** in the same saved wave and score. Continued scores remain casual, never ranked.

The existing `0x1::string::utf8` standard-library call embeds `TREE_FORCE_CONTINUE_V1:<order commitment>` in the same transaction as the normal coin transfer. It returns a droppable string and creates no object. This prevents an unrelated TREE transfer from being used for another account or flight. No custom event decoder or quote signature is involved. Late wallet approvals can still reconcile: a normal transfer cannot enforce an off-chain application deadline.

Transfer continues accept the authenticated immutable saved snapshot, whose structure/hash/ownership are already checked by storage. They do not wait for a manual anti-cheat attestation because their scores are casual. Legacy contract orders retain their review and signed-quote requirements.

## Deployed pilot

- Game commit: `6193e03b8376279666f882f0f8c4e529807af97b`.
- Backend source commit: `b6f6f08df6d12f8b0eb3e0e65fac4fa1937422ed`.
- Game preview: https://deploy-preview-3--treeforce89.netlify.app/
- Hosted `tree-continue-standard`: ACTIVE v4, bundle SHA256 `ef8cecad69b124d2719101bf1bd44645a548810bd2b6652744c5af5da5e5bb7a`.
- The existing approved pilot wallet is enabled for one 20,000 TREE purchase in total. The policy's reserved amount is initially zero. Production game hosting remains unchanged.
- Applied database migration: `tree_continue_standard_transfer_v1`; canonical SQL is `services/canopy-credits/migrations/transfer-commerce-v1.sql`. Public/browser roles still cannot create orders or certify payments directly.

The deployment tool returned internal errors when updating the multi-file bundle. Flattening local modules with pinned esbuild 0.25.9 succeeded. Reproduce the deployable entrypoint with:

```sh
npm exec --yes --package=esbuild@0.25.9 -- esbuild supabase/functions/tree-continue-standard/index.ts --bundle --platform=neutral --format=esm --packages=external --outfile=/tmp/tree-continue-standard/index.ts
```

Deploy that entrypoint with the canonical function's `deno.json`. SDK/database imports remain pinned there. Retrieval of the uploaded source bundle returned a provider internal error; byte-for-byte readback is not claimed. Deployment metadata and real authenticated HTTP/database checks are verified.

## Validation

- Backend workflow `38296081079`: 18 transfer verifier cases, 9 actual PostgreSQL transfer/order/recovery/delivery scenarios, plus existing quote/commerce regression suites passed.
- Game workflow `38296086315`: actual approved-pilot mainnet simulation succeeded with exact +20,000 TREE recipient / -20,000 TREE payer balance effects. Mainnet genesis, metadata precision, finalized checkpoint reader, and the current GraphQL recovery query passed. No transaction was signed or submitted.
- Same game workflow: build and hosted 320/390/1200-width checks passed with zero page errors; `/checkout-setup` returned to the game without any publication UI.
- Actual Phaser/PostgreSQL workflow `38296086337` passed recovery through all ten waves.
- Real hosted preview authentication/database acceptance passed ten checks with an unfunded ephemeral personal-message signer; no purchase or paid entitlement was seeded. Non-pilot checkout stays denied.

Slush's independent website security verdict has **not** been cleared by simplifying payment code. Never bypass a malicious-site warning, change origins to evade it, or claim this implementation removes that verdict. No Slush/Mysten review request was submitted.
