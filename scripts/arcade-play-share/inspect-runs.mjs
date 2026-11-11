import pg from '/tmp/arcade-inspect/node_modules/pg/lib/index.js';
const response=await fetch('https://api.netlify.com/api/v1/accounts/69800888d1a3d0483003ae9e/env?site_id=aa62f324-b880-47d6-85b8-4ba0700ff5bf',{headers:{Authorization:'Bearer '+process.env.NETLIFY_AUTH_TOKEN}});
if(!response.ok)throw Error('Environment metadata unavailable');
const rows=await response.json(),entry=rows.find(x=>x.key==='TREEFORCE89_DEV_DATABASE_URL'),value=entry?.values.find(x=>x.context==='production')?.value;
if(typeof value!=='string'||!value.startsWith('postgres'))throw Error('Database connection unavailable');
const client=new pg.Client({connectionString:value,connectionTimeoutMillis:15000});
try{
 await client.connect(); await client.query('begin read only');
 const schema=await client.query("select table_schema,table_name,column_name,data_type from information_schema.columns where table_schema not in ('pg_catalog','information_schema') order by table_schema,table_name,ordinal_position");
 console.log(JSON.stringify({databaseSchema:schema.rows}));
 await client.query('rollback');
}catch(e){console.error('Database inspection failed:',e.code||'unavailable');process.exitCode=1;}finally{await client.end().catch(()=>{});}
