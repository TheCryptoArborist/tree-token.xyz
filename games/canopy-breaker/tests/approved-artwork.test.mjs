import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {BACKGROUND_VIEWS,sourceRect} from '../src/background-art.js';
import {PICKUP_ART} from '../src/pickup-art.js';

const manifest=JSON.parse(fs.readFileSync('docs/approved-artwork.json'));
const png=name=>fs.readFileSync('public/assets/'+name+'.png');
const dimensions=name=>{const b=png(name);return [b.readUInt32BE(16),b.readUInt32BE(20)];};
test('release images retain the exact bytes of the approved playable artwork',()=>{
  for(const [name,record] of Object.entries(manifest.assets)){
    const bytes=fs.readFileSync('public/assets/'+name);
    assert.equal(bytes.length,record.size);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256,name);
  }
});
test('all five world crops fit their source images and cover the game aspect ratio',()=>{
  assert.equal(BACKGROUND_VIEWS.length,5);
  assert.equal(new Set(BACKGROUND_VIEWS.map(v=>JSON.stringify(v))).size,5);
  for(let i=0;i<5;i++){
    const {source,rect:[x,y,w,h]}=sourceRect(i),[iw,ih]=dimensions(source);
    assert.ok(x>=0&&y>=0&&x+w<=iw&&y+h<=ih);
    assert.ok(Math.abs(w/h-8/9)<1e-10);
  }
});
test('each gameplay pickup uses a complete illustrated sprite inside the approved atlas',()=>{
  const [w,h]=dimensions('pickups');
  assert.equal(Object.keys(PICKUP_ART).length,8);
  for(const {rect:[x,y,cw,ch]} of Object.values(PICKUP_ART)){
    assert.ok(cw>0&&ch>0&&x>=0&&y>=0&&x+cw<=w&&y+ch<=h);
  }
});
