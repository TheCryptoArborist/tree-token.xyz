import {getDatabase} from '@netlify/database';
// BEGIN/COMMIT always use one leased connection. Never use pool.query inside a transaction.
export function transactionDatabase(pool=getDatabase().pool){
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
