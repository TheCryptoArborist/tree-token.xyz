import {createWalletChallengeService} from './wallet-challenge.mjs';
import {createPostgresChallengeStore} from './postgres-wallet-challenges.mjs';
import {createPostgresWalletLoginStore} from './postgres-wallet-logins.mjs';
import {createWalletLoginIssuer,createWalletLoginService} from './wallet-login-issuer.mjs';
import {createSuiPersonalMessageVerifier} from './sui-personal-message-verifier.mjs';
import {createNFTreeSessionService} from './nftree-session-service.mjs';
import {createCredentialRevoker} from './credential-revocation.mjs';

export function createWalletGatewayService({pool,client,origin}) {
  const challengeService = createWalletChallengeService({
    challengeStore:createPostgresChallengeStore(pool),
    signatureVerifier:createSuiPersonalMessageVerifier({client}),origin,
  });
  const loginService = createWalletLoginService({challengeService,
    issuer:createWalletLoginIssuer({store:createPostgresWalletLoginStore(pool)})});
  const sessions = createNFTreeSessionService({postgresPool:pool,suiClient:client});
  const revoker = createCredentialRevoker(pool);
  return {
    issue:input => challengeService.issue(input),
    async enter(input) {
      let login;
      try {login = await loginService.authenticate(input);}
      catch {throw Object.assign(new Error('Sign-in could not be verified. Please sign a new message.'),{code:'SIGN_IN_REJECTED',status:401});}
      // Exchange login for a game session entirely on the server. Never send
      // the intermediate wallet-login credential to the browser.
      let session;
      try {session = await sessions.create({loginToken:login.token});}
      catch(error) {
        if(error.code==='NFTREE_REQUIRED')throw Object.assign(new Error('No directly owned NFTree was found in the signing wallet. Kiosk holdings are not supported in this preview.'),{code:'NFTREE_REQUIRED',status:403});
        throw Object.assign(new Error('NFTree verification is temporarily unavailable. Please retry.'),{code:'VERIFICATION_UNAVAILABLE',status:503});
      }
      finally {await revoker.revoke({loginToken:login.token});}
      return {sessionToken:session.sessionToken,runId:session.runId,expiresAt:session.expiresAt};
    },
    revoke:input => revoker.revoke(input),
  };
}
