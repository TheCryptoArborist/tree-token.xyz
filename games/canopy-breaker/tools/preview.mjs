import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const flag=name=>process.argv.includes(name)?process.argv[process.argv.indexOf(name)+1]:null;
const root=process.cwd(),port=Number(flag('--port')||process.env.PORT||5173),host=flag('--host')||process.env.HOST||'127.0.0.1';
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.png':'image/png','.svg':'image/svg+xml'};
http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;let file;
 if(p==='/standalone'){const artifact=path.resolve(root,'../../../Canopy-Breaker-First-Playable.html');if(fs.existsSync(artifact)){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(fs.readFileSync(artifact));return;}}
 if(p==='/mobile'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><meta charset="utf-8"><title>Canopy Breaker · 390px test</title><body style="margin:0;background:#141a20"><iframe title="390px mobile layout" src="/" width="390" height="844" style="display:block;margin:24px auto;border:0"></iframe></body>');return;}
 if(p==='/'||p==='/index.html'){const html=fs.readFileSync('dist/index.html','utf8').replace('src="./gateway.js"','src="./tools/local-test.mjs"');res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});res.end(html);return;}
 if(p.startsWith('/src/')&&/\.(js)$/.test(p))file=path.join(root,p);
 else if(p==='/tools/local-test.mjs')file=path.join(root,p);
 else if(['/style.css','/tree-token.png','/forest.svg'].includes(p))file=path.join(root,'dist',p);
 if(!file||!file.startsWith(root+'/')||!fs.existsSync(file)){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(file));
}).listen(port,host,()=>console.log(`Local mechanics preview on http://${host}:${port}`));
