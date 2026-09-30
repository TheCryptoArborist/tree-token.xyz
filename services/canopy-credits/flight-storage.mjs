/** Server-only storage adapter. Identity must come from a verified session and
 * an explicitly reviewed issuer/environment mapping. No keys or connections are
 * loaded here, and saved browser state alone never authorizes payment/delivery.
 */
import { createHash } from 'node:crypto';
const fail = code => { throw Object.assign(new Error(code), { code }); };
const check = (condition, code) => { if (!condition) fail(code); };
const uuid = value => check(typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value), 'invalid-flight-id');
const sha = text => createHash('sha256').update(text,'utf8').digest('hex');
export const MAX_CHECKPOINT_BYTES = 262144;
export function canonicalSnapshot(value, depth = 0) {
  check(depth < 40, 'checkpoint-too-deep');
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    check(value.length <= MAX_CHECKPOINT_BYTES, 'checkpoint-too-large');
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    check(Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value)), 'invalid-checkpoint-number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    check(value.length <= 4096, 'checkpoint-array-too-large');
    return '['+value.map(v=>canonicalSnapshot(v,depth+1)).join(',')+']';
  }
  check(value && typeof value === 'object' && [Object.prototype,null].includes(Object.getPrototypeOf(value)), 'invalid-checkpoint-value');
  const keys = Object.keys(value).sort();
  check(keys.length <= 512, 'checkpoint-object-too-large');
  check(keys.every(k=>!['__proto__','constructor','prototype'].includes(k)), 'invalid-checkpoint-key');
  return '{'+keys.map(k=>JSON.stringify(k)+':'+canonicalSnapshot(value[k],depth+1)).join(',')+'}';
}
export function encodeCheckpoint(runId, snapshot) {
  uuid(runId);
  check(snapshot && !Array.isArray(snapshot) && typeof snapshot === 'object','invalid-checkpoint');
  const fields=['format','ruleset','runId','wave','score','lives','continuesUsed','scene'];
  check(Object.keys(snapshot).length===fields.length && fields.every(k=>Object.hasOwn(snapshot,k)), 'unexpected-checkpoint-field');
  check(snapshot.format==='treeforce89.checkpoint.v1' && snapshot.ruleset==='treeforce89.v1' && snapshot.runId===runId, 'checkpoint-flight-mismatch');
  check(snapshot.lives===0 && snapshot.continuesUsed===0, 'checkpoint-not-exhausted');
  check(Number.isInteger(snapshot.wave) && snapshot.wave>=1 && snapshot.wave<=10, 'invalid-checkpoint-wave');
  check(Number.isSafeInteger(snapshot.score) && snapshot.score>=0 && snapshot.score<=9999999999, 'invalid-checkpoint-score');
  check(snapshot.scene && typeof snapshot.scene==='object' && !Array.isArray(snapshot.scene), 'invalid-checkpoint-scene');
  const text=canonicalSnapshot(snapshot);
  check(Buffer.byteLength(text,'utf8')<=MAX_CHECKPOINT_BYTES,'checkpoint-too-large');
  return {text,hash:sha(text)};
}
export function createFlightStorage(db, {authOrigin,environment}) {
  const origin=new URL(authOrigin);
  check(origin.protocol==='https:' && origin.origin===authOrigin,'invalid-auth-origin');
  check(['release-candidate','mainnet'].includes(environment),'invalid-flight-environment');
  check(typeof db?.query==='function','database-client-required');
  function identity(actor) {
    check(actor?.authenticated===true && actor.identityMappingReviewed===true && actor.wallet?.family==='sui'
      && actor.authOrigin===authOrigin && actor.environment===environment,'verified-flight-identity-required');
    uuid(actor.accountId);
    check(typeof actor.wallet.address==='string' && /^0x[0-9a-f]{64}$/.test(actor.wallet.address)
      && !/^0x0+$/.test(actor.wallet.address),'invalid-flight-payer');
    return [actor.accountId,actor.wallet.address,authOrigin,environment];
  }
  async function one(sql,values) {
    const result=await db.query(sql,values);
    check(result.rows?.length===1 && result.rows[0].result,'invalid-storage-result');
    return result.rows[0].result;
  }
  const storage={
    register(actor,runId) {
      const args=identity(actor);uuid(runId);
      return one('SELECT tree_continue_v1.register_flight($1::uuid,$2,$3,$4,$5::uuid) AS result',[...args,runId]);
    },
    save(actor,runId,requestId,snapshot) {
      const args=identity(actor);uuid(requestId);
      const encoded=encodeCheckpoint(runId,snapshot);
      return one('SELECT tree_continue_v1.store_checkpoint($1::uuid,$2,$3,$4,$5::uuid,$6::uuid,$7,$8) AS result',
        [...args,runId,requestId,encoded.text,encoded.hash]);
    },
    async recover(actor,runId) {
      const args=identity(actor);uuid(runId);
      const result=await one('SELECT tree_continue_v1.read_recovery($1::uuid,$2,$3,$4,$5::uuid) AS result',[...args,runId]);
      check(result.runId===runId,'checkpoint-flight-mismatch');
      if(result.snapshotText!==null) {
        check(typeof result.snapshotText==='string' && Buffer.byteLength(result.snapshotText,'utf8')<=MAX_CHECKPOINT_BYTES,'invalid-stored-checkpoint');
        const encoded=encodeCheckpoint(runId,JSON.parse(result.snapshotText));
        check(encoded.text===result.snapshotText && encoded.hash===result.checkpointHash,'checkpoint-integrity-mismatch');
      }
      // This API exposes recovery INFORMATION, not a replayable gameplay grant.
      return {...result,restoreAuthorized:false,paymentsEnabled:false};
    },
    async resolveValidatedFlight(actor,runId) {
      const recovery=await storage.recover(actor,runId);
      check(recovery.snapshotText && recovery.validation==='validated','server-flight-validation-required');
      const s=JSON.parse(recovery.snapshotText);
      return {accountId:actor.accountId,runId,ruleset:s.ruleset,lives:s.lives,continuesUsed:s.continuesUsed,
        checkpointHash:recovery.checkpointHash,finished:false};
    },
  };
  return Object.freeze(storage);
}
