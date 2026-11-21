import {getDatabase} from '@netlify/database';
// BEGIN/COMMIT always use one leased connection. Never use pool.query inside a transaction.
function wrapPool(pool){
 return {
  query:(sql,params)=>pool.query(sql,params),
  async transaction(action){
   const client=await pool.connect();
   try{await client.query('BEGIN');const result=await action(client);await client.query('COMMIT');return result;}
   catch(error){await client.query('ROLLBACK');throw error;}
   finally{client.release();}
  }
 };
}

// Keep the pool for warm function requests; transactions still lease their own
// connections. An explicit pool remains independent of the shared default.
export function createDatabaseProvider(poolFactory=()=>getDatabase().pool){
 let sharedPool;
 return function database(pool){
  if(pool===undefined)pool=sharedPool??=(poolFactory());
  return wrapPool(pool);
 };
}

export const transactionDatabase=createDatabaseProvider();
