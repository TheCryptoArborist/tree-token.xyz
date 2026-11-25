# TREE website assets

Included at the user's request to incorporate TREE Token branding and make the king the Tree Hero.

- `dist/assets/tree-hero.webp`: https://tree-token.xyz/assets/arcade-seasonal/tree-hero.webp (linked as Tree Hero on https://tree-token.xyz/play/).
- `dist/assets/tree-logo.webp`: https://tree-token.xyz/assets/tree-token-logo-official.webp (TREE Arcade header logo).
- Palette reference: https://tree-token.xyz/styles/homepage-refresh.css — forest backgrounds, emerald #35e895, gold #ffe05e.

The king retains standard chess movement and rules. Both sides use Tree Hero artwork with labeled light/dark bases. The original standalone release had no wallet integration. The current update adds two browser trial games, NFTree holder access and rarity finishes; it does not award rewards.

The early pawn silhouettes were drawn as SVGs based on the branching, paired-leaf tree emblem on Tree Hero’s chest, with a central trunk and a small chess base in each side’s color.

`dist/assets/woodland-court.png`: original AI-generated Canopy Queen, Root Fortress, Grove Sage, and Barkwood Steed artwork using the official Tree Hero image as the style reference. Displayed as four CSS sprites; these are original game characters, not claimed as official TREE characters.

Tree Crest pawn: original generated transparent emerald tree emblem on a purple and gold shield, using the official Tree Hero as a visual reference. Native game sources live in `play/grove-chess/`. The final reserved cabinet (`reserved-3-title`) is filled by `scripts/arcade-grove-chess.js`; the Tree Army cabinet is preserved. This initial release is browser-local free play and does not award attendance, rewards, or leaderboard points.

Cabinet cover: `play/grove-chess/assets/grove-chess-cover.png` is original generated
art using the existing hero, woodland court and pawn assets as references. It
shows a crowned Tree Hero king on a chess pedestal with woodland pieces on a
board. Only the cabinet preview changes; the playable piece artwork is retained.
The cabinet has no slogan, and the chess page no longer uses “Defend the canopy,”
to distinguish Grove Chess from Canopy Defense.
