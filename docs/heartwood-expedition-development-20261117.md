# HEARTWOOD / Private Heart of Africa — 2026-11-17

## Scope
Two isolated browser pages are added under the existing /play/ prefix:
- /play/heart-of-africa-private/ — privately gated personal launcher for an external, browser-playable *Heart of Africa* game.
- /play/heartwood-expedition/test/ — fully original, self-contained TREE-themed exploration and resource-stewardship browser prototype.

No copyrighted game ROM/graphics/audio/source has been committed. The user's hafrica.zip holds HEART.D64, PC64.EXE, HEART.BAT and historical resources; RULES.TXT describes M.U.L.E. by mistake. The old DOS PC64 emulator cannot run in a current browser without additional emulation. The private launcher instead opens https://www.commodoregames.net/Commodore64/Heart-of-Africa-3461.html in a separate tab. External player availability is not guaranteed.

## Private access
The Netlify Edge Function in netlify/edge-functions/private-retro.js restricts ONLY /play/heart-of-africa-private and descendants using HTTP Basic authentication.
- Username: tree
- Password: Netlify environment variable TREE_PRIVATE_RETRO_PASSWORD (secret, Functions scope).
- Missing password fails closed (503). No client-side plaintext credential is shipped.
- Basic authentication requires HTTPS, which Netlify supplies.
- No Game ROM or third-party emulator is bundled or reproduced.
- This is a private *launcher*, not an on-domain emulation of the copyrighted game.
- Note: Netlify deploy-preview was initially configured. Check production context before publishing.

## Heartwood Expedition v0.1
- Standalone HTML/CSS/Canvas JavaScript; no new dependencies or external assets
- Responsive keyboard and on-screen movement controls
- Deterministically generated 30x22 forest map with fog of war
- Four forest stations, dynamically seeded final Heartseed, clues, ecological samples
- Finite supplies, health, terrain costs, resource trading, surveys, local save/restore
- Victory condition: find Heartseed with >=3 reports and >=4 ecological samples
- No wallet authentication, NFT gates, tokens, payments, user tracking, or leaderboard writes

## Release constraints
- Production manifest and historical bundled functions remain unchanged.
- Preview build script includes these 2 files explicitly only in dist-preview.
- No public Arcade navigation links are changed.
- All existing source overlays, dependency pins and backend package inventories are retained.
- Verify preview build, edge 401/authorized behavior, and responsive gameplay before considering public promotion.
- Publish new static routes only after capturing the current *live* deployed production inventory. Do not treat the old manifest as the complete live deployment.
- Any later Sui integrations must be independently designed/tested using current Mysten Labs frontend guidance; not part of this feature.

## External reference
Original game's published instructions: https://www.lemon64.com/doc/heart-of-africa/282
Original game's playable external page: https://www.commodoregames.net/Commodore64/Heart-of-Africa-3461.html
