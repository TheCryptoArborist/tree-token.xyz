import {build} from 'esbuild';
await build({entryPoints:[new URL('./app.mjs',import.meta.url).pathname],outfile:new URL('./app.js',import.meta.url).pathname,bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022'});
await build({entryPoints:[new URL('./bnb-verifier-entry.mjs',import.meta.url).pathname],outfile:new URL('../../vendor/generation-acknowledgement/bnb-verifier.mjs',import.meta.url).pathname,bundle:true,minify:true,format:'esm',platform:'node',target:'node24'});
