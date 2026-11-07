import type { HolderSnapshotNFTree, HolderSnapshotUnresolvedOwner } from "./holderSnapshot";

/** Read-only public data. No wallet, signing key, or legacy TreeDrop API is used. */
export const DEFAULT_SNAPSHOT_GRAPHQL_URL = "https://graphql.mainnet.sui.io/graphql";
export const SUI_MAINNET_CHAIN_IDENTIFIER = "4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S";
const KIOSK_TYPE = "0x2::kiosk::Kiosk";
const KIOSK_CAP_TYPE = "0x2::kiosk::KioskOwnerCap";
// Published mainnet personal-kiosk package, also used by Mysten's Kiosk SDK.
const PERSONAL_KIOSK_CAP_TYPE =
  "0x0cb4bcc0560340eb1a1b929cabe56b33fc6449820ec8c1980d69bb98b649b802::personal_kiosk::PersonalKioskCap";
const TRADEPORT_PACKAGE = "0xff2251ea99230ed1cbe3a347a209352711c6723fcdcd9286e16636e65bb55cab";
const TRADEPORT_STORE_ID = "0xf96f9363ac5a64c058bf7140723226804d74c0dab2dd27516fb441a180cd763b";
const ID_OBJECT_FIELD_TYPE = "0x2::dynamic_field::Field<0x2::dynamic_object_field::Wrapper<0x2::object::ID>,0x2::object::ID>";
const MAX_PAGES = 250;
const MAX_OWNER_DEPTH = 8;
const REQUEST_TIMEOUT_MS = 30_000;

type JsonRecord = Record<string, unknown>;
type GraphQLObject = {
  address?: string;
  version?: number | string;
  digest?: string;
  owner?: {
    __typename?: string;
    address?: { address?: string };
    initialSharedVersion?: number | string;
  };
  asMoveObject?: { contents?: { type?: { repr?: string }; json?: unknown } };
  previousTransaction?: {
    effects?: {
      checkpoint?: { sequenceNumber?: number };
      objectChanges?: { nodes?: { address?: string; idCreated?: boolean; outputState?: GraphQLObject | null }[]; pageInfo?: { hasNextPage?: boolean; endCursor?: string | null } };
    };
  };
};
type ObjectConnection = {
  nodes?: GraphQLObject[];
  pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
};
type PinnedObjectsResponse = {
  checkpoint?: {
    sequenceNumber?: number;
    query?: { objects?: ObjectConnection; object?: GraphQLObject | null };
  } | null;
};
type OwnerResolution =
  | { ownerAddress: string; resolutionPath: string[] }
  | { reason: string; resolutionPath: string[] };

export type AutomaticSnapshotRead = {
  nftreeType: string;
  snapshotTime: string;
  checkpoint: string;
  checkpointDigest: string;
  chainIdentifier: string;
  graphqlUrl: string;
  complete: true;
  pagesRead: number;
  nftrees: HolderSnapshotNFTree[];
  unresolved: HolderSnapshotUnresolvedOwner[];
};

function record(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function address(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^0x[0-9a-f]{1,64}$/i.test(value)) return undefined;
  return `0x${value.slice(2).padStart(64, "0").toLowerCase()}`;
}

function canonicalType(type: string | undefined) {
  return type?.replace(/0x([0-9a-f]+)(?=::)/gi, (_match, hex: string) => `0x${hex.replace(/^0+/, "") || "0"}`).toLowerCase();
}

const OWNER_FIELDS = `
  owner {
    __typename
    ... on AddressOwner { address { address } }
    ... on ObjectOwner { address { address } }
    ... on Shared { initialSharedVersion }
  }
`;
const OBJECT_FIELDS = `address version digest ${OWNER_FIELDS} asMoveObject { contents { type { repr } json } }`;
// Collection pages do not download 5,000 image URLs/descriptions.
const INVENTORY_FIELDS = `address version digest ${OWNER_FIELDS} asMoveObject { contents { type { repr } } }`;

async function graphQL<T>(
  graphqlUrl: string,
  query: string,
  variables: JsonRecord,
  signal?: AbortSignal,
): Promise<T> {
  signal?.throwIfAborted();
  const controller = new AbortController();
  const cancel = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error("Holder snapshot request timed out. Refresh and try again.")), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(graphqlUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit",
    });
    if (!response.ok) throw new Error(`Holder snapshot data service returned HTTP ${response.status}. No payout was prepared.`);
    const payload = await response.json() as { data?: T | null; errors?: { message?: string }[] };
    // GraphQL may return HTTP 200 with partial data: never accept that for payments.
    if (payload.errors?.length) throw new Error(payload.errors.map((item) => item.message || "GraphQL query failed").join("; "));
    if (!payload.data) throw new Error("Holder snapshot data service returned no data.");
    return payload.data;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}

function readConnection(value: ObjectConnection | undefined) {
  if (!value || !Array.isArray(value.nodes) || typeof value.pageInfo?.hasNextPage !== "boolean") {
    throw new Error("Incomplete holder snapshot response: collection pagination could not be verified.");
  }
  const { hasNextPage, endCursor } = value.pageInfo;
  if (hasNextPage && (!endCursor || !value.nodes.length)) {
    throw new Error("Incomplete holder snapshot: next page has no valid cursor or objects.");
  }
  return { nodes: value.nodes, hasNextPage, endCursor: endCursor || null };
}

/**
 * Enumerate the exact live collection at one indexed checkpoint. Subsequent NFT,
 * custody, and capability reads are nested in Checkpoint.query at that same point.
 * Unknown shared custody stays unresolved; Kiosk.owner is only a search hint and
 * never accepted without the wallet's matching framework capability.
 */
export async function readAutomaticHolderSnapshot({
  nftreeType,
  graphqlUrl = DEFAULT_SNAPSHOT_GRAPHQL_URL,
  projectWallets = [],
  signal,
}: {
  nftreeType: string;
  graphqlUrl?: string;
  projectWallets?: string[];
  signal?: AbortSignal;
}): Promise<AutomaticSnapshotRead> {
  if (!graphqlUrl.startsWith("https://")) throw new Error("The holder snapshot data service must use HTTPS.");
  const scope = await graphQL<{
    chainIdentifier?: string;
    serviceConfig?: {
      maxPageSize?: number;
      availableRange?: { first?: { sequenceNumber?: number }; last?: { sequenceNumber?: number; timestamp?: string; digest?: string } };
    };
  }>(graphqlUrl, `query NFTreeSnapshotScope {
    chainIdentifier
    serviceConfig {
      maxPageSize(type: "Query", field: "objects")
      availableRange(type: "Query", field: "objects", filters: ["type"]) {
        first { sequenceNumber }
        last { sequenceNumber timestamp digest }
      }
    }
  }`, {}, signal);
  if (scope.chainIdentifier !== SUI_MAINNET_CHAIN_IDENTIFIER) throw new Error("Holder snapshot source is not the Sui mainnet network.");
  const indexed = scope.serviceConfig?.availableRange?.last;
  const checkpoint = indexed?.sequenceNumber;
  const firstCheckpoint = scope.serviceConfig?.availableRange?.first?.sequenceNumber;
  if (!Number.isSafeInteger(checkpoint) || checkpoint! < 0 || !Number.isSafeInteger(firstCheckpoint) || firstCheckpoint! > checkpoint! ||
    !indexed?.digest || !indexed.timestamp || !Number.isFinite(Date.parse(indexed.timestamp))) {
    throw new Error("Holder snapshot checkpoint and index completeness could not be verified.");
  }
  const maxPageSize = scope.serviceConfig?.maxPageSize;
  if (!Number.isSafeInteger(maxPageSize) || maxPageSize! < 1) throw new Error("Holder snapshot service did not report a valid page limit.");
  const pageSize = Math.min(50, maxPageSize!);
  const projectWalletSet = new Set(projectWallets.map(address).filter(Boolean));
  let pagesRead = 0;

  async function queryObjects(type: string, owner?: string): Promise<GraphQLObject[]> {
    const output: GraphQLObject[] = [];
    const cursors = new Set<string>();
    const ids = new Set<string>();
    let after: string | null = null;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const response: PinnedObjectsResponse = await graphQL<PinnedObjectsResponse>(graphqlUrl, `
        query NFTreePinnedObjects($cp: UInt53!, $filter: ObjectFilter!, $first: Int!, $after: String) {
          checkpoint(sequenceNumber: $cp) {
            sequenceNumber
            query {
              objects(filter: $filter, first: $first, after: $after) {
                pageInfo { hasNextPage endCursor }
                nodes { ${owner ? OBJECT_FIELDS : INVENTORY_FIELDS} }
              }
            }
          }
        }`, { cp: checkpoint!, filter: { type, ...(owner ? { owner } : {}) }, first: pageSize, after }, signal);
      if (!response.checkpoint || response.checkpoint.sequenceNumber !== checkpoint) throw new Error("Holder snapshot checkpoint changed or is no longer available. Refresh before paying.");
      const connection = readConnection(response.checkpoint.query?.objects);
      pagesRead += 1;
      for (const node of connection.nodes) {
        const id = address(node.address);
        if (!id || !node.version || !node.digest || canonicalType(node.asMoveObject?.contents?.type?.repr) !== canonicalType(type)) {
          throw new Error("Holder snapshot returned an invalid or unexpected collection object. Payout preparation stopped.");
        }
        if (ids.has(id)) throw new Error(`Holder snapshot repeated object ${id}. Pagination completeness could not be verified.`);
        ids.add(id);
        output.push({ ...node, address: id });
      }
      if (!connection.hasNextPage) return output;
      if (cursors.has(connection.endCursor!)) throw new Error("Holder snapshot pagination repeated a cursor. Refresh before paying.");
      cursors.add(connection.endCursor!);
      after = connection.endCursor;
    }
    throw new Error(`Holder snapshot exceeded ${MAX_PAGES} pages. A complete inventory is required before payment.`);
  }

  const objects = await queryObjects(nftreeType);
  if (!objects.length) throw new Error("The verified NFTree collection returned no live objects. Payout preparation stopped.");
  const objectCache = new Map<string, Promise<GraphQLObject | null>>();
  const capabilityCache = new Map<string, Promise<GraphQLObject[]>>();
  const kioskHistoryCache = new Map<string, Promise<GraphQLObject[]>>();

  function fetchObject(id: string): Promise<GraphQLObject | null> {
    if (!objectCache.has(id)) objectCache.set(id, (async () => {
      const response = await graphQL<PinnedObjectsResponse>(graphqlUrl, `
        query NFTreePinnedOwner($cp: UInt53!, $id: SuiAddress!) {
          checkpoint(sequenceNumber: $cp) { sequenceNumber query { object(address: $id) { ${OBJECT_FIELDS} } } }
        }`, { cp: checkpoint!, id }, signal);
      if (!response.checkpoint || response.checkpoint.sequenceNumber !== checkpoint || !response.checkpoint.query || !Object.hasOwn(response.checkpoint.query, "object")) {
        throw new Error("Holder owner lookup was incomplete at the selected checkpoint.");
      }
      return response.checkpoint.query.object || null;
    })());
    return objectCache.get(id)!;
  }

  function walletCaps(wallet: string): Promise<GraphQLObject[]> {
    if (!capabilityCache.has(wallet)) capabilityCache.set(wallet, (async () => [
      ...await queryObjects(KIOSK_CAP_TYPE, wallet),
      ...await queryObjects(PERSONAL_KIOSK_CAP_TYPE, wallet),
    ])());
    return capabilityCache.get(wallet)!;
  }

  function capKioskId(cap: GraphQLObject): string | undefined {
    const json = record(cap.asMoveObject?.contents?.json);
    if (canonicalType(cap.asMoveObject?.contents?.type?.repr) === canonicalType(KIOSK_CAP_TYPE)) return address(json?.for);
    // Sui's JSON representation of Option<T> can be null/value or {vec:[T]}.
    const wrapped = json?.cap;
    const option = record(wrapped);
    const inner = Array.isArray(wrapped) ? wrapped[0] : Array.isArray(option?.vec) ? option.vec[0] : wrapped;
    return address(record(inner)?.for);
  }

  function kioskCreationCaps(kioskNode: GraphQLObject): Promise<GraphQLObject[]> {
    const kioskId = address(kioskNode.address)!;
    if (!kioskHistoryCache.has(kioskId)) kioskHistoryCache.set(kioskId, (async () => {
      const initialVersion = Number(kioskNode.owner?.initialSharedVersion);
      if (!Number.isSafeInteger(initialVersion) || initialVersion < 1) return [];
      const capIds = new Set<string>();
      const cursors = new Set<string>();
      let after: string | null = null;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const result: PinnedObjectsResponse = await graphQL<PinnedObjectsResponse>(graphqlUrl, `
          query NFTreeKioskCreationCaps($cp: UInt53!, $id: SuiAddress!, $version: UInt53!, $first: Int!, $after: String) {
            checkpoint(sequenceNumber: $cp) { sequenceNumber query {
              object(address: $id, version: $version) {
                previousTransaction { effects {
                  checkpoint { sequenceNumber }
                  objectChanges(first: $first, after: $after) {
                    pageInfo { hasNextPage endCursor }
                    nodes { address idCreated outputState { ${OBJECT_FIELDS} } }
                  }
                } }
              }
            } }
          }`, { cp: checkpoint!, id: kioskId, version: initialVersion, first: pageSize, after }, signal);
        if (!result.checkpoint || result.checkpoint.sequenceNumber !== checkpoint) throw new Error("Kiosk creation proof checkpoint is unavailable.");
        const effects = result.checkpoint.query?.object?.previousTransaction?.effects;
        const changes = effects?.objectChanges;
        if (!Number.isSafeInteger(effects?.checkpoint?.sequenceNumber) || effects!.checkpoint!.sequenceNumber! > checkpoint! || !Array.isArray(changes?.nodes) || typeof changes.pageInfo?.hasNextPage !== "boolean") {
          throw new Error("Kiosk creation capability history is unavailable or incomplete.");
        }
        for (const change of changes.nodes) {
          const cap = change.outputState;
          const type = canonicalType(cap?.asMoveObject?.contents?.type?.repr);
          if (change.idCreated && cap && [canonicalType(KIOSK_CAP_TYPE), canonicalType(PERSONAL_KIOSK_CAP_TYPE)].includes(type) && capKioskId(cap) === kioskId) {
            const capId = address(change.address);
            if (capId) capIds.add(capId);
          }
        }
        if (!changes.pageInfo.hasNextPage) {
          const currentCaps = await Promise.all([...capIds].map(fetchObject));
          return currentCaps.filter((cap): cap is GraphQLObject => Boolean(cap));
        }
        const next = changes.pageInfo.endCursor;
        if (!next || cursors.has(next) || !changes.nodes.length) throw new Error("Kiosk creation history pagination is incomplete.");
        cursors.add(next);
        after = next;
      }
      throw new Error("Kiosk creation history exceeded the safe page limit.");
    })());
    return kioskHistoryCache.get(kioskId)!;
  }

  async function resolveOwner(id: string, seen: Set<string>, path: string[], allowWallet: boolean, nftreeId: string): Promise<OwnerResolution> {
    if (seen.has(id) || seen.size >= MAX_OWNER_DEPTH) return { reason: "Custody owner chain contains a cycle or exceeds the supported depth.", resolutionPath: path };
    const nextSeen = new Set([...seen, id]);
    const node = await fetchObject(id);
    // An address with no onchain object is a wallet recipient, not an object ID.
    if (!node) return allowWallet
      ? { ownerAddress: id, resolutionPath: [...path, `Wallet ${id}`] }
      : { reason: `Custody object ${id} is unavailable at the selected checkpoint. No recipient was assumed.`, resolutionPath: path };
    const type = canonicalType(node.asMoveObject?.contents?.type?.repr);
    // Recognize only this deployed TradePort listing format and only known
    // project sellers. Verify actual NFT and shared-store ancestry, so unsold
    // treasury listings are excluded without assuming arbitrary escrow owners.
    if (type === canonicalType(`${TRADEPORT_PACKAGE}::tradeport_listings::SimpleListing<${nftreeType}>`)) {
      const listing = record(node.asMoveObject?.contents?.json);
      const seller = address(listing?.seller);
      const wrapperId = node.owner?.__typename === "ObjectOwner" ? address(node.owner.address?.address) : undefined;
      const wrapper = wrapperId ? await fetchObject(wrapperId) : null;
      const wrapperJson = record(wrapper?.asMoveObject?.contents?.json);
      const storeId = wrapper?.owner?.__typename === "ObjectOwner" ? address(wrapper.owner.address?.address) : undefined;
      const store = storeId === TRADEPORT_STORE_ID ? await fetchObject(storeId) : null;
      if (address(listing?.nft_id) === nftreeId && seller && projectWalletSet.has(seller) &&
        canonicalType(wrapper?.asMoveObject?.contents?.type?.repr) === canonicalType(ID_OBJECT_FIELD_TYPE) &&
        address(wrapperJson?.value) === id && address(record(wrapperJson?.name)?.name) === nftreeId &&
        store?.owner?.__typename === "Shared" && canonicalType(store.asMoveObject?.contents?.type?.repr) === canonicalType(`${TRADEPORT_PACKAGE}::tradeport_listings::Store`)) {
        return { ownerAddress: seller, resolutionPath: [...path, `Verified project NFTree listing ${id} in TradePort store ${storeId}; seller ${seller}`] };
      }
      return { reason: "TradePort listing seller and NFT custody could not be verified as excluded project inventory.", resolutionPath: path };
    }
    if (type === canonicalType(KIOSK_TYPE)) {
      const candidate = address(record(node.asMoveObject?.contents?.json)?.owner);
      if (candidate && !await fetchObject(candidate)) {
        const matchingCap = (await walletCaps(candidate)).find((cap) => capKioskId(cap) === id && cap.owner?.__typename === "AddressOwner" && address(cap.owner.address?.address) === candidate);
        if (matchingCap) return { ownerAddress: candidate, resolutionPath: [...path, `Kiosk ${id}`, `Verified ${matchingCap.address} capability for ${candidate}`] };
      }
      // Kiosk.owner is an editable hint and can remain the old seller after the
      // capability transfers. Discover the cap from creation, then verify its
      // live type, `for` field and owner at our pinned checkpoint.
      const currentCaps = await kioskCreationCaps(node);
      const matchingCaps = currentCaps.filter((cap) => capKioskId(cap) === id &&
        [canonicalType(KIOSK_CAP_TYPE), canonicalType(PERSONAL_KIOSK_CAP_TYPE)].includes(canonicalType(cap.asMoveObject?.contents?.type?.repr)));
      if (matchingCaps.length === 1) {
        const cap = matchingCaps[0];
        const capOwner = address(cap.owner?.address?.address);
        if (capOwner && ["AddressOwner", "ObjectOwner"].includes(cap.owner?.__typename || "")) {
          return resolveOwner(capOwner, nextSeen, [...path, `Kiosk ${id}`, `Verified creation capability ${cap.address} now controlled by ${capOwner}`], cap.owner?.__typename === "AddressOwner", nftreeId);
        }
      }
      return { reason: "Kiosk has no matching wallet-owned KioskOwnerCap at this checkpoint. Custody remains unresolved.", resolutionPath: [...path, `Kiosk ${id}; unverified owner hint ${candidate || "unavailable"}`] };
    }
    if (node.owner?.__typename === "AddressOwner" || node.owner?.__typename === "ObjectOwner") {
      const parent = address(node.owner.address?.address);
      if (parent) return resolveOwner(parent, nextSeen, [...path, `Object ${id} controlled by ${parent}`], node.owner.__typename === "AddressOwner", nftreeId);
    }
    return { reason: `Unsupported ${node.owner?.__typename || "unknown"} custody for object ${id}. No wallet was assumed.`, resolutionPath: path };
  }

  const nftrees: HolderSnapshotNFTree[] = [];
  const unresolved: HolderSnapshotUnresolvedOwner[] = [];
  // Read ownership once per distinct owner; most NFTs are held by the same treasury.
  const ownerCache = new Map<string, Promise<OwnerResolution>>();
  for (const node of objects) {
    signal?.throwIfAborted();
    const id = address(node.address)!;
    const owner = address(node.owner?.address?.address);
    const base = { nftreeObjectId: id, version: String(node.version), digest: node.digest };
    if (!owner || !["AddressOwner", "ObjectOwner"].includes(node.owner?.__typename || "")) {
      unresolved.push({ ...base, owner: node.owner?.__typename, reason: "NFTree is not owned by a verified wallet or supported custody object." });
      continue;
    }
    const ownerKey = `${node.owner?.__typename}:${owner}:${id}`;
    if (!ownerCache.has(ownerKey)) ownerCache.set(ownerKey, resolveOwner(owner, new Set(), [], node.owner?.__typename === "AddressOwner", id));
    const resolution = await ownerCache.get(ownerKey)!;
    if ("ownerAddress" in resolution) nftrees.push({
      ...base,
      ownerAddress: resolution.ownerAddress,
      label: id,
      ownerSource: node.owner?.__typename === "AddressOwner" && resolution.ownerAddress === owner && resolution.resolutionPath.length === 1 ? "direct" : "resolved",
      resolutionPath: resolution.resolutionPath,
      confidence: "verified-at-checkpoint",
    });
    else unresolved.push({ ...base, owner, reason: resolution.reason, resolutionPath: resolution.resolutionPath });
  }
  if (nftrees.length + unresolved.length !== objects.length) throw new Error("Holder snapshot inventory and owner totals do not reconcile.");

  return {
    nftreeType,
    snapshotTime: indexed.timestamp,
    checkpoint: String(checkpoint),
    checkpointDigest: indexed.digest,
    chainIdentifier: scope.chainIdentifier,
    graphqlUrl,
    complete: true,
    pagesRead,
    nftrees,
    unresolved,
  };
}
