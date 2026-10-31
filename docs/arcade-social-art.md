# TREE Arcade social-sharing artwork

## Asset

- Public path: `/assets/arcade/tree-arcade-social.jpg`
- Intended use: Open Graph and Twitter/X large-image sharing preview for `https://tree-token.xyz/play/`.
- Final dimensions: **1200 × 630 pixels**.
- Encoding: progressive RGB JPEG, quality 82, optimized, chroma subsampling disabled.
- Final size: **348,487 bytes** (under the 350,000-byte budget).
- SHA-256: `f417e9abd5cf210f9a32c12b8b28b21591ef2accf5072b71f7202a16148f3b18`.
- Creation mode: built-in `image_gen.imagegen`, with one targeted refinement for the footer safe margin. No API/CLI fallback.
- The selected generated source was 1730 × 909 pixels. The only post-generation processing was resizing to 1200 × 630 and JPEG encoding. No image content or typography was painted, composited, or retouched programmatically.
- Suggested image alt: “TREE Arcade artwork with Garden Bot, a forest emblem, and the TREE FORCE hero; Battle. Grow. Defend the canopy.”

## References

The following existing project artwork was inspected and provided as supporting references:

1. `assets/arcade/garden-bot-crest.png`: Garden Bot character identity.
2. `assets/tree-force-89-logo-black.webp`: purple-and-green TREE FORCE hero identity; existing logo lettering excluded from the generated composition.
3. `assets/arboretum-logo-black.webp`: forest/tree emblem identity.

The banner contains exactly these promotional text elements: “TREE ARCADE”, “BATTLE. GROW. DEFEND THE CANOPY.”, and “tree-token.xyz/play”. It makes no availability, reward, or earnings claim. The footer was moved upward during refinement so all critical copy fits within the central safe area. The final JPEG was visually inspected for legibility and spelling.

## Initial generation prompt

```text
Use case: ads-marketing.
Asset type: new social-sharing illustration for the TREE Arcade website, a landscape Open Graph banner intended for exact 1200 x 630 pixels.
Create one premium retro-game promotional illustration in a 1.9:1 wide composition. Dark navy atmosphere with forest green, warm gold, and purple accents. A restrained arcade glow, subtle starry forest backdrop, and polished illustrated rendering; energetic but clean, readable at small preview size.

Reference images:
1. Garden Bot crest: supporting character reference. Preserve this friendly small gold/orange garden robot's cyan eyes, dark faceplate, leaf chest insignia and green sprout. Place it on the left.
2. TREE FORCE '89 artwork: supporting character reference only. Use the recognizable purple-and-green masked forest superhero and cape on the right. Do not copy the logo lettering from this reference.
3. Arboretum emblem: supporting identity reference for a softly glowing green forest/tree emblem between the characters, behind the central typography. Do not add invented game logos.

Composition: title is the dominant focal point in the upper-middle/center. Character art frames it on the left and right, never covering the text. Keep all critical copy entirely inside the central 80% safe box, at least 10% away from every edge, allowing a crop to 1200 x 630. Use generous navy negative space around the text. The central emblem is understated, and the characters are supporting illustrations rather than competing focal points. Include a subtle luminous green-and-gold horizon.

Text, verbatim and only these three text elements:
Large title: "TREE ARCADE"
Subline beneath: "BATTLE. GROW. DEFEND THE CANOPY."
Small but clear footer: "tree-token.xyz/play"

Typography: bold, precisely readable premium retro arcade typography for TREE ARCADE, warm gold/off-white with restrained green or purple dimensional accents; a clean uppercase subline; a simple lowercase web address. Render every word exactly. Do not add six game names, do not add labels, numbers, fake interface, invented logos, badges, reward promises, earnings, currencies, tokens, coins, wallet prompts, 'live', or 'play now'. No watermark. This is an ecosystem arcade invitation, not a promise that every game is available. Opaque background.
```

## Targeted refinement prompt

```text
Edit this TREE ARCADE social illustration with ONE change only: move the existing "tree-token.xyz/play" footer plaque upward so the entire plaque and every letter lie above the 88% image-height line, with at least 12% clear bottom margin. Position it centered around 82% of the image height; reduce the plaque slightly if needed so it sits comfortably below the tagline. Preserve all other artwork, exact characters, composition, typography, and colors. Preserve these exact texts: "TREE ARCADE", "BATTLE. GROW. DEFEND THE CANOPY.", "tree-token.xyz/play". Keep the landscape 1.9:1 composition. Do not add or remove any words, do not add new labels or watermarks. Opaque background.
```

