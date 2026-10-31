import {createHash,randomBytes} from "node:crypto";
import {normalizeSuiAddress} from "./tree-payment.mjs";

const sha256=(value)=>createHash("sha256").update(value,"utf8").digest("hex");

/**
 * Server-only login credential issuer.
 * Must only be called with wallet returned by a successfully verified,
 * one-time wallet challenge. This token is NOT a game session or payment
 * authorization. Never store the plaintext credential.
 */
export function createWalletLoginIssuer({store,now=()=>Date.now(),ttlMs=30*60_000}) {
  if(typeof store?.save!=="function")throw new Error("Durable wallet login store required");
  if(!Number.isSafeInteger(ttlMs)||ttlMs<60_000||ttlMs>24*60*60_000)
    throw new Error("Invalid wallet login lifetime");
  return {
    async issueVerifiedWallet({wallet,verified}) {
      if(verified!==true)throw new Error("Verified wallet signature required");
      const address=normalizeSuiAddress(wallet);
      const token=randomBytes(32).toString("hex");
      const expiresAt=now()+ttlMs;
      await store.save({tokenHash:sha256(token),wallet:address,expiresAt});
      return {token,expiresAt};
    },
  };
}

/**
 * The only exposed verification-to-issuance path.
 * Challenge verifier consumes the nonce atomically before issuing.
 * No token is returned if signature verification or persistence fails.
 */
export function createWalletLoginService({challengeService,issuer}) {
  if(typeof challengeService?.verify!=="function"||typeof issuer?.issueVerifiedWallet!=="function")
    throw new Error("Trusted challenge verifier and login issuer required");
  return {
    async authenticate({wallet,nonce,signature}) {
      const proof=await challengeService.verify({wallet,nonce,signature});
      if(proof?.verified!==true||!proof.wallet)throw new Error("Wallet signature not verified");
      return issuer.issueVerifiedWallet({wallet:proof.wallet,verified:true});
    },
  };
}
