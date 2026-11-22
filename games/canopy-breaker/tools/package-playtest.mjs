import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import os from 'node:os';
import {build} from 'esbuild';
const output=path.resolve(process.argv[2]||'../../../Canopy-Breaker-First-Playable.html');
const read=p=>fs.readFileSync(p,'utf8');
const inlineArt={name:'offline-art',setup(b){b.onLoad({filter:/\.js$/},args=>({contents:read(args.path).replace(/\/play\/canopy-breaker\/assets\/([a-z]+\.png)/g,(_,name)=>`data:image/png;base64,${fs.readFileSync('public/assets/'+name).toString('base64')}`),loader:'js'}));}};
const result=await build({entryPoints:['tools/local-test.mjs'],bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',plugins:[inlineArt]});
const code=result.outputFiles[0].text;
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'breaker-parse-')),check=path.join(temp,'playtest.mjs');fs.writeFileSync(check,code);execFileSync(process.execPath,['--check',check]);fs.rmSync(temp,{recursive:true});
let html=read('public/index.html');const css=read('dist/style.css').replace(/^@import[^\n]*\n/,'').replace('url("./forest.svg")',`url("data:image/svg+xml;base64,${fs.readFileSync('dist/forest.svg').toString('base64')}")`);
html=html.replace('<link rel="stylesheet" href="./style.css">','<style>'+css+'</style>').replace('src="./tree-token.png"',`src="data:image/png;base64,${fs.readFileSync('public/tree-token.png').toString('base64')}"`).replace('<script type="module" src="./gateway.js"></script>','<script type="module">'+code.replace(/<\/script/gi,'<\\/script')+'</script>');
// The downloadable build is explicitly a local mechanics test. No wallet SDK,
// auth API, payment transaction code, production cookies or live RPC is included.
html=html.replace('Canopy Breaker · TREE Arcade</title>','Canopy Breaker · Local Playtest</title>').replace('<div id="test-notice" hidden>','<div id="test-notice">');
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,html);console.log(JSON.stringify({file:output,bytes:fs.statSync(output).size,mode:'local-only; access and payments simulated'}));
