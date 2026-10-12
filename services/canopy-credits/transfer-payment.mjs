import {validateFixedContinueTerms,commitment,transferReference} from './continue-product.mjs';
import {digest32,decimal} from './mainnet-reader.mjs';
const check=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
/** Only server-read checkpoint inclusion and actual balance changes can settle.
 * The signed reference ties the transfer to this immutable account/flight order.
 * No quote signature, custom Move package, or browser receipt is trusted.
 */
export function transferPaymentVerifier(reader) {
 return async(input,digest)=>{
  const t=validateFixedContinueTerms(structuredClone(input));
  check(t.paymentMethod==='tree-transfer-v1','wrong-payment-method');digest32(digest);
  const network=await reader.getNetworkIdentity();
  check(network.network===t.network&&network.chainIdentifier===t.chainIdentifier,'wrong-payment-network');
  const tx=await reader.getFinalizedTransaction(digest);
  check(tx.digest===digest&&tx.finalized===true&&tx.simulated===false&&tx.status==='success','unfinalized-or-unsuccessful');
  decimal(tx.checkpoint);check(tx.sender===t.payer,'payer-mismatch');
  // A standard transfer cannot abort on an application deadline. A late wallet
  // approval must still receive its paid continue; the exact reference binds it.
  check(Number.isSafeInteger(tx.timestampMs)&&tx.timestampMs>=t.issuedAtMs,'payment-outside-quote-window');
  check(tx.paymentReferences?.length===1&&tx.paymentReferences[0]===transferReference(t),'transfer-reference-mismatch');
  check(Array.isArray(tx.balanceChanges),'payment-effects-mismatch');
  const totals=new Map();
  for(const b of tx.balanceChanges.filter(b=>b.coinType===t.coinType)){
   check(typeof b.amount==='string'&&/^(0|-?[1-9][0-9]*)$/.test(b.amount),'payment-effects-mismatch');
   totals.set(b.owner,(totals.get(b.owner)||0n)+BigInt(b.amount));
  }
  check(totals.get(t.payer)===-BigInt(t.requiredRaw)&&totals.get(t.recipient)===BigInt(t.requiredRaw)&&
   [...totals].every(([owner,amount])=>owner===t.payer||owner===t.recipient||amount===0n),'payment-effects-mismatch');
  const evidence={source:'chain-reader',network:t.network,paymentMethod:t.paymentMethod,finalized:true,status:'success',
   digest,eventIndex:'0',checkpoint:tx.checkpoint,timestampMs:tx.timestampMs,orderId:t.orderId,accountId:t.accountId,
   payer:t.payer,recipient:t.recipient,coinType:t.coinType,amountRaw:t.requiredRaw,quoteHash:t.quoteHash,
   paymentReference:transferReference(t)};
  return {...evidence,evidenceHash:commitment(evidence)};
 };
}
