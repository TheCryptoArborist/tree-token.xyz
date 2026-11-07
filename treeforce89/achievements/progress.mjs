const extra=['maxChain','clearedWaves','cleanWaves','turboPickups','boomPickups'];
const original=['runId','seed','score','wave','kills','perfect','maxStage','shotsFired','shotsHit','start','mode'];
export function checkoutSnapshot(run,storage=globalThis.sessionStorage){
 const progress={ranked:run.ranked===true};for(const k of extra)progress[k]=Number.isSafeInteger(run[k])&&run[k]>=0?run[k]:0;
 try{storage.setItem('treeforce-progress:'+run.runId,JSON.stringify(progress));}catch{}
 return Object.fromEntries(original.map(k=>[k,run[k]]));
}
export function restoreProgress(run,storage=globalThis.sessionStorage){
 try{const progress=JSON.parse(storage.getItem('treeforce-progress:'+run.runId)||'null');if(progress&&extra.every(k=>Number.isSafeInteger(progress[k])&&progress[k]>=0))return {...run,...Object.fromEntries(extra.map(k=>[k,progress[k]])),ranked:progress.ranked===true};}catch{}
 return {...run,ranked:false};
}
