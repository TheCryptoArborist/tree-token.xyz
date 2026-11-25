// Disposable localhost database only. Does not accept hosted credentials.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {execFileSync} from 'node:child_process';import {randomBytes,randomUUID,createHash} from 'node:crypto';import assert from 'node:assert/strict';
import pg from '../../vendor/bnb-continue-store/node_modules/pg/lib/index.js';




const bin=process.env.BNB_PG_BIN;assert(bin,'Set BNB_PG_BIN');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mixed-continue-pg-')),data=path.join(dir,'data');
const port=55000+Math.floor(Math.random()*500),exe=n=>path.join(bin,n),checks=[];let started=false,owner,pool;
const hex=()=>randomBytes(32).toString('hex'),sha=s=>createHash('sha256').update(s).digest('hex');
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('PG')));
try{
 const args=['-D',data,'-A','trust','--no-locale','--encoding=UTF8'];if(process.env.BNB_PG_SHARE)args.push('-L',process.env.BNB_PG_SHARE);
 execFileSync(exe('initdb'),args,{env,stdio:'pipe'});execFileSync(exe('pg_ctl'),['-D',data,'-l',path.join(dir,'log'),'-o',`-k "" -h 127.0.0.1 -p ${port}`,'-w','start'],{env,stdio:'pipe'});started=true;
 const config={host:'127.0.0.1',port,user:os.userInfo().username,database:'postgres',password:'',ssl:false,max:20,options:''};
 owner=new pg.Pool(config);
 await owner.query('create role anon;create role authenticated;create role service_role;');
 const base='docs/multichain/generation-milestone/delivery-compatibility/';
 const provenance=JSON.parse(fs.readFileSync(base+'provenance.json','utf8'));
 for(const f of provenance.files)assert.equal(sha(fs.readFileSync(f.snapshot)),f.sha256);
 for(const file of ['direct-continue-schema.sql','flight-storage-v1.sql','paid-delivery-v1.sql'])await owner.query(fs.readFileSync(base+'upstream/'+file,'utf8'));
 checks.push('exact pinned upstream schema loads without modifications');
 const origin='https://tree-token.xyz',suiRecipient='0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f';
 async function fixture(patch={}) {
  const account=randomUUID(),run=randomUUID(),order=randomUUID(),wallet='0x'+hex();
  const snapshot=JSON.stringify({format:'treeforce89.checkpoint.v1',ruleset:'treeforce89.v1',runId:run,wave:1,score:1,lives:0,continuesUsed:0,scene:{fixture:true}}),hash=sha(snapshot);
  await owner.query('select tree_continue_v1.register_flight($1,$2,$3,$4,$5)',[account,wallet,origin,'mainnet',run]);
  const checkpoint=(await owner.query('select tree_continue_v1.store_checkpoint($1,$2,$3,$4,$5,$6,$7,$8) as data',[account,wallet,origin,'mainnet',run,randomUUID(),snapshot,hash])).rows[0].data;
  await owner.query("insert into tree_continue_v1.checkpoint_reviews(checkpoint_id,outcome,validator_version,evidence_hash) values($1,'validated','explicit-test-fixture',$2)",[checkpoint.checkpointId,hex()]);
  const terms={kind:'direct-continue',product:'treeforce89.continue.v1',requiredRaw:'20000000000',network:'sui:mainnet',recipient:suiRecipient,accountId:account,runId:run,orderId:order,payer:wallet,flightHash:hash,coinType:'0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE',decimals:6,quantity:1,restoreLives:3,...patch};
  return {account,run,order,wallet,terms,hash};
 }
 async function insert(f){return owner.query("insert into tree_continue_v1.orders(account_id,run_id,order_id,terms,state) values($1,$2,$3,$4,'ordered')",[f.account,f.run,f.order,f.terms]);}
 const good=await fixture();await insert(good);checks.push('valid reviewed Sui TREE order still inserts');
 for(const [name,patch] of [['BNB network',{network:'eip155:56'}],['one USDT raw amount',{requiredRaw:'1000000000000000000'}],['BNB treasury',{recipient:'0xc440f06bbc7e58b0d055815f915447e4ae0e3720'}],['USDT token',{coinType:'0x55d398326f99059ff775485246999027b3197955',decimals:18}]]){
  const bad=await fixture(patch);await assert.rejects(insert(bad));checks.push('actual upstream SQL rejects '+name);
 }
 // A BNB receipt in the new side ledger cannot magically create a Sui order.
 const missing=await fixture();await assert.rejects(owner.query('select tree_continue_v1.paid_delivery($1,$2,$3,$4,$5,$6,$7)',[missing.account,missing.wallet,origin,'mainnet',missing.run,'prepare',hex()]),/paid_order_not_found/);
 checks.push('delivery requires its own verified order; a side-ledger receipt alone cannot restore');
 // Auth is an external preview KV service, not a SQL session row in this schema.
 const tables=(await owner.query("select tablename from pg_tables where schemaname='tree_continue_v1'")).rows.map(r=>r.tablename);
 assert(!tables.some(t=>t.includes('session')));checks.push('upstream SQL contains account bindings but no lockable authentication session table');
 const identity=fs.readFileSync(base+'upstream/tree-account-core.mjs','utf8'),gateway=fs.readFileSync(base+'upstream/continue-gateway.mjs','utf8');
 assert(identity.includes('game-sessions/${digest(token)}'));assert(identity.includes("environment: 'preview'"));
 assert(gateway.includes("i.environment!=='preview'"));assert(gateway.includes("environment:'release-candidate'"));
 checks.push('inspected gateway explicitly maps preview identity to release-candidate only');
 console.log(JSON.stringify({localOnly:true,upstreamCommit:provenance.commit,passed:checks.length,checks,compatibleWithBnb:false,productionSessionAdapterAvailable:false,gameplayAuthorized:false},null,2));
}finally{await pool?.end();await owner?.end();if(started)execFileSync(exe('pg_ctl'),['-D',data,'-m','immediate','-w','stop'],{env,stdio:'pipe'});fs.rmSync(dir,{recursive:true,force:true});}
