const normalize=a=>typeof a==='string'&&/^0x[0-9a-f]{1,64}$/i.test(a)?'0x'+a.slice(2).toLowerCase().padStart(64,'0'):null;
export function createSuiNameResolver({fetchFn=fetch,now=Date.now,positiveTTL=300000,negativeTTL=60000}={}){
 const local=new Map(),inflight=new Map();
 return async address=>{
  const wallet=normalize(address);if(!wallet||/^0x0+$/.test(wallet))return null;
  const hit=local.get(wallet);if(hit&&hit.until>now())return hit.name;
  if(inflight.has(wallet))return inflight.get(wallet);
  const task=(async()=>{let name=null;try{
   const response=await fetchFn(process.env.SUI_GRAPHQL_URL||'https://graphql.mainnet.sui.io/graphql',{method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(8000),body:JSON.stringify({query:'query($address:SuiAddress!){address(address:$address){defaultNameRecord{domain target{address} contents{json}}}}',variables:{address:wallet}})});
   const result=await response.json();const record=result.data?.address?.defaultNameRecord;
   if(response.ok&&!result.errors?.length&&record&&normalize(record.target?.address)===wallet&&/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+sui$/i.test(record.domain)&&record.domain.length<=253&&Number(record.contents?.json?.expiration_timestamp_ms)>now())name=record.domain;
  }catch{/* Names are optional; never hold back an alert. */}
  if(local.size>=1000)local.delete(local.keys().next().value);
  local.set(wallet,{name,until:now()+(name?positiveTTL:negativeTTL)});return name;
  })();inflight.set(wallet,task);try{return await task;}finally{inflight.delete(wallet);}
 };
}
export const resolveSuiName=createSuiNameResolver();
export async function namesInNotificationText(text,resolver=resolveSuiName){
 const addresses=[...new Set(text.match(/0x[0-9a-f]{64}\b/gi)||[])];
 const names=await Promise.all(addresses.map(async a=>[a,await resolver(a)]));
 for(const [address,name] of names)if(name)text=text.split(address).join(name);
 return text;
}
