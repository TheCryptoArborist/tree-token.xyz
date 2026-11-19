// Server-only transport. Never import this module into browser code.
import { PilotError, pilotDatabaseError } from './pilot-errors.mjs';

const RPCS = new Set(['arcade_challenge_pilot_read_session_v1', 'arcade_challenge_pilot_auth_create_challenge_v1', 'arcade_challenge_pilot_auth_read_challenge_v1', 'arcade_challenge_pilot_auth_create_session_v1', 'arcade_challenge_pilot_auth_revoke_session_v1', 'arcade_challenge_pilot_load_config_v1', 'arcade_challenge_pilot_start_v1', 'arcade_challenge_pilot_load_attempt_v1', 'arcade_challenge_pilot_commit_move_v1']);
const env = key => globalThis.Netlify?.env?.get(key) ?? process.env[key];

export function createPilotRpc({ getEnv = env, fetchImpl = fetch } = {}) {
  let url, secret;
  for (const prefix of ['ARCADE_GROWTH', 'TREE_RAFFLE', 'TREE_KNOWLEDGE_TRIAL']) {
    url = getEnv(prefix + '_SUPABASE_URL'); secret = getEnv(prefix + '_SUPABASE_SECRET_KEY');
    if (url || secret) break;
  }
  if (!url || !secret || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) throw new PilotError('service-unavailable', 'Challenge verification is temporarily unavailable.', 503);
  return async (name, args) => {
    if (!RPCS.has(name)) throw new PilotError('service-unavailable', 'Challenge verification is temporarily unavailable.', 503);
    let response, data;
    try {
      response = await fetchImpl(url.replace(/\/$/, '') + '/rest/v1/rpc/' + name, {
        method: 'POST', headers: { apikey: secret, Authorization: 'Bearer ' + secret, 'Content-Type': 'application/json' },
        body: JSON.stringify(args), signal: AbortSignal.timeout(12000),
      });
      data = await response.json();
    } catch { throw new PilotError('service-unavailable', 'Challenge verification is temporarily unavailable.', 503); }
    if (!response.ok) throw pilotDatabaseError(data?.message);
    return data;
  };
}
