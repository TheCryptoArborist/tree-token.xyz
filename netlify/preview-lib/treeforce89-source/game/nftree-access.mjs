import { normalizeSuiAddress } from "./tree-payment.mjs";

/**
 * NFTree collection type published on Sui mainnet.
 * Original type identity is stable across package upgrades.
 */
export const NFTREE_TYPE =
  "0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT";

/**
 * Check direct wallet ownership using the Sui v2 Core API (gRPC).
 *
 * Returns a strictly boolean result. Network/client failures are NOT treated
 * as a missing NFT: callers must show a retryable error, not charge an entry
 * fee or silently bypass the gateway.
 *
 * This does not establish server-side wallet identity and does not enumerate
 * NFTrees held by a Kiosk or another custody object. It is a read-only
 * eligibility check for directly owned NFTrees.
 */
export async function checkDirectNFTreeOwnership({ client, wallet, network = "mainnet" }) {
  if (network !== "mainnet") throw new Error("NFTree gateway requires Sui mainnet");
  if (!client?.core?.listOwnedObjects) throw new Error("Sui Core API client required");
  const owner = normalizeSuiAddress(wallet);
  let cursor;
  const seen = new Set();
  for (let page = 0; page < 200; page++) {
    const result = await client.core.listOwnedObjects({
      owner,
      type: NFTREE_TYPE,
      limit: 50,
      ...(cursor ? { cursor } : {}),
    });
    if (!result || !Array.isArray(result.objects)) throw new Error("Invalid NFTree ownership response");
    if (result.objects.some((object) => object && !(object instanceof Error) && object.type === NFTREE_TYPE)) {
      return true;
    }
    if (!result.cursor) return false;
    if (seen.has(result.cursor)) throw new Error("Repeated NFTree pagination cursor");
    seen.add(result.cursor);
    cursor = result.cursor;
  }
  throw new Error("NFTree ownership query exceeded page limit");
}
