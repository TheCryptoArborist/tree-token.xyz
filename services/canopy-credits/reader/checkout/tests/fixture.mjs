/** All keys, object references and prices here are PUBLIC DISPOSABLE TEST FIXTURES. */
import { readFileSync } from 'node:fs';
import { createPrivateKey, sign } from 'node:crypto';
import { Quote, Purchase, quoteFields, idBytes } from '../codec.mjs';
import { authorizeQuoteForReview } from '../quote-authority.mjs';
export const golden = JSON.parse(readFileSync(new URL('./golden.json', import.meta.url), 'utf8'));
export const addr = n => '0x'+String(n).repeat(64);
export const key = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.alloc(32,7)]),format:'der',type:'pkcs8' });
export const now = golden.terms.issuedAtMs+1000;
export function fixture() {
  const terms = structuredClone(golden.terms);
  const deployment = { network:'sui:mainnet',packageId:terms.checkoutPackage,checkoutId:golden.checkoutId,initialSharedVersion:'1',keyEpoch:'1',quotePublicKey:golden.publicKey };
  const envelope = authorizeQuoteForReview(terms,deployment,key);
  const fields = quoteFields(terms,deployment);
  const {domain,...q}=fields;
  const purchase = {schema_version:1,...q,paid_at_ms:String(now)};
  const event = {type:terms.eventType,packageId:terms.checkoutPackage,bcsBase64:Buffer.from(Purchase.serialize(purchase).toBytes()).toString('base64'),json:{amountRaw:'DO-NOT-TRUST-JSON'}};
  const ref=(id,coinType,balance)=>({objectId:addr(id),version:'1',digest:'A'.repeat(43),owner:terms.payer,coinType,balance});
  const args = {terms,deployment,envelope,paymentCoins:[ref(4,terms.coinType,'1100000')],gasCoins:[ref(5,'0x'+'0'.repeat(63)+'2::sui::SUI','20000000')],gasBudget:'10000000',maxGasBudget:'10000000',gasPrice:'1000',epoch:'10'};
  return {terms,deployment,envelope,fields,purchase,event,args};
}
export function vectors() {
  const f=fixture(), base=f.fields;
  const changes={base:{},second:{order_id:[...idBytes('cccccccc-cccc-4ccc-8ccc-cccccccccccc')]},third_epoch_two:{order_id:[...idBytes('dddddddd-dddd-4ddd-8ddd-dddddddddddd')],key_epoch:'2'},wrong_instance:{checkout_id:addr(9)},wrong_epoch:{key_epoch:'2'},wrong_payer:{payer:addr(9)},wrong_recipient:{recipient:addr(9)},wrong_coin:{coin_type:'0x2::sui::SUI'},invalid_window:{expires_at_ms:String(golden.terms.issuedAtMs+45001)},expired:{issued_at_ms:String(golden.terms.issuedAtMs-45001),expires_at_ms:String(golden.terms.issuedAtMs-1)},future:{issued_at_ms:String(now+1),expires_at_ms:String(now+45001)},bad_domain:{domain:[1,2,3]},short_order:{order_id:[1]},zero:{amount_raw:'0'}};
  return Object.fromEntries(Object.entries(changes).map(([name,change])=>{const b=Quote.serialize({...base,...change}).toBytes();return [name,{bytes:Buffer.from(b).toString('hex'),signature:sign(null,b,key).toString('hex')}]}));
}
