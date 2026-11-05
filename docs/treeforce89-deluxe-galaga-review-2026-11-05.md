# Deluxe Galaga archive and TREE FORCE comparison — November 5, 2026

The supplied `Deluxe_Galaga_v2.6-AGA-(1).exe` was reopened and statically inspected. Its SHA256 is `ac2f5f5ce1639d9b576da2bf5a61e19915ac3dbca41a1e058d09e2e9807b16ce`, identical to the previously supplied installer. This is a Windows RAR self-extracting package, not an editable source-code archive. The installer, bundled emulator, launcher and game executable were not run.

## What was actually inspected

Eight outer archive entries were enumerated: a short controls readme, WinUAE settings, a 901,120-byte ADF, a Kickstart image, WinUAE, a launcher and two directories. Only the ADF and readme were extracted for analysis. The ADF SHA256 is `0228ede23cff2daece3ed21905db6dd69f52a114f4c51888d4b267303dad4606`, identical to the earlier disk.

All 26 disk files were reconstructed from the Amiga OFS filesystem. Every extracted file header and linked data-block checksum, owner, sequence and byte count was validated. The inventory is in `treeforce89-deluxe-galaga-review-inventory.json`. The 50,698-byte `GALAGA.GUIDE`, `READ_ME_FIRST`, preferences, loader and file types were inspected. There is no `.S`, `.ASM`, C source, level-editor source or SFX-editor source in the disk inventory. The guide describes the commented assembly and development tools as a separately supplied package; this does not establish present-day availability of that historical offer.

`GALAGA` is a compiled Amiga HUNK executable: a 548-byte code hunk and a 124,264-byte data hunk. The small loader and compressed-looking payload do not provide source-level movement tables, named sound triggers or reliable collision timings by inspection. This review does not claim a complete decompilation, emulator playthrough or frame-accurate comparison with the original. The manual's 47,865 lines of assembly are a description of its development source, not 47,865 readable lines present in this upload.

## Audio: significant design material

The disk contains `GALAGA.MUSIC`, `GALAGA.JINGLE1` and `GALAGA.JINGLE2`. All three have XPK/SQSH compression headers; an independent tracker decoder successfully recognized their ProTracker content:

| File | Module title | Nominal decoded duration |
|---|---|---|
| GALAGA.MUSIC | coming from the sky | 213.317 seconds |
| GALAGA.JINGLE1 | underwater | 30.720 seconds |
| GALAGA.JINGLE2 | follin hiscore | 15.600 seconds |

These are file/module identities, not verified assignments to particular in-game events. This package has two external jingle files, while the technical section documents **114 sound effects and four jingles** for the game. No separate `GALAGA.SFX` or `GALAGA.SFX_SMALL` file is present here. The guide describes synthetic/sample effects and optional speech; the individual 114 cue-to-event assignments were not recovered from the compiled payload.

TREE FORCE already calls its sound routine for firing, enemy shots/hits, growth seeds, weapon cores, VICTORY, BOOM, growth, shield activation/readiness, wave arrival, wave results and Windfall contacts. Most use the same brief downward-pitch oscillator envelope with different frequencies. It is inaccurate to describe the current game as having no pickup or stage sounds. Its real gap is a distinctive cue vocabulary, short musical fanfares, prioritization and richer transitions.

Recommended original TREE FORCE cues: seed collect; core charge; weapon-tier upgrade; VICTORY turbo; BOOM blast; shield ready; shield activate/end; player damage/life lost; sector arrival; challenge start; perfect challenge; boss warning; boss phase change; victory and paid-resume confirmation. A small cue bank with separate music/SFX levels and a limit on overlapping shot sounds would improve readability more than simply making every beep louder. Recreate original TREE FORCE audio rather than importing these soundtrack bytes.

## Original arcade Galaga and Deluxe Galaga are different references

Bandai Namco's official Arcade Game Series GALAGA instructions describe the 1981 game's formation attacks, greater rewards for diving enemies and escorts, captured-fighter rescue and non-attacking Challenging Stages with a perfect-clear award. The original arcade game did not have Deluxe Galaga's falling weapon/shop/armour system or a gradually collected shield.

The official Nintendo-hosted NES instruction scan also documents A/B firing, Start pause/resume, two-hit bosses, transforming enemies, formation/attack scoring, capture/rescue, accuracy and challenge bonuses. Its port-specific wording and scoring should not be silently treated as exact arcade timing.

The uploaded **Deluxe Galaga** manual adds falling weapon/speed upgrades, bullet limits, smart bombs, money, periodic shops, rank promotion, extra-life collection, temporary shields, ship armour and multiple sub-games. The modern official preservation site describes armour as cumulative, separate from the temporary Shield. That latter detail is corroborating documentation, not a recovered constant from this uploaded executable. Enhanced-only 2026 features such as the new damage and missile pickups are not attributed to the 1995 disk.

## Movement, shooting and progression comparison

| Area | Evidence from the references | TREE FORCE now | Useful next addition |
|---|---|---|---|
| Formation arrivals | Arcade formations organize before attacks; Deluxe has varied alien sets | Left/right arcs, cross/sweep entries and moving formations | More authored entry routes per sector, with readable pauses between packs |
| Attack roles | Diving enemies and leader/escort attacks have distinct scoring | Swoop, hook, crossfire, borer charge, leaders/escorts and convoy bonuses | Give each enemy a consistent firing role; vary attack combinations by sector |
| Fire discipline | Deluxe starts with limited simultaneous bullets and upgrades | Five weapon tiers and active-shot caps | Keep caps meaningful; show a distinct tier-up animation and sound |
| Capture/rescue | Arcade tractor-beam rescue produces a Dual Fighter | Root Snare, rescue window and dual-wing fire already exist | Stronger beam warning, rescue cue and explanation; no need to duplicate the mechanic |
| Mutation | NES documentation describes transforming/splitting enemies | Mutated wasps and splitting spores already exist | Introduce them with distinct audio/visual tells rather than only more speed |
| Stage evolution | Deluxe documents 75 levels, difficulty-dependent mixtures, shops and special encounters | Ten named waves, three basic enemy types, progressively mixed/faster packs and final boss | Distinct sector rules/background treatment and a short threat preview |
| Special encounters | Manual lists mother ships, rockets, guardians, cash ship and Warp Malfunction | Final boss, captor and enemy variants | One optional telegraphed mini-boss encounter before expanding the campaign |
| Secondary rewards | Rank marks, EXTRA collection, multipliers and secrets | Growth, cores, local score chains and perfect-shield awards | A modest local collection objective; do not imply extra on-chain rewards |

## Bonus rounds: one implemented system and one dormant system

**Windfall Gauntlet is wired in after combat waves 4 and 8.** `hasBonusAfter(3/7)` leads from `roundSequence()` into `startWindfall()`, then back to combat waves 5/9. Its 18-second course has falling limbs, gold seeds, two open lanes per row, no life loss, 100 points per seed and a clean-run core plus 3,000-point award. It is the TREE-themed counterpart of Deluxe's Meteor Storm, not the original arcade shooting challenge.

**The separate shooting-challenge path is currently dormant.** `isCanopyRush()` requires the current wave's name to equal `CANOPY RUSH`, but no entry in `config.ts` has that name. The wave-4 and wave-8 names are `TWILIGHT TALON RAID` and `WILDFLIGHT RUSH`. As a result, the specialized target counts, accuracy/perfect results and no-normal-fire/dive branches are not selected by the current campaign.

This should be corrected as a deliberate shooting-challenge implementation, not merely by renaming a wave: current arrivals settle into formation, so a real challenge also needs safe fly-through routes, missed-target exits, completion when targets leave, a no-hostile-fire guarantee, clear hit/total feedback and a perfect-clear jingle. Keep Windfall as a separate bonus style. Deluxe's Memory Station is another possible future TREE-themed pairing game; it is not implemented now.

## Shield and armour: clarify the current mechanics

TREE FORCE charges its shield meter from kills (100 maximum), requires growth above Seedling and spends one growth stage when activated. It clears nearby bullets, damages/stuns nearby enemies and sets invulnerability for `tuning.pruneInvuln = 600` milliseconds. That is **0.6 seconds**, not three seconds. The visible effect is closer to an emergency burst with brief protection than a sustained shield. Damage can also reduce growth before taking a life, giving growth layers an armour-like role; there is no separate Deluxe-style armour inventory.

For clarity, retain the A+B emergency activation, make readiness and the active protection window unmistakable, and deliberately decide whether protection should stay brief or become the previously discussed three seconds. A separate stackable armour system is an optional balance change, not something already present or something inferred from original arcade Galaga.

## Priorities

1. Complete the requested A+B controller shield and Start pause/resume correction, preserving all payment and backend behavior.
2. Wire and test an authentic-style, non-attacking fly-through shooting challenge, while retaining the existing Windfall bonus.
3. Add distinct original event sounds and short sector/bonus/perfect/boss jingles, with mixing priority.
4. Resolve the shield's duration/presentation mismatch before adding more defensive systems.
5. Expand sector identities and one mini-boss, then tune drop pacing and difficulty through a complete ten-wave run.

No original executable, graphics, music, ROM or emulator bytes are incorporated into TREE FORCE by this review. No new audio, armour, enemy movement or bonus-stage changes were deployed as part of the inspection.

## External primary references checked

- [Edgar Vigdal's preserved official manual](https://deluxegalaga.com/docs.html)
- [Official Deluxe Galaga gameplay glossary](https://deluxegalaga.com/gameplay.html) — distinguish Enhanced-labelled entries
- [Official preservation/restoration description](https://deluxegalaga.com/about.html)
- [Bandai Namco Arcade Game Series GALAGA help](https://dlassets-ssl.xboxlive.com/public/content/8ae7a101-f001-416a-9aa2-170a1bf54bc2/GameManual/70077373-2459-4ed9-8b2c-4f94ccfe43fc/en-US/index.html)
- [Nintendo-hosted NES Galaga instruction scan](https://www.nintendo.co.jp/clv/manuals/en/pdf/CLV-P-NABNE.pdf)
