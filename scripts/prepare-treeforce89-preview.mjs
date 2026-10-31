import {mkdirSync,writeFileSync} from 'node:fs';
const dir=new URL('../netlify/generated/',import.meta.url);
mkdirSync(dir,{recursive:true});
writeFileSync(new URL('treeforce89-context.json',dir),JSON.stringify({
  branch:process.env.HEAD||process.env.BRANCH||'',
  context:process.env.CONTEXT||'local',
  prNumber:Number(process.env.REVIEW_ID)||0,
})+'\n');
