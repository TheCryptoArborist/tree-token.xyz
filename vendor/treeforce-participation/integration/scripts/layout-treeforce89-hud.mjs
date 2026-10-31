// Presentation-only overlay on the pinned native game; no physics or run changes.
import assert from 'node:assert/strict';
export function layoutTreeForceHud(source) {
 const replace=(before,after)=>{assert.equal(source.split(before).length,2,'Unexpected HUD boundary: '+before);source=source.replace(before,after);};
 replace('"SCORE\\n000000",font(14)','"SCORE\\n000000",font(12)');
 replace('"HI\\n089000",font(14','"HI\\n089000",font(12');
 replace('"WAVE\\n01",font(14)','"WAVE\\n01",font(12)');
 replace('rectangle(62,54,50,21','rectangle(62,54,70,21');
 replace('text(12,638,"GROWTH 1/5 // SEEDLING  ×1.00",font(12','text(12,638,"GROWTH 1/5 // SEEDLING  ×1.00",font(11');
 replace('text(12,653,"WEAPON','text(12,658,"WEAPON');
 replace('"CHAIN 0  ×1.00",font(12','"CHAIN 0  ×1.00",font(11');
 replace('text(468,653,"♠ ♠ ♠",font(14','text(468,658,"♠ ♠ ♠",font(11');
 replace('text(58,669,"GROW 0 / 10"','text(55,688,"GROW 0 / 10"');
 replace('rectangle(58,709,92,8','rectangle(55,709,86,8');
 replace('rectangle(12,709,92*growthP','rectangle(12,709,86*growthP');
 replace('text(240,82,"",font(14,pc.text)).setOrigin(.5).setDepth(15)','text(240,116,"",font(11,pc.text)).setOrigin(.5).setAlign("center").setWordWrapWidth(430).setDepth(15)');
 replace('text(240,116,"",font(16,pc.text))','text(240,176,"",font(14,pc.text))');
 replace('text(468,82,"",font(10,pc.gold))','text(468,46,"",font(10,pc.gold))');
 replace('.setPadding(5,3,5,3)','.setPadding(4,1,4,1)');
 for(const [before,after] of [
  ['circle(114,703,10','circle(114,701,10'],['text(114,703,"?"','text(114,701,"?"'],
  ['rectangle(170,703,88,34','rectangle(174,701,88,34'],['text(170,703,"AUTO','text(174,701,"AUTO'],
  ['rectangle(267,703,118,34','rectangle(279,701,110,34'],['text(267,703,"",','text(279,701,"",'],['text(267,703,"SHIELD','text(279,701,"SHIELD'],
  ['rectangle(400,703,140,34','rectangle(404,701,128,34'],['text(400,703,"FIRE','text(404,701,"FIRE']
 ])replace(before,after);
 return source;
}
