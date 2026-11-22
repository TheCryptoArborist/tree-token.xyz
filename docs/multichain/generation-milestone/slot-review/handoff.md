# Approved empty-slot Slush handoff

The user approved the exact one-slot transaction, 0.02 SUI maximum and canonical
signing page. See approval.json. The only permitted signing location is
`https://tree-token.xyz/play/generation-slot/`. Desktop Slush signs directly;
Cloud holds no wallet keys. The server accepts GET-only preparation and receipt
reads, rejects execution requests, and refreshes registry/capability/NFT state.

The browser checks the pinned package, original type, registry and admin reference,
exact commands, sender, mainnet, bounded validity, budget, simulated bytes and
receipt state. Review time uses server Date/Age plus monotonic elapsed time.
It rechecks expiry after signing and signature verification, then stores the
expected digest before submission. A pending digest disables another attempt.
The chain's one-slot guard also rejects another device's duplicate attempt.

Production release adds exactly two new static paths and one isolated function.
It preserves every existing file, complete provider record, schedule and captured
protected configuration from baseline 6b0341e7545ba49e00a0e496. The historical root
build and preview output are never used as the production release package.

Rebuild: `node tools/generation-slot/build.mjs`.
Tests: `node --test contracts/nftree-generation/scripts/*.test.mjs tools/generation-publication/core.test.mjs tools/generation-slot/core.test.mjs tests/generation-slot-release.test.mjs`.
Browser checks: `SLOT_PACKET=/path/to/fresh-handoff.json node tests/generation-slot-browser.cjs`
with Playwright/Chromium installed. The source browser fixture is mock-wallet only;
real Slush acceptance requires the user's signature after canonical publication.

No NFT deposit, BNB deployment, peer configuration or gameplay activation is
included. Receipt verification must finish before any later milestone.

## Published and verified

The canonical page is live on locked deploy `6b036cc41e40ebe1a1df7990`.
All 658 previous static hashes, 53 complete backend records, five schedules,
runtime and API-visible protected configuration were preserved; totals are now
660 static paths and 54 functions. See `live-verification.json` and the durable
GitHub Actions artifact. All 120 tooling/release tests passed, as did the contract
workflow and preview-preservation test. Three source/candidate/live mock-wallet
browser scenarios passed, including stale review rejection, reload protection and
noncanonical path blocking. Fresh live API review and served-byte equality were
also independently checked. No real signature or slot creation was performed.

User handoff: open the canonical URL, connect desktop Slush with dev account
ending 45c4, refresh slot review, then sign and create the slot. Maximum gas is
0.02 SUI. Save the verified receipt and return it to Codex. If submission has an
uncertain result, use Check slot receipt; do not clear local storage or repeat
creation. A receipt indexing delay may require pressing Check slot receipt again.
