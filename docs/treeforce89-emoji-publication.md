# Festive emoji message update — published

Live on the [Arcade cabinet](https://tree-token.xyz/play/) and [game title screen](https://tree-token.xyz/play/treeforce89/):

- 🎄✨ A little Christmas magic arrives in…
- 🎄🎁 Keep the Christmas spirit flying! Time remaining…

Locked deploy `6b06687527d719b675652622`, source `3e43e0e`, baseline `6b06668752cda878be6a57e9`. [Publication run 45549145727](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45549145727) passed 37 guards plus candidate/canonical browser checks at 390/1000 pixels. Shared game and cabinet text, opening/closing countdowns, Holiday selection and unchanged gate/price were checked with synthetic time and no payment. Phone-width cabinet screenshot inspected locally.

Only `/scripts/treeforce-season-r18.mjs` changed, and only its two message strings differ. Upload: 961 bytes. The script is served with `public,max-age=0,must-revalidate`, so this bounded copy update deliberately reuses the existing URL; reload an already-open page to load it. Published historical payloads remain recorded in their original release directories. All other 756 static paths, all 61 backend/provider records, five schedules and protected API-visible configuration were preserved; total stays 757 paths. No whole-site or backend rebuild.

Actual schedule remains November 27, 2026 at 06:00 UTC through January 1, 2027 at 06:00 UTC. Cabinet seasonal notice hides after closing; game title message stays out of combat. No pricing/access, wallet, score or badge change. Evidence is in `treeforce89-emoji-publication/`; plan fingerprint checked independently after extraction.
