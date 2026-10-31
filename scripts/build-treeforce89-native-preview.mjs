import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {mkdirSync,rmSync,cpSync} from 'node:fs';
import {rebaseTreeForceAssets} from './rebase-treeforce89-assets.mjs';
import {styleTreeForceGateway} from './style-treeforce89-gateway.mjs';
import {applyPaidContinue} from './apply-treeforce89-paid-continue.mjs';

const root=resolve(import.meta.dirname,'..');
const pinned='a38e08e37e1f71ea41b86add8e26a92b0789cf22';
const source=resolve(root,'.netlify/treeforce89-pinned');
const destination=resolve(root,'dist-preview/play/treeforce89');
rmSync(source,{recursive:true,force:true});mkdirSync(source,{recursive:true});
const run=(command,args,cwd)=>execFileSync(command,args,{cwd,stdio:'inherit'});
run('git',['init','--quiet'],source);
run('git',['fetch','--quiet','--depth','1','https://github.com/TheCryptoArborist/treeforce89.git',pinned],source);
run('git',['checkout','--quiet','--detach','FETCH_HEAD'],source);
if(execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim()!==pinned)
  throw Error('Pinned TREE FORCE source mismatch');

// Preserve the pinned wallet setup and dependency lock. The explicit paid
// continuation overlay below adds checkout and resume behavior separately.
rebaseTreeForceAssets(source);
run('npm',['ci','--ignore-scripts','--no-audit','--no-fund'],source);
applyPaidContinue(source);
run('npm',['run','build','--','--base','/play/treeforce89/'],source);
run('node',[resolve(root,'scripts/verify-treeforce89-staged-assets.mjs'),resolve(source,'dist')],root);
rmSync(destination,{recursive:true,force:true});mkdirSync(destination,{recursive:true});
cpSync(resolve(source,'dist'),destination,{recursive:true});
styleTreeForceGateway(destination);
console.log('Staged pinned native TREE FORCE preview under /play/treeforce89/; payments disabled.');
