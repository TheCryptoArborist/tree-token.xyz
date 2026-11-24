// Server-only PostgreSQL adapter. No HTTP, credentials or gameplay writer.
import {CONTINUE_POLICY} from './sui-bnb-continue.mjs';
const check = (v, code) => { if (!v) throw new Error(code); };
const hex = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const address = (v,n) => typeof v === 'string' && new RegExp(`^0x[a-f0-9]{${n}}$`).test(v);
const PAYMENT_TERMS=Object.freeze({policyVersion:'bnb-usdt-continue-v1',...CONTINUE_POLICY});
const rowValue = row => {
  if(!row)return null;
  check(row.payment_terms && Object.keys(row.payment_terms).length===Object.keys(PAYMENT_TERMS).length && Object.entries(PAYMENT_TERMS).every(([k,v])=>row.payment_terms[k]===v),'unreviewed-payment-policy');
  return {...row.terms,status:row.status,paymentTerms:row.payment_terms};
};

// lockSuiRun MUST SELECT FOR UPDATE the authoritative session and flight on db,
// in that order, and retain locks until this transaction commits. No default.
// It must not call another pool/connection, trust client state or grant access.
export function createPostgresContinueStore({pool, lockSuiRun}) {
  check(typeof pool?.connect === 'function' && typeof lockSuiRun === 'function','authoritative-lock-adapter-required');
  async function transaction(fn) {
    const db=await pool.connect();
    try {
      await db.query('BEGIN');
      await db.query("SET LOCAL statement_timeout='15s'");
      await db.query("SET LOCAL lock_timeout='5s'");
      const value=await fn(db);await db.query('COMMIT');return value;
    } catch(e) { await db.query('ROLLBACK').catch(()=>{});throw e; }
    finally {db.release();}
  }
  async function authorize(db,binding,access) {
    check(hex(binding.sessionHash) && uuid(binding.accountId) && uuid(binding.runId),'invalid-binding');
    const s=await lockSuiRun(db,binding.sessionHash,binding.runId);
    const {rows:[time]}=await db.query('select floor(extract(epoch from clock_timestamp())*1000)::float8 as now');
    const now=time.now;
    check(s?.authenticated===true && s.revoked===false && s.sessionHash===binding.sessionHash &&
      s.accountId===binding.accountId && s.runId===binding.runId && s.suiWallet===binding.suiWallet &&
      s.sequence===binding.sequence && s.deliveryProtocol==='tree-paid-delivery.v1' &&
      Number.isSafeInteger(s.expiresAt) && s.expiresAt>now,'session-or-run-changed');
    if(access) check(s.lives===0 && s.continuesUsed===0 && s.finished===false &&
      s.continueAllowed===true && s.ruleset==='treeforce89.v1','continue-denied');
    return {now,session:s};
  }
  async function load(db,id,lock=false) {
    check(hex(id),'invalid-checkout');
    const {rows}=await db.query('select terms,status,payment_terms from private.arcade_bnb_continue_checkouts where id=$1'+(lock?' for update':''),[id]);
    return rowValue(rows[0]);
  }
  // Read candidate to obtain the binding, then lock session/flight BEFORE checkout.
  async function locked(db,id,sessionHash,access) {
    const original=await load(db,id);check(original && original.sessionHash===sessionHash,'invalid-checkout');
    const auth=await authorize(db,original,access);
    const row=await load(db,id,true);check(row && JSON.stringify({...row,status:null})===JSON.stringify({...original,status:null}),'checkout-changed');
    const {rows:[time]}=await db.query('select floor(extract(epoch from clock_timestamp())*1000)::float8 as now');
    check(auth.session.expiresAt>time.now,'expired-session');
    return {row,...auth,now:time.now};
  }
  return Object.freeze({
    async read(id) {return transaction(db=>load(db,id));},
    async insertChallenge(row) {
      check(row && Object.keys(row).length===11 && Object.keys(row).every(k=>['id','sessionHash','suiWallet','accountId','deliveryProtocol','runId','sequence','payer','issuedAt','expiresAt','status'].includes(k)) && hex(row.id) && row.status==='challenge' && address(row.payer,40) && !/^0x0{40}$/.test(row.payer) &&
        address(row.suiWallet,64) && row.deliveryProtocol==='tree-paid-delivery.v1' &&
        Number.isSafeInteger(row.sequence) && row.sequence>0 && Number.isSafeInteger(row.issuedAt) && Number.isSafeInteger(row.expiresAt), 'invalid-challenge');
      return transaction(async db=>{
        const {now,session}=await authorize(db,row,true);
        check(row.issuedAt<=now && row.issuedAt>=now-5000 && row.expiresAt>now &&
          row.expiresAt<=row.issuedAt+300000 && row.expiresAt<=session.expiresAt,'expired-challenge');
        const count=await db.query("select count(*)::int as n from private.arcade_bnb_continue_checkouts where session_hash=$1 and issued_at>=clock_timestamp()-interval '1 minute'",[row.sessionHash]);
        check(count.rows[0].n<5,'challenge-rate-limited');
        const result=await db.query(`insert into private.arcade_bnb_continue_checkouts(id,session_hash,account_id,run_id,payer,sequence,terms,issued_at,expires_at,payment_terms)
          values($1,$2,$3::uuid,$4::uuid,$5,$6,$7::jsonb,to_timestamp($8::double precision/1000),to_timestamp($9::double precision/1000),$10::jsonb) on conflict(id) do nothing`,
          [row.id,row.sessionHash,row.accountId,row.runId,row.payer,row.sequence,JSON.stringify(row),row.issuedAt,row.expiresAt,JSON.stringify(PAYMENT_TERMS)]);
        return result.rowCount===1;
      });
    },
    async open(input) {
      return transaction(async db=>{
        const {row,now}=await locked(db,input.id,input.sessionHash,true);
        // Signature verification already ran over these immutable stored terms.
        check(['accountId','runId','suiWallet','payer','sequence','issuedAt','expiresAt','deliveryProtocol'].every(k=>input[k]===row[k]),'signed-terms-changed');
        if(row.status!=='challenge'||row.expiresAt<=now)return false;
        // Partial unique indexes serialize different sessions/payers as well.
        const result=await db.query("update private.arcade_bnb_continue_checkouts set status='open' where id=$1 and status='challenge'",[row.id]);
        return result.rowCount===1;
      });
    },
    async recordPayment(input) {
      check(address(input?.txHash,64) && address(input.blockHash,64) && Number.isSafeInteger(input.paidAt) &&
        typeof input.paymentKey==='string' && new RegExp(`^56:${input.txHash}:[0-9]+$`).test(input.paymentKey),'invalid-receipt');
      return transaction(async db=>{
        const {row,now}=await locked(db,input.id,input.sessionHash,false);
        check(['open','paid-review'].includes(row.status) && input.paidAt>=row.issuedAt && input.paidAt<row.expiresAt && input.paidAt<=now,'payment-window-mismatch');
        const prior=await db.query('select * from private.arcade_bnb_continue_receipts where checkout_id=$1',[row.id]);
        if(prior.rows.length) {
          const r=prior.rows[0];return r.tx_hash===input.txHash && r.payment_key===input.paymentKey &&
            r.block_hash===input.blockHash && r.paid_at.getTime()===input.paidAt;
        }
        check(row.status==='open','receipt-missing');
        await db.query(`insert into private.arcade_bnb_continue_receipts(checkout_id,payment_key,tx_hash,block_hash,paid_at)
          values($1,$2,$3,$4,to_timestamp($5::double precision/1000))`,[row.id,input.paymentKey,input.txHash,input.blockHash,input.paidAt]);
        await db.query("update private.arcade_bnb_continue_checkouts set status='paid-review' where id=$1",[row.id]);
        await db.query('insert into private.arcade_bnb_continue_delivery_pending(checkout_id) values($1)',[row.id]);
        return true;
      });
    },
    async deliveryCandidate({id,sessionHash}) {
      return transaction(async db=>{
        const {row}=await locked(db,id,sessionHash,false);
        const result=await db.query(`select r.payment_key,r.tx_hash,r.block_hash from private.arcade_bnb_continue_receipts r
          join private.arcade_bnb_continue_delivery_pending d using(checkout_id) where r.checkout_id=$1 and d.state='pending-review'`,[id]);
        check(row.status==='paid-review' && result.rows.length===1,'payment-not-recorded');
        const r=result.rows[0];
        return {protocol:'tree-paid-delivery.v1',checkoutId:id,accountId:row.accountId,runId:row.runId,
          accessWallet:{family:'sui',address:row.suiWallet},payment:{network:'eip155:56',payer:row.payer,
            token:row.paymentTerms.token,amountRaw:row.paymentTerms.amount,recipient:row.paymentTerms.treasury,
            receiptId:r.payment_key,txHash:r.tx_hash,blockHash:r.block_hash},
          status:'pending-review',requiresPayment:false,authorization:null,restoreAuthorized:false};
      });
    },
  });
}
