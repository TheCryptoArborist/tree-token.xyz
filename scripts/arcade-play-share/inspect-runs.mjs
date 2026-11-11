import {listStores,getStore} from '/tmp/arcade-inspect/node_modules/@netlify/blobs/dist/main.js';
const options={siteID:'aa62f324-b880-47d6-85b8-4ba0700ff5bf',token:process.env.NETLIFY_AUTH_TOKEN};
const {stores}=await listStores(options);
console.log(JSON.stringify({stores:stores.filter(x=>/force|breaker|arcade/.test(x))}));
function shape(value,depth=0){
 if(value===null)return 'null';
 if(Array.isArray(value))return {array:value.slice(0,2).map(x=>shape(x,depth+1)),length:value.length};
 if(typeof value!=='object')return typeof value;
 if(depth>4)return 'object';
 return Object.fromEntries(Object.entries(value).slice(0,35).map(([k,v])=>[/^(0x)?[a-f0-9]{24,}$/i.test(k)?'<id>':k,shape(v,depth+1)]));
}
for(const name of stores.filter(x=>/force|breaker/.test(x))){
 const store=getStore({...options,name,consistency:'strong'});
 let rows=[];
 for await(const page of store.list({paginate:true})){rows=page.blobs;break;}
 console.log(JSON.stringify({store:name,sampleCount:rows.length,keyPatterns:[...new Set(rows.map(x=>x.key.split('/').map((p,i)=>i===0&&/^[a-z-]{1,30}$/.test(p)?p:'<key>').join('/')))]}));
 const groups=new Map();
 for(const row of rows){const prefix=row.key.split('/')[0];if(!groups.has(prefix))groups.set(prefix,row);if(groups.size>=12)break;}
 for(const row of groups.values()){
  const value=await store.get(row.key,{type:'json'});
  console.log(JSON.stringify({store:name,keyPattern:row.key.split('/').map((p,i)=>i===0&&/^[a-z-]{1,30}$/.test(p)?p:'<key>').join('/'),shape:shape(value)}));
 }
}
