import assert from 'node:assert/strict';

const canonical=value=>JSON.stringify(value,(_,entry)=>entry&&typeof entry==='object'&&!Array.isArray(entry)?Object.fromEntries(Object.entries(entry).sort(([a],[b])=>a.localeCompare(b))):entry);
function normalizeAliases(record,original){
 const normalized={...record};
 for(const [override,effective]of [['mo','m'],['rgo','rg']])if(!Object.hasOwn(original,override)&&normalized[override]===original[effective])delete normalized[override];
 return normalized;
}

export function verifyEventFunctions({functions,baseline,packageMetadata,pinnedEventRecord}){
 assert.equal(canonical(functions.map(fn=>fn.n).sort()),canonical(baseline.map(fn=>fn.n).sort()),'Function inventory changed');
 let eventRecord;
 for(const original of baseline){
  const raw=functions.find(fn=>fn.n===original.n),current=normalizeAliases(raw,original);
  if(original.n!=='arcade-events'){
   assert.equal(canonical(current),canonical(original),'Unrelated function changed: '+original.n);
   continue;
  }
  assert.equal(current.d,packageMetadata.sha256,'Wrong event package');
  assert.equal(current.s,packageMetadata.size,'Wrong event package byte size');
  assert.equal(canonical(current.bd),canonical(packageMetadata.buildData),'Wrong event build metadata');
  // Netlify CLI maps available_functions.a to its log service account_id:
  // https://github.com/netlify/cli/blob/3fe8202fe7424f8934d6373ac55b215c77433f7c/src/commands/logs/sources/functions.ts
  // It is provisioned account metadata, not a writable functionConfig field.
  assert(typeof current.a==='string'&&/^\d{12}$/.test(current.a),'Invalid event provider account');
  if(current.a!==original.a)assert.notEqual(current.d,original.d,'An unchanged event package cannot move provider accounts');
  const packageFields=new Set(['d','id','oid','a','s','c','bd']);
  const stable=record=>Object.fromEntries(Object.entries(record).filter(([key])=>!packageFields.has(key)));
  assert.equal(canonical(stable(current)),canonical(stable(original)),'Event execution configuration changed');
  if(pinnedEventRecord!==undefined)assert.equal(canonical(raw),canonical(pinnedEventRecord),'Event provisioning record changed after candidate verification');
  // Preserve every raw field, including aliases and provider placement, for the
  // exact comparison during verify, immediately before lock, and after lock.
  eventRecord=structuredClone(raw);
 }
 assert(eventRecord,'The event handler is missing');
 return eventRecord;
}
