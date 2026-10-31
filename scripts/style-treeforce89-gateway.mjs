import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const root=resolve(import.meta.dirname,'..');
export function styleTreeForceGateway(directory) {
  const index=resolve(directory,'index.html');
  const original=readFileSync(index,'utf8');
  assert(original.includes('<div id="root"></div>'),'Expected pinned React mount');
  assert(!original.includes('class="gateway-intro"'),'Gateway presentation already applied');
  const intro=readFileSync(resolve(root,'play/treeforce89/gateway-intro.html'),'utf8');
  const styled=original.replace('</head>','  <link rel="stylesheet" href="/play/treeforce89/gateway.css">\n  </head>')
    .replace('    <div id="root"></div>',intro+'\n    <div id="root"></div>');
  assert.deepEqual([...styled.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].map(m=>m[0]),
    [...original.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].map(m=>m[0]),'Preserve every script tag');
  writeFileSync(index,styled);
  copyFileSync(resolve(root,'play/treeforce89/gateway.css'),resolve(directory,'gateway.css'));
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  assert(process.argv[2],'Provide a staged game directory');
  styleTreeForceGateway(resolve(process.argv[2]));
  console.log('Applied Gateway HTML/CSS; script tags unchanged.');
}
