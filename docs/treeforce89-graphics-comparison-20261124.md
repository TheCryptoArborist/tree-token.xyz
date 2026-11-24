# Graphics benchmark: corrected Tree Force and supplied Deluxe Galaga

The comparison is complete; a claim of full graphics parity is **not** supported. Tree Force has a coherent, more detailed environment and preserves the Tree Hero/Arborwing identity. The reference still provides a stronger benchmark for simple threat separation and expressive internal enemy animation. This is a visual judgement based on retained captures, observed reference behavior and inspected game code, not a numerical quality score.

## Evidence and decision

| Area | Reference evidence | Corrected Tree Force | Decision |
| --- | --- | --- | --- |
| Combat contrast | Bright, compact sprites/shots over mostly black stars | Forest detail remains behind threats, with the new dark layer and reduced foreground opacity | Improved; test in motion on a bright phone before further darkening artwork |
| Enemy animation | Observed banking changes wing/body silhouette | Path tangent determines heading; ordinary bat/wasp switch between two wing poses; special identities retain their own textures | Clear remaining polish opportunity; a rotated two-pose sprite does not establish equivalent banking animation |
| Hero and identity | Small pale craft clearly separated from background | Distinctive Arborwing, five growth stages, retained art and verified bounds | Retain the approved hero; do not replace it to imitate the reference |
| Hit/death response | Localized bursts in retained captures; richer debris described in the manual | White hit flashes and gold warnings now persist; many events share rectangular leaf bursts | Timing fixes work; event-specific impact shapes/materials remain a polish opportunity |
| Boss presentation | Limited reference coverage; no equivalent complete boss sequence established | Reviewed boss clears HUD; health/phase feedback is distinct | No justified claim of comparative boss superiority or missing reference feature |
| Result cards | Reference bonus/statistic screens emphasize earned results | Wave-attempt points and target/completion totals are explicit; repeat pauses shortened | Current treatment is readable in corrected captures; preserve score/timing semantics |

The supplied software is Edgar Vigdal's Deluxe Galaga v2.6 for Amiga (1995), not Namco's original arcade ROM. The earlier analysis booted the supplied disk in FS-UAE and retained sampled scenes. Its manual's whole-game animation count is not evidence that all frames were decoded or observed. No original game assets/music are being incorporated into Tree Force.

Review board: [HTML](treeforce89-graphics-review-20261124/index.html) and [actual image](treeforce89-graphics-review-20261124/comparison.png). The paired images are not frame-synchronized or equal-resolution measurements. The Tree Force combat/boss captures predate the input-only correction, which changed neither graphics helpers nor art.

## Screenshot-test correction, not a gameplay fix

The earlier challenge-result capture appeared to show “HI” over the Pause label. Inspection established that the test destroyed **all** depth-25 objects while removing its synthetic result cards. The real Pause background also uses depth 25, so the test removed it and exposed the old text beneath it. This did not establish a production HUD defect.

The test now retains the original scene children and removes only newly created synthetic cards at that depth. It asserts the Pause background remains active/visible. The focused round-presentation check passed at 320/390/1000px, covering timing, pause behavior, reward idempotence, score attribution and card bounds. [Corrected challenge image](treeforce89-graphics-review-20261124/challenge.png) and [results](treeforce89-graphics-review-20261124/round-checks.json) are retained here. Old screenshots remain historical evidence; use this corrected result capture for visual judgement.

## Bounded next action

To pursue the requested reference-level polish, the next graphics task should improve **internal enemy banking/wing motion first**, preserving existing silhouettes, colors, movement curves, hitboxes, warnings and random-number consumption. Assess that one change before a separate event-specific impact-effects pass. Do not add gameplay features or redesign the forest/hero to increase apparent detail. These are visual-quality gaps, not claims that the working online game is broken.

No game helper, wallet/payment code, production file or backend was changed in this comparison. No full website build or push was performed. Only the focused capture test was rerun. The plan/report and test correction remain local until the next substantive PR milestone, avoiding another automatic site-wide build.

## Multichain boundary

Tree Force presentation work can proceed independently. The separate Sui/BNB Arcade branch must be reconciled before assembling the authenticated release candidate or performing final wallet/save/share tests. This comparison does not inspect or certify that other chat's changes, and it does not authorize publishing either branch over the other.
