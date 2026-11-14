import { bcs } from '@mysten/sui/bcs';
export const TREE_TYPE='0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
export const RECIPIENT='0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f';
export const PRICE='20000';
export const DECIMALS=6;
export const AMOUNT=20_000_000_000n;
export const ORIGINS=['https://tree-token.xyz','https://www.tree-token.xyz'];
export const recoveryConfig={coinType:TREE_TYPE,recipient:RECIPIENT,price:PRICE,decimals:DECIMALS,amountBaseUnits:AMOUNT.toString(),scope:'current-month'};
export const memoFor=(intent:{id:string;dateKey:string})=>`TREE:CHECKIN-RECOVERY:v1:${intent.id}:${intent.dateKey}`;
export class MonthlyError extends Error { code:string;status:number;constructor(code:string,message:string,status=400){super(message);this.code=code;this.status=status;} }
const fail=()=>{throw new MonthlyError('payment-not-verified','This payment could not be verified. Keep your transaction digest and retry verification.');};
const norm=(a:unknown)=>typeof a==='string'&&/^0x[0-9a-f]{1,64}$/i.test(a)?'0x'+a.slice(2).toLowerCase().padStart(64,'0'):'';

// SDK 2.26.1's Core API omits checkpoint/timestamp even for settled payments.
// Read them from the same mainnet client's ledger, never from the browser.
// This adapter does not bypass any amount, sender, recipient, memo or time check.
export async function readRecoveryTransaction(client:any,digest:string,signal=AbortSignal.timeout(15000)) {
 const result=await client.core.getTransaction({digest,include:{transaction:true,balanceChanges:true},signal});
 const t=result?.Transaction;
 if(result?.$kind!=='Transaction'||t?.status?.success!==true||t.digest!==digest)fail();
 const {response}=await client.ledgerService.getTransaction({digest,readMask:{paths:['digest','timestamp','checkpoint','effects.status']}},{abort:signal});
 const ledger=response?.transaction;
 if(!ledger||ledger.digest!==digest||ledger.effects?.status?.success!==true)fail();
 if(ledger.timestamp==null||ledger.checkpoint==null)throw new MonthlyError('payment-pending','Payment confirmation is not ready yet. Retry verification without paying again.',409);
 const integerText=(value:unknown)=>typeof value==='bigint'||typeof value==='string'?String(value):typeof value==='number'&&Number.isSafeInteger(value)?String(value):'';
 const seconds=integerText(ledger.timestamp.seconds),checkpoint=integerText(ledger.checkpoint),nanos=ledger.timestamp.nanos;
 if(!/^\d+$/.test(seconds)||!/^\d+$/.test(checkpoint)||BigInt(checkpoint)<=0n||!Number.isInteger(nanos)||nanos<0||nanos>=1000000000)fail();
 const timestampMs=Number(seconds)*1000+Math.floor(nanos/1000000);
 if(!Number.isSafeInteger(timestampMs)||timestampMs<=0||timestampMs>8640000000000000)fail();
 // Reject contradictory metadata rather than overwriting it if a later SDK
 // begins including these fields. Both reads must describe the same payment.
 if(t.timestampMs!=null&&t.timestampMs!==timestampMs)fail();
 if(t.checkpoint!=null&&String(t.checkpoint)!==checkpoint)fail();
 return {...result,Transaction:{...t,timestampMs,checkpoint}};
}

export function verifyRecoveryPayment(result:any,intent:any,digest:string,now=Date.now()) {
 const t=result?.Transaction;
 if(result?.$kind!=='Transaction'||!t?.status?.success||t.digest!==digest||!Number.isFinite(t.timestampMs)||!t.checkpoint||norm(t.transaction?.sender)!==intent.wallet)fail();
 if(t.timestampMs<Date.parse(intent.createdAt)-5000||t.timestampMs>Date.parse(intent.expiresAt)||t.timestampMs>now+5000)fail();
 let received=0n,spent=0n;
 try{for(const x of t.balanceChanges||[]){if(x.coinType===TREE_TYPE){if(norm(x.address)===RECIPIENT)received+=BigInt(x.amount);if(norm(x.address)===intent.wallet)spent+=BigInt(x.amount);}}}catch{fail();}
 if(received!==AMOUNT||spent!==-AMOUNT||intent.wallet===RECIPIENT)fail();
 const inputs=t.transaction?.inputs||[],commands=t.transaction?.commands||[];
 const memo=commands.some((c:any)=>{const m=c.MoveCall;if(!m||norm(m.package)!==norm('0x1')||m.module!=='string'||m.function!=='utf8'||m.typeArguments?.length||m.arguments?.length!==1)return false;const i=m.arguments[0]?.Input;if(!Number.isInteger(i)||i<0)return false;const bytes=inputs[i]?.Pure?.bytes;if(typeof bytes!=='string')return false;try{return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(bcs.vector(bcs.u8()).fromBase64(bytes)))===memoFor(intent);}catch{return false;}});
 if(!memo)fail();
 return new Date(t.timestampMs).toISOString();
}
