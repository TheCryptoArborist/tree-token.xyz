// Source-only shadow runs. No HTTP route, gameplay grant or leaderboard writer.
import {createHash} from 'node:crypto';
import {BNB_ORIGIN, BNB_IDENTITY_SCOPE} from './bnb-game-access-core.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
const requireValue = (value, code) => { if (!value) throw new Error(code); };
export const RUN_RULES = 'bnb-shadow-v1';
export const RUN_LEASE_MS = 15000;
export const RUN_MAX_MS = 300000;

// rpc is a trusted server dependency; callers never supply it or verifier output.
export function createLifecycleStore(rpc) {
  return Object.freeze(Object.fromEntries(['read', 'start', 'renew', 'close', 'finish'].map(action =>
    [action, data => rpc('arcade_bnb_shadow_run_v1', {p_action: action, p_data: data})])));
}

export function createRunLifecycle({readSession, store, assess, approvedGeneration,
  verifyCompletion = async () => null, clock = Date.now}) {
  requireValue(typeof readSession === 'function' && typeof assess === 'function' &&
    typeof verifyCompletion === 'function' && ['read','start','renew','close','finish'].every(k => typeof store?.[k] === 'function'), 'unavailable');
  requireValue(typeof approvedGeneration === 'string' && /^[1-9][0-9]{0,19}$/.test(approvedGeneration) && BigInt(approvedGeneration) <= 0xffffffffffffffffn, 'unreviewed-generation');
  async function identity(input) {
    requireValue(input.origin === BNB_ORIGIN && /^bnbtest_[a-f0-9]{64}$/.test(input.sessionToken || ''), 'invalid-session');
    const sessionHash = hash(input.sessionToken), s = await readSession(sessionHash), now = clock();
    requireValue(s?.authenticated === true && s.revoked === false && s.origin === BNB_ORIGIN &&
      s.scope === BNB_IDENTITY_SCOPE && s.chainId === 56 && /^0x[a-f0-9]{40}$/.test(s.wallet || '') &&
      !/^0x0{40}$/.test(s.wallet) && Date.parse(s.expiresAt) > now && Date.parse(s.expiresAt) <= now + 3600000, 'invalid-session');
    return {sessionHash, wallet: s.wallet, generation: approvedGeneration, rules: RUN_RULES};
  }
  async function backing(binding) {
    const begin = clock();
    const p = await assess({wallet: binding.wallet, approvedGeneration});
    const now = clock(), at = Date.parse(p?.checkedAt);
    requireValue(now >= begin && now - begin <= 30000 && at >= begin && at <= now && now - at <= 5000, 'stale-backing');
    requireValue(p.backingEligible === true && p.gameplayAuthorized === false && p.wallet === binding.wallet &&
      p.approvedGeneration === approvedGeneration && p.bnb?.generation === approvedGeneration &&
      p.bnb.state === 2 && p.bnb.canPlay === true && p.bnb.owner?.toLowerCase() === binding.wallet &&
      p.sui?.eligible === true && p.sui.generation === approvedGeneration, 'backing-denied');
    return at;
  }
  const output = row => ({runId: row.id, revision: row.revision, leaseUntil: row.leaseUntil,
    expiresAt: row.expiresAt, status: row.status, score: row.score ?? null,
    reviewOnly: true, gameplayAuthorized: false});
  function validRow(row, binding, id) {
    requireValue(row && row.id === id && row.sessionHash === binding.sessionHash && row.wallet === binding.wallet &&
      row.generation === binding.generation && row.rules === RUN_RULES && row.chainId === 56 &&
      Number.isSafeInteger(row.revision) && row.revision >= 0 && row.status === 'active' &&
      Number.isFinite(row.leaseUntil) && row.leaseUntil > clock() && row.leaseUntil <= clock() + RUN_LEASE_MS &&
      Number.isFinite(row.expiresAt) && row.expiresAt > clock() && row.expiresAt <= clock() + RUN_MAX_MS, 'invalid-run');
  }
  async function checked(input, id) {
    const binding = await identity(input), row = await store.read({...binding, id});
    validRow(row, binding, id);
    return {binding, row};
  }
  async function fresh(input, binding, id) {
    let checkedAt;
    try { checkedAt = await backing(binding); }
    catch (error) {
      // Terminal invalidation wins over any positive request still in flight.
      // If storage is unavailable, the old lease expires; no success is returned.
      if (id) await store.close({...binding, id});
      throw error;
    }
    const again = await identity(input);
    requireValue(again.wallet === binding.wallet, 'session-changed');
    return checkedAt;
  }
  return Object.freeze({
    // Recover an uncertain response without repeating a score write. Diagnostic
    // status is not an authorization lease and does not attest current backing.
    async inspect(input) {
      requireValue(/^[a-f0-9]{64}$/.test(input.runId || ''), 'invalid-run');
      const binding = await identity(input), row = await store.read({...binding, id: input.runId});
      requireValue(row && row.id === input.runId && row.sessionHash === binding.sessionHash &&
        row.wallet === binding.wallet && row.generation === binding.generation && row.rules === RUN_RULES &&
        row.chainId === 56 && ['active','closed','finished'].includes(row.status), 'invalid-run');
      return {...output(row), diagnosticOnly: true};
    },
    async start(input) {
      requireValue(/^bnbrun_[a-f0-9]{64}$/.test(input.ticket || ''), 'invalid-ticket');
      const binding = await identity(input), id = hash(input.ticket);
      const checkedAt = await fresh(input, binding, id);
      // Consume ticket AND insert run in one transaction, never call review.consume.
      const row = await store.start({...binding, id, checkedAt});
      validRow(row, binding, id); return output(row);
    },
    async renew(input) {
      requireValue(/^[a-f0-9]{64}$/.test(input.runId || ''), 'invalid-run');
      const {binding, row} = await checked(input, input.runId);
      const checkedAt = await fresh(input, binding, row.id);
      const next = await store.renew({...binding, id: row.id, revision: row.revision, checkedAt});
      validRow(next, binding, row.id); return output(next);
    },
    async finish(input) {
      requireValue(/^[a-f0-9]{64}$/.test(input.runId || ''), 'invalid-run');
      const {binding, row} = await checked(input, input.runId);
      // Trusted verifier must derive the score from authoritative game evidence.
      // The default denies; client summary / client signature is not evidence.
      const proof = await verifyCompletion({run: structuredClone(row), evidence: input.evidence});
      requireValue(proof?.verified === true && proof.runId === row.id && proof.rules === RUN_RULES &&
        /^[a-f0-9]{64}$/.test(proof.evidenceHash || '') && Number.isSafeInteger(proof.score) &&
        proof.score >= 0 && proof.score <= 2147483647, 'unverified-score');
      const checkedAt = await fresh(input, binding, row.id);
      const saved = await store.finish({...binding, id: row.id, revision: row.revision, checkedAt,
        evidenceHash: proof.evidenceHash, score: proof.score});
      requireValue(saved === true, 'finalization-denied');
      return {runId: row.id, score: proof.score, reviewOnly: true, gameplayAuthorized: false};
    }
  });
}
