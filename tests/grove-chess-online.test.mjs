import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {PGlite} from '../vendor/arcade-events/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();await db.exec('create schema private; create role anon; create role authenticated; create role service_role;');
await db.exec(await fs.readFile(new URL('../supabase/migrations/20261125064318_grove_chess_rooms.sql',import.meta.url),'utf8'));
const a='a'.repeat(64),b='b'.repeat(64),c='c'.repeat(64),r='12345678-1234-4123-8123-123456789012';
async function rpc(action,actor=a,room=r,extra={}){const args={p_action:action,p_actor:actor,p_room:room,...extra};const names=Object.keys(args);return (await db.query('select public.grove_chess_v1('+names.map((k,i)=>k+'=> $'+(i+1)).join(',')+') as result',Object.values(args))).rows[0].result;}
test('waiting rooms do not spend trials; joining charges once and fixes two distinct seats',async()=>{
 const created=await rpc('create',a,r,{p_announce:true});assert.equal(created.used,0);
 const feed=await rpc('invitations');assert.equal(feed.entries.length,1);
 const joined=await rpc('join',b);assert.equal(joined.seat,'b');assert.equal(joined.used,1);assert.equal(joined.status,'playing');
 assert.equal((await rpc('join',b)).used,1);assert.equal((await rpc('read',a)).used,1);
 assert.equal((await rpc('join',c)).seat,null);assert.equal((await rpc('invitations')).entries.length,0);
});
test('stale revisions and outsider writes cannot change a match',async()=>{
 await assert.rejects(rpc('move',c,r,{p_revision:1,p_pgn:'1. e4'}),/not-your-seat/);
 await assert.rejects(rpc('move',a,r,{p_revision:0,p_pgn:'1. e4'}),/revision-conflict/);
 const moved=await rpc('move',a,r,{p_revision:1,p_pgn:'1. e4'});assert.equal(moved.revision,2);
 await assert.rejects(rpc('move',b,r,{p_revision:1,p_pgn:'1. d4'}),/revision-conflict/);
 assert.equal((await rpc('read',a)).pgn,'1. e4');
});
test('trial limits and holder binding are enforced in the transaction',async()=>{
 await assert.rejects(rpc('create',c,'22345678-1234-4123-8123-123456789012',{p_used:2}),/nftree-required/);
 const wallet='0x'+'1'.repeat(64),id='32345678-1234-4123-8123-123456789012';
 await rpc('create',c,id,{p_used:2,p_wallet:wallet});
 await assert.rejects(rpc('cancel',c,id,{p_revision:0}),/nftree-required/);
 assert.equal((await rpc('cancel',c,id,{p_revision:0,p_wallet:wallet})).status,'cancelled');
});
test('anonymous database users cannot call the service RPC or read tables',async()=>{
 await db.exec('set role anon');await assert.rejects(db.query('select public.grove_chess_v1(\'invitations\')'),/permission denied/);await assert.rejects(db.query('select * from private.grove_chess_rooms'),/permission denied/);await db.exec('reset role');
});
test('the second online game consumes the final trial and a third requires an NFTree',async()=>{
 await rpc('resign',a,r,{p_revision:2,p_result:'Pine wins by resignation.'});
 await db.query('update private.grove_chess_players set last_created=null where id=$1',[a]);
 const id='42345678-1234-4123-8123-123456789012';await rpc('create',a,id);assert.equal((await rpc('join',b,id)).used,2);assert.equal((await rpc('read',a,id)).used,2);
 await rpc('resign',a,id,{p_revision:1,p_result:'Pine wins by resignation.'});
 await assert.rejects(rpc('create',a,'52345678-1234-4123-8123-123456789012'),/nftree-required/);
});
