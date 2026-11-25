import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreStep} from '../../treeforce89/frontend/game/sound-identity.mjs';
import {holidayNotes} from '../../treeforce89/frontend/game/christmas-audio.mjs';
test('normal is identical; seasonal keeps voice budget, bass, percussion and boss urgency',()=>{
 let changed=0;
 for(const mood of ['normal','bonus','boss'])for(let step=0;step<128;step++){
  const notes=scoreStep(mood,step), before=structuredClone(notes), festive=holidayNotes(notes,mood,true);
  assert.equal(holidayNotes(notes,mood,false),notes);
  assert.equal(festive.length,notes.length);assert.deepEqual(notes,before);
  if(mood==='boss')assert.equal(festive,notes);
  festive.forEach((n,i)=>{if(n!==notes[i]){changed++;assert.equal(i,0);assert.ok(n.volume<=notes[i].volume);assert.ok(n.duration<=.24);}else assert.deepEqual(n,notes[i]);});
 }
 assert.ok(changed>0);
});
