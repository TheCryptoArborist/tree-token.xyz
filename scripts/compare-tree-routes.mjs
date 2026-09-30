import {spawn} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {compareSession} from './lib/tree-comparison-session.mjs';

if(process.argv.slice(2).join(' ')!=='--read-only') {
  console.error('Opt-in required: node --experimental-strip-types scripts/compare-tree-routes.mjs --read-only');
  process.exit(2);
}
const root=fileURLToPath(new URL('../',import.meta.url));
const startedAt=Date.now();
const dir=resolve(root,'artifacts/tree-comparisons',new Date(startedAt).toISOString().replace(/[:.]/g,'-'));
mkdirSync(dir,{recursive:true});
const save=value=>writeFileSync(join(dir,'comparison.json'),JSON.stringify(value,null,2));
const rounds=[];
try {
  for(let round=1;round<=3;round++) {
    const output=join(dir,`round-${round}`);
    console.log(`Refreshing pools and simulating comparison ${round}/3...`);
    await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,['--experimental-strip-types','scripts/study-tree-splits.mjs'],{cwd:root,env:{...process.env,TREE_SPLIT_OUTPUT_DIR:output},stdio:['ignore','pipe','pipe'],windowsHide:true,timeout:180_000});
      let log='';
      child.stdout.on('data',chunk=>{log+=chunk;});
      child.stderr.on('data',chunk=>{log+=chunk;});
      child.on('error',reject);
      child.on('close',(code,signal)=>{
        writeFileSync(join(dir,`round-${round}.log`),log);
        if(code===0) resolve();else reject(new Error(`round-${round}-failed:${signal ?? code}`));
      });
    });
    rounds.push(JSON.parse(readFileSync(join(output,'split-study.json'),'utf8')));
  }
  const result=compareSession(rounds,{startedAt});save(result);
  console.log(result.status);
  for(const row of result.cases) console.log(`${row.sui} SUI: ${row.repeatedImprovements.length} allocations improved in all three fresh comparisons.`);
  console.log(`Evidence: ${dir}`);
} catch(error) {
  save({complete:false,status:'inconclusive',startedAt:new Date(startedAt).toISOString(),completedAt:new Date().toISOString(),completedRounds:rounds.length,error:String(error),submitted:false,productionChanged:false});
  console.error(`Comparison inconclusive: ${error}. Evidence: ${dir}`);
  process.exitCode=1;
}
