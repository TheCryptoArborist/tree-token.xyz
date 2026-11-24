// Server composition only. Not imported by any published handler.
import {createRunAuthorization} from '../../../scripts/multichain/bnb-run-authorization.mjs';
import {assessGenerationBacking} from './generation-access.mjs';
export function createGenerationRunReview({identityRpc,store,provider,sui,approvedGeneration,clock=Date.now}){
 if(typeof identityRpc!=='function')throw Error('Trusted identity RPC required');
 return createRunAuthorization({
  readSession:hash=>identityRpc('arcade_bnb_test_read_session_v1',{p_token_sha256:hash}),
  store,approvedGeneration,clock,
  assess:({wallet,approvedGeneration})=>assessGenerationBacking({wallet,approvedGeneration,provider,sui,clock}),
 });
}
