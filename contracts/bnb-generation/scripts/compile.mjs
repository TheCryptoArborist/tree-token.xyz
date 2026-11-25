import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import solc from 'solc';
export const root=fileURLToPath(new URL('../',import.meta.url));
const production=['src/Policy.sol','src/TreeSuitePass.sol','src/TreePassAdapter.sol'];
const sources=[...production,'test/Fixtures.sol'].filter(p=>fs.existsSync(path.join(root,p)));
export const input={language:'Solidity',sources:Object.fromEntries(sources.map(p=>[p,{content:fs.readFileSync(path.join(root,p),'utf8')}])),settings:{evmVersion:'shanghai',optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','evm.deployedBytecode.immutableReferences']}}}};
export const output=JSON.parse(solc.compile(JSON.stringify(input),{import:p=>{try{return {contents:fs.readFileSync(path.join(root,'node_modules',p),'utf8')}}catch{return {error:'Unresolved pinned dependency '+p}}}}));
assert.deepEqual((output.errors??[]).filter(e=>e.severity==='error'),[],(output.errors??[]).map(e=>e.formattedMessage).join('\n'));
export function artifact(file,name){return output.contracts[file][name];}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const out=path.join(root,'artifacts');fs.mkdirSync(out,{recursive:true});
 for(const [file,names] of Object.entries(output.contracts))for(const [name,a]of Object.entries(names))if(production.includes(file))fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(a,null,2)+'\n');
 console.log(JSON.stringify({compiler:solc.version(),optimizer:200,evmVersion:'shanghai',production:production.map(file=>({file,sha256:createHash('sha256').update(input.sources[file].content).digest('hex')}))},null,2));
}
