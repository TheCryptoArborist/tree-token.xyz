import {validateFixedContinueTerms} from './continue-product.mjs';
const DIGEST=/^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
const check=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
// Current Sui GraphQL EventFilter uses type, not legacy eventType.
// Primary refs: docs.sui.io/.../types/inputs/event-filter and .../queries/events.
export const RECEIPT_DISCOVERY_QUERY=`query TreeReceiptCandidates($payer:SuiAddress!,$type:String!,$before:String,$last:Int!){chainIdentifier events(last:$last,before:$before,filter:{sender:$payer,type:$type}){nodes{transaction{digest}} pageInfo{hasPreviousPage startCursor}}}`;
/** Bounded read-only discovery. verify MUST independently read final chain
 * effects using the pinned checkout codec (directContinueVerifier), never JSON
 * supplied by this query. No match is PENDING, never proof of nonpayment.
 */
export function createReceiptDiscovery({endpoint,verify,fetcher=fetch,maxPages=3,pageSize=16}){
 const url=new URL(endpoint);check(url.protocol==='https:'&&!url.username&&!url.password&&!url.hash&&typeof verify==='function'&&Number.isInteger(maxPages)&&maxPages>=1&&maxPages<=4&&Number.isInteger(pageSize)&&pageSize>=1&&pageSize<=20,'invalid-receipt-discovery-config');
 const unrelated=new Set(['continue-receipt-not-unique','receipt-fields-mismatch','wrong-continue-deployment','payment-outside-quote-window','payer-mismatch','receipt-package-mismatch','payment-effects-mismatch','unfinalized-or-unsuccessful']);
 return async terms=>{
  validateFixedContinueTerms(terms);let cursor=null;const cursors=new Set(),seen=new Set(),matches=new Set();const signal=AbortSignal.timeout(12000);
  for(let page=0;page<maxPages;page++){
   signal.throwIfAborted();
   const response=await fetcher(url.href,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:RECEIPT_DISCOVERY_QUERY,variables:{payer:terms.payer,type:terms.eventType,before:cursor,last:pageSize}}),signal});
   check(response.ok,'receipt-index-unavailable');
   const reader=response.body?.getReader();check(reader,'invalid-receipt-index-response');let bytes=0;const chunks=[];
   while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>131072){await reader.cancel();throw Error('receipt-index-response-too-large');}chunks.push(value);}
   const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   check(!data.errors?.length&&data.data?.chainIdentifier===terms.chainIdentifier,'receipt-index-chain-or-query-error');
   const connection=data.data.events;check(Array.isArray(connection?.nodes)&&connection.nodes.length<=pageSize&&typeof connection.pageInfo?.hasPreviousPage==='boolean','invalid-receipt-index-response');
   for(const node of connection.nodes){
    const digest=node?.transaction?.digest;check(typeof digest==='string'&&DIGEST.test(digest),'invalid-receipt-index-digest');
    if(seen.has(digest))continue;seen.add(digest);signal.throwIfAborted();
    try{const evidence=await verify(terms,digest);check(evidence?.digest===digest&&evidence.orderId===terms.orderId&&evidence.finalized===true&&evidence.status==='success','invalid-discovery-evidence');matches.add(digest);}
    catch(e){if(!unrelated.has(e.code||e.message))throw e;}
    check(matches.size<=1,'multiple-order-payments-review-required');
   }
   if(!connection.pageInfo.hasPreviousPage)return matches.size?{status:'found',digest:[...matches][0]}:{status:'pending'};
   // A verified exact order receipt is enough to reconcile; deduplication and
   // the checkout's unique order ID remain authoritative, not scan coverage.
   if(matches.size)return{status:'found',digest:[...matches][0]};
   cursor=connection.pageInfo.startCursor;
   check(typeof cursor==='string'&&cursor.length>0&&cursor.length<=2048&&!cursors.has(cursor),'invalid-receipt-index-cursor');cursors.add(cursor);
  }
  return{status:'bounded'};
 };
}
