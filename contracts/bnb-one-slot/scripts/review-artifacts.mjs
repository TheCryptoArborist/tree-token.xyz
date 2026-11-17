import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import solc from 'solc';
import {artifact,input,root} from './compile.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const contracts={};
for(const [file,name] of [['src/Policy.sol','Policy'],['src/TreeSuitePass.sol','TreeSuitePass'],['src/TreePassAdapter.sol','TreePassAdapter']]){
 const a=artifact(file,name);contracts[name]={source:file,sourceSha256:sha(input.sources[file].content),abi:a.abi,creationBytecode:'0x'+a.evm.bytecode.object,runtimeTemplate:'0x'+a.evm.deployedBytecode.object,immutableReferences:a.evm.deployedBytecode.immutableReferences};
}
const out={status:'REVIEW_ONLY_NOT_DEPLOYED',compiler:solc.version(),evmVersion:'shanghai',optimizerRuns:200,dependencyLockSha256:sha(fs.readFileSync(path.join(root,'package-lock.json'))),requiredBindings:['Actual published Sui original package CallCap identity','Actual shared Vault route object ID','Intended BNB deployer/initial buyer 0x90f9c1c0c675a0ce9d539c540db7f4a1f7e583ae'],contracts};
const dest=path.resolve(root,'../../docs/multichain/bnb-one-slot/reviewed-artifacts.json');
if(process.argv.includes('--check')){if(fs.readFileSync(dest,'utf8')!==JSON.stringify(out,null,2)+'\n')throw Error('Reviewed artifacts differ from pinned build');console.log('Reviewed production artifacts match pinned build');}
else {fs.writeFileSync(dest,JSON.stringify(out,null,2)+'\n');console.log('Wrote reviewed production artifacts; no fixture contracts included');}
