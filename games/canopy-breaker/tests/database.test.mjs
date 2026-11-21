import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabaseProvider,transactionDatabase} from '../server/payments/database.mjs';

test('one lazily created default pool serves repeated warm requests',async()=>{
 let creations=0;const queries=[];
 const pool={query:async(sql,params)=>{queries.push({sql,params});return {rows:[{ok:true}]};}};
 const database=createDatabaseProvider(()=>{creations++;return pool;});
 assert.equal(creations,0);
 const requests=Array.from({length:100},()=>database());
 assert.equal(creations,1);
 await Promise.all(requests.map((request,index)=>request.query('SELECT $1',[index])));
 assert.equal(creations,1);assert.equal(queries.length,100);
 assert.deepEqual(queries[99],{sql:'SELECT $1',params:[99]});
});

test('explicit pools stay isolated and do not initialize the shared default',async()=>{
 let creations=0;
 const database=createDatabaseProvider(()=>{creations++;return {query:async()=>({rows:['default']})};});
 const first={query:async()=>({rows:['first']})},second={query:async()=>({rows:['second']})};
 assert.deepEqual(await database(first).query('SELECT 1'),{rows:['first']});
 assert.deepEqual(await database(second).query('SELECT 1'),{rows:['second']});
 assert.equal(creations,0);
 assert.deepEqual(await database().query('SELECT 1'),{rows:['default']});
 assert.equal(creations,1);
 // The production provider also accepts an explicit pool without environment setup.
 assert.deepEqual(await transactionDatabase(first).query('SELECT 1'),{rows:['first']});
});

test('concurrent transactions lease separate connections and isolate rollback from commit',async()=>{
 const clients=[];let poolQueries=0;
 const pool={query:async()=>{poolQueries++;throw Error('Transaction used pool.query');},connect:async()=>{
  const client={statements:[],releases:0,query:async(sql,params)=>{client.statements.push({sql,params});return {rows:[]};},release(){client.releases++;}};
  clients.push(client);return client;
 }};
 const database=createDatabaseProvider(()=>pool),first=database(),second=database();
 let allowCommit;const gate=new Promise(resolve=>{allowCommit=resolve;});
 const successful=first.transaction(async tx=>{await tx.query('SELECT $1',['saved']);await gate;return 'committed';});
 const failure=Error('Injected action failure');
 const failing=second.transaction(async tx=>{await tx.query('SELECT $1',['discarded']);throw failure;});
 await assert.rejects(failing,error=>error===failure);
 assert.equal(clients.length,2);assert.notEqual(clients[0],clients[1]);
 assert.equal(clients[0].releases,0);assert.equal(clients[1].releases,1);
 allowCommit();assert.equal(await successful,'committed');
 assert.deepEqual(clients[0].statements,[{sql:'BEGIN',params:undefined},{sql:'SELECT $1',params:['saved']},{sql:'COMMIT',params:undefined}]);
 assert.deepEqual(clients[1].statements,[{sql:'BEGIN',params:undefined},{sql:'SELECT $1',params:['discarded']},{sql:'ROLLBACK',params:undefined}]);
 assert.equal(clients[0].releases,1);assert.equal(clients[1].releases,1);assert.equal(poolQueries,0);
});

test('a failed pool initialization can be retried by a later request',async()=>{
 let attempts=0;const database=createDatabaseProvider(()=>{if(++attempts===1)throw Error('Database unavailable');return {query:async()=>({rows:[]})};});
 assert.throws(()=>database(),/Database unavailable/);
 assert.deepEqual(await database().query('SELECT 1'),{rows:[]});
 database();assert.equal(attempts,2);
});
