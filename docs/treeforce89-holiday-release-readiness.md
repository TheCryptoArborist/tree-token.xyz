# Holiday release readiness after owner review

Owner reported the canonical holiday review working well and confirmed the countdown to midnight Central. Record this as owner acceptance of loading/countdown behavior, not a full post-unlock seasonal phone playtest. Previous normal gameplay acceptance remains valid.

## UTC candidate ready locally

`release/treeforce-holiday-utc-r17` contains an incremental, versioned copy update. Published r16 bytes remain unchanged. Five new module filenames propagate the updated holiday policy through the entry/import cycle; scenery and approved audio are reused. The candidate entry points to r17. The plan is a payload manifest, not a complete production inventory.

Opening: November 27, 2026 at 06:00 UTC. Closing: January 1, 2027 at 06:00 UTC. These are unchanged midnight Central Standard Time instants. Source display adds the explicit UTC closing date during availability.

Three boundary/countdown unit checks passed. Actual r17 module browser checks passed at 320, 390 and 1000 pixels: opening label, remaining seconds, unlock, closing label, 35-day initial season countdown, closing disablement and no horizontal overflow. No page errors. The 320-pixel available-state screenshot was visually inspected. Evidence: `treeforce89-holiday-utc/`. No repeat of unchanged payment/audio suites was needed for this wording-only step.

Reproduce:

```sh
node scripts/treeforce-local/package-holiday-utc.mjs
node scripts/treeforce-local/serve.mjs release/treeforce-holiday-utc-r17/candidate 4200
node tests/treeforce-local/holiday-utc-browser.cjs
```

## Remaining actions, in order

1. Batch the UTC-label update into the next authorized publication, using fresh production inventory and preservation checks. No standalone copy-only deployment was made in this step.
2. Main-game promotion is a separate scope decision: the published holiday URL is still a review route. Owner review approval does not by itself replace the main `/play/treeforce89/` entry. The current reviewed game can remain live while this is decided.
3. After seasonal unlock, owner can check winter readability, music and performance on a physical phone. This remains a seasonal phone check, not a reason to repeat the already accepted normal gameplay review.

No additional feature work is planned. No badge system, tournament, pricing/access, backend or multichain activation is included. No real payment, push, Netlify build or deployment occurred in this step.
