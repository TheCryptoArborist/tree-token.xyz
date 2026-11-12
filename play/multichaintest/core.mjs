// Pure simulation state. Never use this client-side model for real entitlements.
export const CHAINS = Object.freeze([
  Object.freeze({id:'robinhood',name:'Robinhood Chain',family:'EVM target',token:'USDG',pass:'25 USDG',continue:'1 USDG'}),
  Object.freeze({id:'bnb',name:'BNB Smart Chain',family:'EVM target',token:'USDT',pass:'25 USDT',continue:'1 USDT'}),
  Object.freeze({id:'base',name:'Base',family:'EVM target',token:'USDC',pass:'25 USDC',continue:'1 USDC'}),
  Object.freeze({id:'solana',name:'Solana',family:'Solana target',token:'USDC',pass:'25 USDC',continue:'1 USDC'}),
  Object.freeze({id:'sui',name:'Sui',family:'Existing home chain',token:'TREE',pass:'Existing NFTree',continue:'$1 worth of TREE'})
]);
export function newPilot(chain='robinhood') {
  if(!CHAINS.some(c=>c.id===chain)) throw new Error('Unsupported pilot chain');
  return {chain,access:false,phase:'idle',score:0,wave:1,lives:3,continues:0,payment:'none'};
}
export function grantAccess(s) { if(s.phase!=='idle') throw new Error('Reset before granting access'); return {...s,access:true,phase:'access'}; }
export function startRun(s) { if(!s.access||s.phase!=='access') throw new Error('Simulated access is required'); return {...s,phase:'loading'}; }
export function syncRun(s,run) {
  if(!s.access || !['loading','playing','continue','complete'].includes(s.phase)) return s;
  if(!['playing','continue','complete'].includes(run.phase)) throw new Error('Invalid run phase');
  for(const k of ['score','wave','lives']) if(!Number.isFinite(run[k])||run[k]<0) throw new Error('Invalid run data');
  return {...s,phase:run.phase,score:Math.round(run.score),wave:Math.max(1,Math.round(run.wave)),lives:Math.round(run.lives)};
}
export function applyContinue(s,outcome) {
  if(s.phase!=='continue'||!s.access) throw new Error('No active continue');
  if(!['success','cancelled','failed'].includes(outcome)) throw new Error('Invalid simulated outcome');
  return outcome==='success'?{...s,phase:'playing',lives:3,continues:s.continues+1,payment:outcome}:{...s,payment:outcome};
}
