# TREE FORCE participation frontend inputs

The original game is pinned to `TheCryptoArborist/treeforce89` commit
`a38e08e37e1f71ea41b86add8e26a92b0789cf22`. Its own package and dependency
lock remain unchanged. Install and build it only in an isolated checkout.

`integration/` contains exact recovery copies from
`TheCryptoArborist/tree-token.xyz` commit
`4cd2119a3fefc3b6078befd01ad4f63fb74a695a`. That record contains the paid
continuation, canonical-route, and HUD overlays published from
`1dce0e0d9b6ef112f3bbc92124022d5e16e5e836`.
`integration/provenance.json` records each recovered file's SHA-256.

The untouched reconstruction matched all 13 current native frontend file
digests in deployment `6ae65d956e30582ff6f5baa2`.
`baseline.json` preserves that comparison, including the original
`index-CCisCLQF.js`, `arcade-Cw4Df7W2.js`, and `graphql-hAFrFTxs.js` assets.

`apply-participation.mjs` bridges only a normal first-wave start to the React
gateway. The new client reports participation, never a score or completed run.
Public home/title screens, paid resumes, and URL test entries do not create
reports. A pending report can be retried only under the same wallet and run.

Build with:

```sh
node scripts/build-treeforce-participation.mjs baseline ISOLATED_SOURCE EMPTY_OUTPUT
node scripts/build-treeforce-participation.mjs candidate ISOLATED_SOURCE EMPTY_OUTPUT
```

Candidate builds first reproduce and verify the complete baseline, then apply
the participation overlay. They do not install dependencies, build backend
functions, modify the root package files, or deploy anything. Public release
files are copied separately from the generated manifest; existing historical
assets must remain in the deployment inventory.
