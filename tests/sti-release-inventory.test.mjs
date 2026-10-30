import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {test} from 'node:test';
const read=path=>JSON.parse(fs.readFileSync(new URL('../'+path,import.meta.url)));
const candidate=read('production/sti-release-candidate.json');
const current=read('production/current-release.json');
const approved=read('docs/sti-review/price-verification-20260923.json');
const manifest=read('production/manifest.json');
// These checks describe the already-published release, not the editable preview.
const archivedStiFiles=['dapp/index.html','dapp/sti-widget.js','scripts/wallet.js'];
const challengeBaselineFiles=['dapp/panel-router.css','scripts/tree-knowledge-trial.js'];
const postStiReviewedFiles=['play/index.html'];
const publishedSource=file=>file==='dapp/v3-workspace.js'
  ?'production/live-static/dapp/v3-workspace-6ac55dae.js'
  :archivedStiFiles.includes(file)
  ?'production/sti-release-static/'+file
  :challengeBaselineFiles.includes(file)
    ?'production/challenge-funding-baseline/'+file
    :postStiReviewedFiles.includes(file)
      ?'production/sti-release-static/'+file
      :manifest.files.find(f=>f.path==='/'+file)?.source||file;
const hash=(file,algorithm)=>crypto.createHash(algorithm).update(fs.readFileSync(new URL('../'+publishedSource(file),import.meta.url))).digest('hex');
test('release inventory preserves every baseline file and changes only the approved eight frontend paths',()=>{
  const base=new Map(candidate.baseline.files.map(f=>[f.path,f.sha1]));
  const next=new Map(candidate.files.map(f=>[f.path,f.sha1]));
  assert.equal(candidate.files.length,193);assert.equal(next.size,193);assert.equal(base.size,189);
  for(const file of candidate.files) {
    if(file.path==='/dapp/swap-router.js') {
      // Historical STI candidate is immutable; the current swap review is an
      // explicitly approved later change, not part of that archived candidate.
      assert.equal(file.sha1,'882f547e3a66028da1815569cc6397be2c1b7346');
      assert.equal(manifest.files.find(f=>f.path===file.path)?.sha1,'7925857dd8003ea883fd1ca9f27ac9b11f005e38');
      assert.equal(hash(file.source,'sha1'),'7925857dd8003ea883fd1ca9f27ac9b11f005e38');
    } else if (file.path==='/dapp/victory-center.js') {
      // The later VICTORY receipt and contract-expiration display are pinned; the archived
      // STI candidate and its published baseline remain unchanged.
      assert.equal(file.sha1,'e4461fc5249448c5228c7310542bd2a42f6f6a10');
      assert.equal(manifest.files.find(f=>f.path===file.path)?.sha1,'5247f64b488bc7280cef6672e938720cdfbbd733');
      assert.equal(hash(file.source,'sha1'),'5247f64b488bc7280cef6672e938720cdfbbd733');
    } else if (file.path==='/dapp/victory-center.css') {
      // This layout change is pinned separately from the historical candidate.
      assert.equal(file.sha1,'ed5155ef72a64e5bc3bc5f8479832f4f47e9045e');
      assert.equal(manifest.files.find(f=>f.path===file.path)?.sha1,'24a991520a6006ce398e3249646209e127517267');
      assert.equal(hash(file.source,'sha1'),'24a991520a6006ce398e3249646209e127517267');
    } else assert.equal(hash(file.source,'sha1'),file.sha1,file.path);
  }
  for(const pathname of base.keys())assert(next.has(pathname),'Missing production file '+pathname);
  assert.deepEqual([...next].filter(([p,h])=>base.get(p)!==h).map(([p])=>p).sort(),[...candidate.changedFiles].sort());
  assert.equal(candidate.changedFiles.length,8);
  assert(!candidate.changedFiles.some(p=>/netlify|functions|knowledge|v3-workspace/.test(p)));
});
test('release retains all production function packages, routes and schedules',()=>{
  const identities=functions=>functions.map(f=>[f.n,f.d,f.id,f.oid,f.ro,f.p,f.r,f.im]).sort((a,b)=>a[0].localeCompare(b[0]));
  const currentIdentities=identities(current.functionConfigurations);
  const currentByName=new Map(currentIdentities.map(identity=>[identity[0],identity]));
  assert.equal(candidate.baseline.functions.length,37);
  assert.equal(current.functionConfigurations.length,38);
  // The October approved recovery replaced 34 payloads. Preserve the full
  // current release identities and the historical public runtime contract.
  assert.deepEqual(currentIdentities,identities(manifest.functionConfigurations));
  for(const identity of currentIdentities){
    assert.equal(identity[1],current.functionDigests[identity[0]],identity[0]);
  }
  for(const identity of identities(candidate.baseline.functions)){
    const actual=currentByName.get(identity[0]);
    assert(actual,'Missing legacy function '+identity[0]);
    assert.deepEqual(actual.slice(4),identity.slice(4),identity[0]+' runtime contract');
  }
  const claim=currentByName.get('tree-knowledge-trial-claim');
  const recordedClaim=manifest.functionConfigurations.find(fn=>fn.n==='tree-knowledge-trial-claim');
  assert.deepEqual(claim,[recordedClaim.n,recordedClaim.d,recordedClaim.id,recordedClaim.oid,recordedClaim.ro,recordedClaim.p,recordedClaim.r,recordedClaim.im]);
  assert.equal(claim[1],current.functionDigests['tree-knowledge-trial-claim']);
  const correction=currentByName.get('tree-knowledge-trial-correction');
  const recordedCorrection=manifest.functionConfigurations.find(fn=>fn.n==='tree-knowledge-trial-correction');
  assert.deepEqual(correction,[recordedCorrection.n,recordedCorrection.d,recordedCorrection.id,recordedCorrection.oid,recordedCorrection.ro,recordedCorrection.p,recordedCorrection.r,recordedCorrection.im]);
  assert.equal(correction[1],current.functionDigests['tree-knowledge-trial-correction']);
  assert.equal(candidate.baseline.schedules.length,5);
  assert.deepEqual(candidate.baseline.schedules,current.schedules);
});
test('approved badge and purchase assets retain their recorded preview hashes',()=>{
  assert.equal(candidate.approvedSourceCommit,'5e4f6094e1647ca1d5bace65d9fd5d41ee671f17');
  assert.equal(hash('scripts/wallet.js','sha1'),candidate.reviewedWalletSha1);
  for(const [file,digest] of Object.entries(approved.sourceDigests))assert.equal(hash(file,'sha256'),digest,file);
});
