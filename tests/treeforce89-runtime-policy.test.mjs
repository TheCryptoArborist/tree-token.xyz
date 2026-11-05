import {test} from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import pg from 'pg';
import {canonicalPaidContinuesEnabled,configureGameDatabasePool,databaseTimeouts} from '../netlify/preview-lib/treeforce89-runtime-policy.mjs';
import {paidContinuesEnabled,getGatewayServices} from '../netlify/preview-lib/treeforce89-gateway.mjs';
import {checkDirectNFTreeOwnership} from '../netlify/preview-lib/treeforce89-source/game/nftree-access.mjs';

test('canonical policy enables only the namespaced handler; previews stay disabled by default',()=>{
 const before=process.env.TREEFORCE89_PAID_CONTINUES_ENABLED;
 try{delete process.env.TREEFORCE89_PAID_CONTINUES_ENABLED;assert.equal(canonicalPaidContinuesEnabled,true);assert.equal(paidContinuesEnabled(),false);}
 finally{if(before===undefined)delete process.env.TREEFORCE89_PAID_CONTINUES_ENABLED;else process.env.TREEFORCE89_PAID_CONTINUES_ENABLED=before;}
});
test('a stalled PostgreSQL handshake expires and releases the pool slot',async()=>{
 const sockets=new Set();
 const server=net.createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const pool=configureGameDatabasePool(new pg.Pool({host:'127.0.0.1',port:server.address().port,user:'fixture',password:'fixture',database:'fixture'}));
 assert.equal(pool.options.query_timeout,databaseTimeouts.query_timeout);
 pool.options.connectionTimeoutMillis=80;
 try{for(let i=0;i<2;i++)await assert.rejects(pool.query('SELECT 1'),/timeout|terminated/i);assert.equal(pool.waitingCount,0);}
 finally{await pool.end();for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));}
});
test('ownership lookup aborts instead of granting access when the chain stalls',async()=>{
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30);
 const client={core:{listOwnedObjects:({signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))}};
 try{await assert.rejects(checkDirectNFTreeOwnership({client,wallet:'0x1',signal:controller.signal}),{name:'AbortError'});}
 finally{clearTimeout(timer);}
});
test('failed schema readiness can be retried on a warm function instance',async()=>{
 let attempts=0;const pool={connect:async()=>{attempts++;throw Error('fixture unavailable');}};
 for(let i=0;i<2;i++)await assert.rejects(getGatewayServices('https://tree-token.xyz',()=>({pool})),/fixture unavailable/);
 assert.equal(attempts,2);
});
