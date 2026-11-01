import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
export function rebaseTreeForceAssets(source) {
  const arcade=resolve(source,'app/game/arcade.ts');
  const original=readFileSync(arcade,'utf8');
  let rebased=0;
  const native=original.replace(/"\/assets\/([^"\n]+)"/g,(_,file)=>{
    rebased++;return 'import.meta.env.BASE_URL+'+JSON.stringify('assets/'+file);
  });
  if(rebased!==7)throw Error('Unexpected TREE FORCE asset URL inventory');
  writeFileSync(arcade,native);
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
  if(!process.argv[2])throw Error('Pinned game source directory required');
  rebaseTreeForceAssets(resolve(process.argv[2]));
}
