// This policy is imported only by the canonical namespaced game handler.
// Preview handlers continue to use the disabled-by-default environment policy.
export const canonicalPaidContinuesEnabled=true;
export const databaseTimeouts=Object.freeze({
 connectionTimeoutMillis:5000,query_timeout:8000,statement_timeout:7000,
 lock_timeout:5000,idleTimeoutMillis:1000,keepAlive:true,
 keepAliveInitialDelayMillis:1000,maxLifetimeSeconds:60,
});
export function configureGameDatabasePool(pool){
 if(!pool?.options||typeof pool.on!=='function')throw Error('PostgreSQL pool required');
 Object.assign(pool.options,databaseTimeouts);
 // Never log connection strings or raw provider errors.
 pool.on('error',()=>console.warn(JSON.stringify({event:'treeforce89-db-idle-error'})));
 return pool;
}
