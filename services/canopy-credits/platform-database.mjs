/** Standard server database credential; role changes last for one transaction.
 * This does not provide separate process credentials. Browser inputs never select
 * a role or SQL statement. Existing private function grants remain unchanged.
 */
const statements = {
 orders: ['commerce_policy_read'],
 storage: ['register_flight','store_checkpoint','read_recovery'],
 delivery: ['paid_delivery'],
 recovery: ['lookup_purchases','reserve_receipt_scan'],
};
export function platformDatabase(pool, mode) {
 if(!Object.hasOwn(statements,mode)||typeof pool?.connect!=='function')throw Error('invalid-platform-database');
 return {async query(sql,values=[]) {
  const name=sql.match(/^SELECT tree_continue_v1\.([a-z_]+)\(/)?.[1];
  if(!statements[mode].includes(name)||sql.includes(';'))throw Error('platform-query-not-allowed');
  const db=await pool.connect();
  try {
   await db.query('BEGIN');
   await db.query('SET LOCAL ROLE tree_continue_'+mode);
   await db.query("SET LOCAL statement_timeout='15s'");
   const result=await db.query(sql,values);
   await db.query('COMMIT');return result;
  }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}
  finally{db.release();}
 }};
}
