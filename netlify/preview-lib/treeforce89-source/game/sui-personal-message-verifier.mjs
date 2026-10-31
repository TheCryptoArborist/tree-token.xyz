import {isValidPersonalMessageSignature} from "@mysten/sui/verify";
import {normalizeSuiAddress} from "./tree-payment.mjs";

/**
 * Verify a Sui wallet personal-message signature against the exact
 * server-issued challenge and the expected Sui address.
 *
 * No transaction signing or payment is performed.
 * A trusted Sui Core API client is optional for key types requiring
 * on-chain resolution (e.g. zkLogin); such lookup failures fail closed.
 */
export function createSuiPersonalMessageVerifier({client,verify=isValidPersonalMessageSignature}={}) {
  if(typeof verify!=="function")throw new Error("Sui personal-message verifier required");
  return async function signatureVerifier({message,signature,wallet}) {
    if(typeof message!=="string"||message.length<1||message.length>4096)
      throw new Error("Invalid wallet challenge message");
    if(typeof signature!=="string"||signature.length<8||signature.length>2048)
      throw new Error("Invalid wallet signature");
    const address=normalizeSuiAddress(wallet);
    return (await verify(new TextEncoder().encode(message),signature,{address,...(client?{client}:{})}))===true;
  };
}
