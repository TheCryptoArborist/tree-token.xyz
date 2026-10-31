import {createGameSessionIssuer} from "./game-session-issuer.mjs";
import {createPostgresWalletLoginStore} from "./postgres-wallet-logins.mjs";
import {checkDirectNFTreeOwnership} from "./nftree-access.mjs";

/**
 * Server-side composition for a signed-in NFTree holder's game session.
 * Dependencies must be created in a trusted backend; never import this into
 * a browser bundle or expose the database connection to the frontend.
 *
 * No public HTTP endpoint is enabled by this module.
 */
export function createNFTreeSessionService({postgresPool,suiClient,now,ttlMs}) {
  if (suiClient?.network !== "mainnet" || typeof suiClient?.core?.listOwnedObjects !== "function") {
    throw new Error("Trusted Sui mainnet Core API client required");
  }
  const loginStore = createPostgresWalletLoginStore(postgresPool);
  const ownershipChecker = ({wallet}) =>
    checkDirectNFTreeOwnership({client:suiClient,wallet,network:"mainnet"});
  return createGameSessionIssuer({
    loginStore,
    ownershipChecker,
    pool:postgresPool,
    ...(now ? {now} : {}),
    ...(ttlMs ? {ttlMs} : {}),
  });
}
