import {createHash, randomBytes, timingSafeEqual} from "node:crypto";
import {normalizeSuiAddress} from "./tree-payment.mjs";

const hash = (value) => createHash("sha256").update(value,"utf8").digest("hex");

/**
 * Server-side, single-use wallet authentication challenge.
 *
 * challengeStore must atomically consume a challenge by its hash and return
 * the server-saved record only once. signatureVerifier MUST validate a Sui
 * personal-message signature against the exact message and claimed address
 * using the current @mysten/sui signature verification API.
 *
 * This service intentionally does NOT issue bearer tokens, grant game access,
 * or accept browser-provided proof of signature validity.
 */
export function createWalletChallengeService({challengeStore,signatureVerifier,origin,now=()=>Date.now()}) {
  if(typeof challengeStore?.save!=="function" || typeof challengeStore?.consumeOnce!=="function")
    throw new Error("Durable atomic challenge store required");
  if(typeof signatureVerifier!=="function")throw new Error("Trusted signature verifier required");
  if(typeof origin!=="string" || !/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?$/i.test(origin))
    throw new Error("Fixed HTTPS application origin required");

  return {
    async issue({wallet}) {
      const address=normalizeSuiAddress(wallet);
      const nonce=randomBytes(32).toString("hex");
      const issuedAt=now();
      const expiresAt=issuedAt+5*60_000;
      const message=[
        "TREE FORCE '89 wallet login",
        "Origin: "+origin,
        "Network: sui:mainnet",
        "Wallet: "+address,
        "Nonce: "+nonce,
        "Expires: "+new Date(expiresAt).toISOString(),
        "This signature does not authorize a token transfer.",
      ].join("\n");
      await challengeStore.save({challengeHash:hash(nonce),wallet:address,message,expiresAt});
      return {nonce,message,expiresAt};
    },
    async verify({wallet,nonce,signature}) {
      const address=normalizeSuiAddress(wallet);
      if(typeof nonce!=="string"||!/^[a-f0-9]{64}$/.test(nonce))throw new Error("Invalid challenge nonce");
      if(typeof signature!=="string"||signature.length<8||signature.length>2048)
        throw new Error("Invalid signature");
      const saved=await challengeStore.consumeOnce(hash(nonce));
      if(!saved)throw new Error("Challenge missing or already used");
      if(saved.expiresAt<=now())throw new Error("Challenge expired");
      if(normalizeSuiAddress(saved.wallet)!==address)throw new Error("Challenge wallet mismatch");
      if(typeof saved.message!=="string" || !saved.message.includes("Origin: "+origin+"\n"))
        throw new Error("Challenge origin mismatch");
      const valid=await signatureVerifier({message:saved.message,signature,wallet:address});
      if(valid!==true)throw new Error("Wallet signature invalid");
      return {wallet:address,verified:true};
    },
  };
}
