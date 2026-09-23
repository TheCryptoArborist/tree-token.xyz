import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {test} from 'node:test';
const read=path=>JSON.parse(fs.readFileSync(new URL('../'+path,import.meta.url)));
const candidate=read('production/sti-release-candidate.json');
const current=read('production/current-release.json');
const approved=read('docs/sti-review/price-verification-20260923.json');
const hash=(file,algorithm)=>crypto.createHash(algorithm).update(fs.readFileSync(new URL('../'+file,import.meta.url))).digest('hex');
test('release inventory preserves every baseline file and changes only the approved eight frontend paths',()=>{
  const base=new Map(candidate.baseline.files.map(f=>[f.path,f.sha1]));
  const next=new Map(candidate.files.map(f=>[f.path,f.sha1]));
  assert.equal(candidate.files.length,193);assert.equal(next.size,193);assert.equal(base.size,189);
  for(const file of candidate.files)assert.equal(hash(file.source,'sha1'),file.sha1,file.path);
  for(const pathname of base.keys())assert(next.has(pathname),'Missing production file '+pathname);
  assert.deepEqual([...next].filter(([p,h])=>base.get(p)!==h).map(([p])=>p).sort(),[...candidate.changedFiles].sort());
  assert.equal(candidate.changedFiles.length,8);
  assert(!candidate.changedFiles.some(p=>/netlify|functions|knowledge|v3-workspace/.test(p)));
});
test('release retains all production function packages, routes and schedules',()=>{
  const identities=functions=>functions.map(f=>[f.n,f.d,f.id,f.oid,f.ro,f.p,f.r,f.im]).sort((a,b)=>a[0].localeCompare(b[0]));
  assert.equal(candidate.baseline.functions.length,37);
  assert.deepEqual(identities(candidate.baseline.functions),identities(current.functionConfigurations));
  assert.equal(candidate.baseline.schedules.length,5);
  assert.deepEqual(candidate.baseline.schedules,current.schedules);
});
test('approved badge and purchase assets retain their recorded preview hashes',()=>{
  assert.equal(candidate.approvedSourceCommit,'5e4f6094e1647ca1d5bace65d9fd5d41ee671f17');
  assert.equal(hash('scripts/wallet.js','sha1'),candidate.reviewedWalletSha1);
  for(const [file,digest] of Object.entries(approved.sourceDigests))assert.equal(hash(file,'sha256'),digest,file);
});
