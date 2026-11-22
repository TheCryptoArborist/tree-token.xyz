import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  DELIVERY_SOURCES, REQUIRED_CHANGES, ADDED_PATHS, CONTROL_FILE, REVIEW_FILE,
  FOREST_BROWSER_CHECKS, assembleFiles, validateUploadRequirements,
  validateBrowserReview, validatePublicationControl, validateControlCommit,
} from '../scripts/release-arcade-advent.mjs';
import { fingerprint } from '../scripts/release-preserved-production.mjs';

const sha1 = input => crypto.createHash('sha1').update(input).digest('hex');
const sha256 = input => crypto.createHash('sha256').update(input).digest('hex');
const BASE='a'.repeat(24), CANDIDATE='b'.repeat(24), SOURCE='c'.repeat(40), TREE='d'.repeat(40), MAIN='e'.repeat(40);
function baseline() {
  return Object.fromEntries([
    '/index.html','/play/index.html','/scripts/arcade-monthly.js',
    '/scripts/arcade-season-deadline.js','/scripts/arcade-organization.js',
    '/scripts/arcade-attendance-forest.js','/styles/arcade-organization.css',
    '/assets/arcade/other-game.webp',
  ].map(path=>[path,sha1('prior '+path)]));
}
const overlays=()=>Object.entries(DELIVERY_SOURCES).map(([path,source])=>({path,source,sha1:sha1('new '+path)}));
test('only three existing visual files change and two approved modules are added',()=>{
  const base=baseline(),plan=assembleFiles(base,overlays());
  assert.deepEqual(plan.changedOriginals,[...REQUIRED_CHANGES].sort());
  assert.deepEqual(plan.addedPaths,[...ADDED_PATHS].sort());
  assert.equal(Object.keys(plan.files).length,Object.keys(base).length+2);
  assert.equal(plan.files['/assets/arcade/other-game.webp'],base['/assets/arcade/other-game.webp']);
  assert.equal(plan.files['/play/index.html'],base['/play/index.html']);
});
test('unreviewed files, missing modules, overwrite and backend uploads cannot pass',()=>{
  const base=baseline(),rows=overlays(),plan=assembleFiles(base,rows);
  for (const path of ['/play/index.html','/assets/arcade/other-game.webp','/netlify/functions/arcade-monthly.js'])
    assert.throws(()=>assembleFiles(base,[...rows,{path,source:path.slice(1),sha1:sha1('outside')}]),/Unapproved/);
  for (const added of ADDED_PATHS) {
    assert.throws(()=>assembleFiles(base,rows.filter(row=>row.path!==added)),/Complete approved source inventory/);
    assert.throws(()=>assembleFiles({...base,[added]:sha1('already live')},rows),/already in production/);
  }
  for(const old of REQUIRED_CHANGES) {
    const noOp=rows.map(row=>row.path===old?{...row,sha1:base[old]}:row);
    assert.throws(()=>assembleFiles(base,noOp),/All three reviewed/);
  }
  const valid={required:[...plan.changedOriginals,...plan.addedPaths].map(p=>plan.files[p]),
    required_functions:[],required_edge_functions:[],required_server:[]};
  validateUploadRequirements(valid,plan);
  assert.throws(()=>validateUploadRequirements({...valid,required_functions:['backend']},plan),/upload forbidden/);
  assert.throws(()=>validateUploadRequirements({...valid,required:[base['/play/index.html']]},plan),/Unchanged or unapproved/);
});
function control(){return {
  schemaVersion:1,action:'publish-arcade-advent',sourceCommit:SOURCE,sourceTree:TREE,mainCommit:MAIN,
  expectedDeploy:BASE,candidateId:CANDIDATE,planSha256:sha256('plan'),
  candidateRunId:135,candidateArtifactId:145,candidateArtifactSHA256:sha256('archive'),browserReview:REVIEW_FILE
};}
test('candidate publication is bound to exact merged tree, artifacts and approved control files',()=>{
  validatePublicationControl(control());
  validateControlCommit(control(),{mode:'publish',parents:[MAIN],mainTree:TREE,
    changedFiles:[CONTROL_FILE,REVIEW_FILE],message:'[publish arcade advent] [skip netlify]'});
  assert.throws(()=>validateControlCommit(control(),{mode:'publish',parents:[SOURCE],mainTree:TREE,
    changedFiles:[CONTROL_FILE,REVIEW_FILE],message:'[publish arcade advent] [skip netlify]'}));
  assert.throws(()=>validatePublicationControl({...control(),candidateId:BASE}),/older deploy/);
  assert.throws(()=>validatePublicationControl({...control(),action:'publish-arcade-cutoff'}));
});
test('December visual release needs all 21 isolated browser scenarios and new tile, wallet and countdown checks',()=>{
  const plan={sourceCommit:SOURCE,sourceTree:TREE},state={id:CANDIDATE,candidateCreatedAt:'2026-11-22T21:00:00Z'};
  const checkedAt='2026-11-22T21:02:00Z',now=Date.parse('2026-11-22T21:03:00Z');
  const keys=['games','daily','campaigns','events','monthlyProgress','badgeCollection','mobileLayout','noMissingAssets','countdownUTC',...FOREST_BROWSER_CHECKS];
  const report={schemaVersion:1,result:'passed',sourceCommit:SOURCE,sourceTree:TREE,candidateId:CANDIDATE,
    planSha256:fingerprint(plan),origin:'https://'+CANDIDATE+'--tree-token.netlify.app',
    noWalletOrPaymentActions:true,syntheticWalletOnly:true,syntheticDataOnly:true,
    checkedAt,viewportWidths:[320,390,1280],expectedScenarioCount:21,
    checks:Object.fromEntries(keys.map(key=>[key,true]))};
  validateBrowserReview(report,plan,state,now);
  for(const key of ['adventGrove','recoveredTileIcon','nextMonthCountdown']){
    const broken={...report,checks:{...report.checks,[key]:false}};
    assert.throws(()=>validateBrowserReview(broken,plan,state,now),/Missing candidate forest check/);
  }
});
