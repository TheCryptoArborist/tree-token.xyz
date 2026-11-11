import pg from '/tmp/arcade-inspect/node_modules/pg/lib/index.js';
for(const siteID of ['aa62f324-b880-47d6-85b8-4ba0700ff5bf','35f5591a-5c7d-4bc6-ae9a-3e61e816b641','f054a440-1ff7-4fac-85da-3b8b9afcf8b0']){
 const response=await fetch('https://api.netlify.com/api/v1/sites/'+siteID+'/database',{headers:{Authorization:'Bearer '+process.env.NETLIFY_AUTH_TOKEN}});
 if(!response.ok){console.log(JSON.stringify({siteID,status:response.status}));continue;}
 const data=await response.json();const value=data.connection_string||data.connectionString;
 if(typeof value!=='string'||!value.startsWith('postgres')){console.log(JSON.stringify({siteID,keys:Object.keys(data)}));continue;}
 const client=new pg.Client({connectionString:value,connectionTimeoutMillis:15000});
 try{
  await client.connect();await client.query('begin read only');
  const schema=await client.query("select table_schema,table_name,column_name,data_type from information_schema.columns where table_schema not in ('pg_catalog','information_schema') order by table_schema,table_name,ordinal_position");
  console.log(JSON.stringify({siteID,databaseSchema:schema.rows}));
  await client.query('rollback');
 }catch(e){console.error('Database inspection failed:',siteID,e.code||'unavailable');process.exitCode=1;}finally{await client.end().catch(()=>{});}
}
