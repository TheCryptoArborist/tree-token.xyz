import test from 'node:test';
import assert from 'node:assert/strict';
import {platformDatabase} from '../platform-database.mjs';
import {createPlatformRuntime} from '../platform-runtime.mjs';
function pool(fail=false){
 const calls=[];let releases=0;
 return{calls,get releases(){return releases;},async connect(){return{
  async query(sql,args){calls.push({sql,args});if(fail&&sql.startsWith('SELECT'))throw Error('database-down');return{rows:[{result:{ok:true}}]};},
  release(){releases++;},
 };}};
}
test('one standard connection selects the fixed role inside a transaction and releases it',async()=>{
 const p=pool(),db=platformDatabase(p,'delivery'),args=['account'];
 const result=await db.query('SELECT tree_continue_v1.paid_delivery($1) AS result',args);
 assert.equal(result.rows[0].result.ok,true);
 assert.deepEqual(p.calls.map(c=>c.sql),['BEGIN','SET LOCAL ROLE tree_continue_delivery',"SET LOCAL statement_timeout='15s'",'SELECT tree_continue_v1.paid_delivery($1) AS result','COMMIT']);
 assert.deepEqual(p.calls[3].args,args);assert.equal(p.releases,1);
});
test('database failure rolls back before returning pooled connection',async()=>{
 const p=pool(true);await assert.rejects(platformDatabase(p,'recovery').query('SELECT tree_continue_v1.lookup_purchases($1) AS result',['account']),/database-down/);
 assert.equal(p.calls.at(-1).sql,'ROLLBACK');assert.equal(p.releases,1);
});
test('no request can select admin roles or invoke another operation',async()=>{
 const p=pool();assert.throws(()=>platformDatabase(p,'postgres'),/invalid/);
 for(const sql of ['UPDATE tree_continue_v1.orders SET state=\'delivered\'','SELECT tree_continue_v1.commerce_settle($1)','SELECT tree_continue_v1.paid_delivery($1); SELECT 1'])await assert.rejects(platformDatabase(p,'recovery').query(sql),/not-allowed/);
 assert.equal(p.calls.length,0);assert.equal(p.releases,0);
});
test('checkout configuration cannot be supplied without real payment dependencies',()=>{
 assert.throws(()=>createPlatformRuntime({pool:pool(),configuration:{deployment:{}}}),/dependencies-required/);
});
