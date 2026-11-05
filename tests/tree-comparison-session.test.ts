import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {compareSession} from '../scripts/lib/tree-comparison-session.mjs';

const saved=JSON.parse(readFileSync(new URL('../reports/tree-splits/split-study.json',import.meta.url),'utf8'));
const startedAt=Date.now(),now=startedAt+4000;
const rounds=()=>[1,2,3].map(n=>({...structuredClone(saved),observedAt:new Date(startedAt+n*1000).toISOString()}));
function improve(round:any,index=1) {
  const row=round.cases[0],candidate=row.candidates[index];
  candidate.amountOut=String(BigInt(row.equalBudgetComparators[candidate.gasMist].amountOut)+100n);
  candidate.equalBudgetGainRaw='100';
}
test('saved negative evidence stays negative, while the same repeated allocation is flagged',()=>{
  const input=rounds();
  assert.equal(compareSession(input,{startedAt,now}).status,'no-repeated-improvement');
  input.forEach(r=>improve(r));
  const result=compareSession(input,{startedAt,now});
  assert.equal(result.status,'repeated-improvement-observed');
  assert.equal(result.cases[0].repeatedImprovements.length,1);
  assert.equal(result.cases[0].repeatedImprovements[0].minimumGainRaw,'100');
});
test('different winners and a one-round improvement are not reproducible',()=>{
  const input=rounds();input.forEach((r,i)=>improve(r,i+1));
  assert.equal(compareSession(input,{startedAt,now}).status,'no-repeated-improvement');
  const single=rounds();improve(single[0]);
  assert.equal(compareSession(single,{startedAt,now}).status,'no-repeated-improvement');
});
test('missing, stale, duplicate and incomplete evidence fails closed',()=>{
  assert.throws(()=>compareSession(rounds().slice(1),{startedAt,now}),/incomplete/);
  assert.throws(()=>compareSession(rounds(),{startedAt,now:now+600_000}),/expired/);
  for(const mutate of [
    (r:any)=>{r[1].observedAt=r[0].observedAt;},
    (r:any)=>{r[0].observedAt=new Date(startedAt-1).toISOString();},
    (r:any)=>{r[0].cases[0].stable=false;},
    (r:any)=>{r[0].cases[0].candidates.pop();},
    (r:any)=>{r[0].cases[0].negative.summary.success=true;},
    (r:any)=>{r[0].cases[0].candidates[1].equalBudgetGainRaw='1';},
    (r:any)=>{Object.values(r[0].cases[0].equalBudgetComparators).forEach((c:any)=>c.amountIn='1');},
  ]) {const input=rounds();mutate(input);assert.throws(()=>compareSession(input,{startedAt,now}));}
});
test('CLI refuses to start without explicit read-only opt-in',()=>{
  const run=spawnSync(process.execPath,['--experimental-strip-types','scripts/compare-tree-routes.mjs'],{encoding:'utf8'});
  assert.equal(run.status,2);assert.match(run.stderr,/Opt-in required/);assert.equal(run.stdout,'');
});
