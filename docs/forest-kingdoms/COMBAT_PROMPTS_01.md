# Tree Hero combat atlas prompts — first pass

Date: November 19, 2026 (America/Chicago)

Created with the built-in image-generation tool. Each atlas uses the corresponding existing movement sheet and the canonical Tree Hero as references. East, west, and north additionally use the new south combat sheet for action ordering. The requested canvas was 1536 × 1536; the actual returned PNGs are 1254 × 1254 and are preserved unchanged, including their generated alpha. The explicit frame map uses the actual dimensions.

These are first-pass review assets for FK-02, not a claim of completed Phaser gameplay or approval of every pose. The original movement assets are unchanged.

## south

```text
Use case: stylized-concept. Asset type: production transparent 2D game animation sprite atlas for Forest Kingdoms, FK-02.
Image 1 is the existing movement atlas for this direction: MATCH the same character's body mass, proportions, purple head/body, GREEN eyes, green vine musculature, gold armor/bracers/boots, star belt and long gold cape. Image 2 is the canonical original hero for identity. Keep the established painted outlined fantasy-game style and warm upper-left lighting. This is NEW combat animation artwork, not a redesign of the reference.
Output a square 1536x1536 PNG with genuine transparent alpha. Exactly SIXTEEN full-body poses in FOUR columns and FOUR rows, equal 384x384 cells, one character per cell. Each character remains wholly within its cell with at least 22px transparent gutters. Standing head about y42 and boots about y338 inside each cell, constant body scale around 296px standing height. Fixed slightly elevated overhead camera. Keep natural human limb lengths, broad shoulders and thighs, two arms, two legs. No weapon. No text, labels, frames, grid, background, gradient, scenery, ground, contact shadow, or checkerboard.
Every ROW is a separate FOUR-FRAME action sequence read left to right. Make consecutive poses meaningfully distinct, anatomically coherent, and consistent in costume and scale:
Row 1 STRIKE: guarded windup with fist drawn back; forceful forward punch; follow-through; returning to guard. Punch toward the specified facing direction. Natural shoulder/waist turn, compact readable movement, no elongated arm.
Row 2 ROOT CAST: gather hands at chest; lower and open palms to channel roots; extend one open palm forward/down in a clear casting gesture; settle back to ready. Small green light at palms only, no large spells or detached effects obscuring body.
Row 3 HIT REACTION: alert guard; recoil backward from impact with bent knees; catch balance; return to guard. No blood, wounds, missing limbs or damage to costume.
Row 4 DEFEAT: knees buckle; drop to one knee with hand braced; fall sideways; fully resting on side on the ground, alive but defeated. Final figure is horizontal, all limbs/head/boots/cape contained inside cell. Same body scale throughout the fall; do not shrink the body to fit. Keep final contact line near bottom of cell and cape naturally folded.
All poses keep the specified direction orientation; the falling body may rotate naturally only within that fall. No extra characters or objects. The sheet must read as the SAME hero already established in the movement atlas.
DIRECTION: SOUTH, facing the viewer / bottom of screen. Front of purple face and broad green/purple chest visible, both eyes GREEN. Foreshorten the punch naturally toward viewer rather than turning the whole body to profile. Match the frontal elevated angle of Image 1.
```

## east

```text
Use case: stylized-concept. Asset type: production transparent 2D game animation sprite atlas for Forest Kingdoms, FK-02.
Image 1 is the existing movement atlas for this direction: MATCH the same character's body mass, proportions, purple head/body, GREEN eyes, green vine musculature, gold armor/bracers/boots, star belt and long gold cape. Image 2 is the canonical original hero for identity. Keep the established painted outlined fantasy-game style and warm upper-left lighting. This is NEW combat animation artwork, not a redesign of the reference.
Output a square 1536x1536 PNG with genuine transparent alpha. Exactly SIXTEEN full-body poses in FOUR columns and FOUR rows, equal 384x384 cells, one character per cell. Each character remains wholly within its cell with at least 22px transparent gutters. Standing head about y42 and boots about y338 inside each cell, constant body scale around 296px standing height. Fixed slightly elevated overhead camera. Keep natural human limb lengths, broad shoulders and thighs, two arms, two legs. No weapon. No text, labels, frames, grid, background, gradient, scenery, ground, contact shadow, or checkerboard.
Every ROW is a separate FOUR-FRAME action sequence read left to right. Make consecutive poses meaningfully distinct, anatomically coherent, and consistent in costume and scale:
Row 1 STRIKE: guarded windup with fist drawn back; forceful forward punch; follow-through; returning to guard. Punch toward the specified facing direction. Natural shoulder/waist turn, compact readable movement, no elongated arm.
Row 2 ROOT CAST: gather hands at chest; lower and open palms to channel roots; extend one open palm forward/down in a clear casting gesture; settle back to ready. Small green light at palms only, no large spells or detached effects obscuring body.
Row 3 HIT REACTION: alert guard; recoil backward from impact with bent knees; catch balance; return to guard. No blood, wounds, missing limbs or damage to costume.
Row 4 DEFEAT: knees buckle; drop to one knee with hand braced; fall sideways; fully resting on side on the ground, alive but defeated. Final figure is horizontal, all limbs/head/boots/cape contained inside cell. Same body scale throughout the fall; do not shrink the body to fit. Keep final contact line near bottom of cell and cape naturally folded.
All poses keep the specified direction orientation; the falling body may rotate naturally only within that fall. No extra characters or objects. The sheet must read as the SAME hero already established in the movement atlas.
Image 3 is the new SOUTH combat atlas: use its same four-row action ordering and character finish, but preserve Image 1's required facing direction. Keep ALL limbs and capes inside their cells with transparent gutters, including the lying pose.
DIRECTION: EAST, facing RIGHT. Maintain right-facing three-quarter profile from the same slightly elevated camera as Image 1; nose, chest and forward toes point RIGHT, cape trails LEFT. Punch and cast toward RIGHT; hit recoil goes slightly LEFT. Do not flip direction between frames. Keep warm light from screen upper LEFT.
```

## north

```text
Use case: stylized-concept. Asset type: production transparent 2D game animation sprite atlas for Forest Kingdoms, FK-02.
Image 1 is the existing movement atlas for this direction: MATCH the same character's body mass, proportions, purple head/body, GREEN eyes, green vine musculature, gold armor/bracers/boots, star belt and long gold cape. Image 2 is the canonical original hero for identity. Keep the established painted outlined fantasy-game style and warm upper-left lighting. This is NEW combat animation artwork, not a redesign of the reference.
Output a square 1536x1536 PNG with genuine transparent alpha. Exactly SIXTEEN full-body poses in FOUR columns and FOUR rows, equal 384x384 cells, one character per cell. Each character remains wholly within its cell with at least 22px transparent gutters. Standing head about y42 and boots about y338 inside each cell, constant body scale around 296px standing height. Fixed slightly elevated overhead camera. Keep natural human limb lengths, broad shoulders and thighs, two arms, two legs. No weapon. No text, labels, frames, grid, background, gradient, scenery, ground, contact shadow, or checkerboard.
Every ROW is a separate FOUR-FRAME action sequence read left to right. Make consecutive poses meaningfully distinct, anatomically coherent, and consistent in costume and scale:
Row 1 STRIKE: guarded windup with fist drawn back; forceful forward punch; follow-through; returning to guard. Punch toward the specified facing direction. Natural shoulder/waist turn, compact readable movement, no elongated arm.
Row 2 ROOT CAST: gather hands at chest; lower and open palms to channel roots; extend one open palm forward/down in a clear casting gesture; settle back to ready. Small green light at palms only, no large spells or detached effects obscuring body.
Row 3 HIT REACTION: alert guard; recoil backward from impact with bent knees; catch balance; return to guard. No blood, wounds, missing limbs or damage to costume.
Row 4 DEFEAT: knees buckle; drop to one knee with hand braced; fall sideways; fully resting on side on the ground, alive but defeated. Final figure is horizontal, all limbs/head/boots/cape contained inside cell. Same body scale throughout the fall; do not shrink the body to fit. Keep final contact line near bottom of cell and cape naturally folded.
All poses keep the specified direction orientation; the falling body may rotate naturally only within that fall. No extra characters or objects. The sheet must read as the SAME hero already established in the movement atlas.
Image 3 is the new SOUTH combat atlas: use its same four-row action ordering and character finish, but preserve Image 1's required facing direction. Keep ALL limbs and capes inside their cells with transparent gutters, including the lying pose.
DIRECTION: NORTH, facing AWAY / TOP of screen. Show back of purple head, broad shoulders and gold cape, not face or chest. Punch and cast toward the TOP, arms visible outside the cape as needed. Keep head facing AWAY in every frame. Show readable arm movement, bent knees and boots below cape; cape lifts and folds naturally. Defeat ends fallen on side with back/cape toward viewer. All poses retain rear viewpoint.
```

## west

```text
Use case: stylized-concept. Asset type: production transparent 2D game animation sprite atlas for Forest Kingdoms, FK-02.
Image 1 is the existing movement atlas for this direction: MATCH the same character's body mass, proportions, purple head/body, GREEN eyes, green vine musculature, gold armor/bracers/boots, star belt and long gold cape. Image 2 is the canonical original hero for identity. Keep the established painted outlined fantasy-game style and warm upper-left lighting. This is NEW combat animation artwork, not a redesign of the reference.
Output a square 1536x1536 PNG with genuine transparent alpha. Exactly SIXTEEN full-body poses in FOUR columns and FOUR rows, equal 384x384 cells, one character per cell. Each character remains wholly within its cell with at least 22px transparent gutters. Standing head about y42 and boots about y338 inside each cell, constant body scale around 296px standing height. Fixed slightly elevated overhead camera. Keep natural human limb lengths, broad shoulders and thighs, two arms, two legs. No weapon. No text, labels, frames, grid, background, gradient, scenery, ground, contact shadow, or checkerboard.
Every ROW is a separate FOUR-FRAME action sequence read left to right. Make consecutive poses meaningfully distinct, anatomically coherent, and consistent in costume and scale:
Row 1 STRIKE: guarded windup with fist drawn back; forceful forward punch; follow-through; returning to guard. Punch toward the specified facing direction. Natural shoulder/waist turn, compact readable movement, no elongated arm.
Row 2 ROOT CAST: gather hands at chest; lower and open palms to channel roots; extend one open palm forward/down in a clear casting gesture; settle back to ready. Small green light at palms only, no large spells or detached effects obscuring body.
Row 3 HIT REACTION: alert guard; recoil backward from impact with bent knees; catch balance; return to guard. No blood, wounds, missing limbs or damage to costume.
Row 4 DEFEAT: knees buckle; drop to one knee with hand braced; fall sideways; fully resting on side on the ground, alive but defeated. Final figure is horizontal, all limbs/head/boots/cape contained inside cell. Same body scale throughout the fall; do not shrink the body to fit. Keep final contact line near bottom of cell and cape naturally folded.
All poses keep the specified direction orientation; the falling body may rotate naturally only within that fall. No extra characters or objects. The sheet must read as the SAME hero already established in the movement atlas.
Image 3 is the new SOUTH combat atlas: use its same four-row action ordering and character finish, but preserve Image 1's required facing direction. Keep ALL limbs and capes inside their cells with transparent gutters, including the lying pose.
DIRECTION: WEST, facing LEFT. Maintain left-facing three-quarter profile from the same slightly elevated camera as Image 1; nose, chest and forward toes point LEFT, cape trails RIGHT. Punch and cast toward LEFT; hit recoil goes slightly RIGHT. Do not flip direction between frames. Keep warm light from screen upper LEFT rather than mirroring highlights.
```

