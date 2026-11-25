# Holiday r16 review package

Local frontend package assembled from verified r15 on review branch `dev/treeforce89-feedback-20261123`, base commit `b8154ebf68dc84d0b93823670bfead4cf8333e01`. No push, Netlify build/deployment, payment, backend change or production inventory replacement.

## Package

`release/treeforce-holiday-r16/overlay` contains 51 hashed files: 43 reused reviewed files, seven new r16 modules and the updated game entry. New modules cover the entry/engine/GraphQL import cycle, seasonal score, scenery, music variation and selector/calendar. Existing module names retain their original bytes. The preview clock option is removed from the packaged holiday policy. All 51 hashes verified; new module names contain no local-helper references.

`overlay-plan.json` records hashes, sizes, source baseline and outstanding release prerequisites. This is not a complete site release: do not upload it as the whole Netlify site. A future preservation-aware candidate must merge it against freshly captured production and preserve all backend/provider records, configuration and schedules.

Reproduce with a new output directory:

```sh
node scripts/treeforce-local/package-christmas.mjs release/treeforce-impact-effects release/treeforce-holiday-r16
```

The local test candidate combines the original baseline with the overlay at `release/treeforce-holiday-r16/candidate`, served on port 4199. No wallet review should use this localhost URL from a phone; the eventual hosted review must use the established canonical domain.

## Verification and coordination

The exact r16 candidate passed all ten synthetic wallet/session/save/share browser checks at 390px, with no page errors. The preceding combined holiday report covers controls at three widths, seasonal resume across cutoff, audio lifecycle and automatic countdown transitions. Packaging changes filenames and removes the local calendar override; it does not introduce new gameplay rules.

Read-only inspection of multichain PR #280 at `c66cbceadc8a6db70b3af0885fdb261353aed6cc` found zero changed-path overlap with this holiday work. Its latest authenticated continue composition remains source-only. Its composition report explicitly requires trusted host wiring, runtime/database verification and coordinated drain/cutover; none is activated here. The Phaser restoration harness creates the game from authorized native resume props after adapter consumption. Holiday visuals must stay downstream of that authorization and must never add fields to payment requests or checkpoints.

Current holiday theme preservation covers reconstruction on the same mount. The multichain harness can create a fresh mount, so cosmetic theme continuity there is not certified. Do not treat the passing current Sui-style synthetic reconstruction as proof of the future multichain deployment. No shared SDK, wallet, authentication, receipt or account mapping code was modified.

Existing draft PR #306 remains open at remote head `150749fb1949571504d28691adc954774d546832`; these local holiday files are not yet pushed to it. Batch a substantive review update instead of triggering CI per small change.

## Remaining

1. Recheck current production and integration drift; capture complete fresh inventory and check path collisions before assembling a preservation candidate.
2. Resolve the actual host's continue mount contract if integrating the new multichain adapters; preserve their default-deny authorization and cutover requirements.
3. One canonical-domain owner phone review of the holiday appearance/performance, then separately authorized publication. The original main game has not been replaced.
