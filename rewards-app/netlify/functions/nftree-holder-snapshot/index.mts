const DEFAULT_SUI_GRAPHQL_URL = "https://graphql.mainnet.sui.io/graphql";
const DEFAULT_NFTREE_TYPE =
  "0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT";
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGES = 100;
const MAX_OWNER_RESOLUTION_DEPTH = 3;

declare const Netlify:
  | {
      env: {
        get: (key: string) => string | undefined;
      };
    }
  | undefined;

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...(init.headers || {}),
    },
  });
}

function envValue(key: string) {
  return typeof Netlify === "undefined" ? undefined : Netlify.env.get(key) || undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isSuiAddress(value: unknown) {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value.trim());
}

type ParsedOwner =
  | {
      kind: "direct";
      ownerAddress: string;
    }
  | {
      kind: "object";
      ownerObjectId: string;
      ownerText: string;
      unresolvedReason: string;
    }
  | {
      kind: "unresolved";
      ownerText?: string;
      unresolvedReason: string;
    };

type OwnerResolution =
  | {
      ownerAddress: string;
      resolutionPath: string[];
      confidence: "resolved-by-owner-chain";
    }
  | {
      unresolvedReason: string;
      resolutionPath: string[];
    };

function parseOwner(owner: any): ParsedOwner {
  if (!owner || typeof owner !== "object") {
    return { kind: "unresolved", unresolvedReason: "Owner is not available from the indexer response." };
  }

  const ownerType = stringValue(owner.__typename) || "UnknownOwner";
  const ownerAddress = stringValue(owner.address?.address);

  if (ownerType === "AddressOwner") {
    if (isSuiAddress(ownerAddress)) return { kind: "direct", ownerAddress: ownerAddress.toLowerCase() };
    return {
      kind: "unresolved",
      ownerText: ownerType,
      unresolvedReason: "Address-owned NFTree did not include a valid owner address.",
    };
  }

  if (ownerType === "ObjectOwner") {
    if (isSuiAddress(ownerAddress)) {
      return {
        kind: "object",
        ownerObjectId: ownerAddress.toLowerCase(),
        ownerText: ownerAddress.toLowerCase(),
        unresolvedReason: "Owner is object-owned; final wallet resolution required.",
      };
    }
    return {
      kind: "unresolved",
      ownerText: ownerAddress || ownerType,
      unresolvedReason: "Owner is object-owned; final wallet resolution required.",
    };
  }

  if (ownerType === "Shared") {
    return {
      kind: "unresolved",
      ownerText: `Shared${owner.initialSharedVersion === undefined ? "" : ` v${owner.initialSharedVersion}`}`,
      unresolvedReason: "Owner is shared; final wallet resolution required.",
    };
  }

  if (ownerType === "Immutable") {
    return {
      kind: "unresolved",
      ownerText: ownerType,
      unresolvedReason: "Owner is immutable; final wallet resolution required.",
    };
  }

  if (ownerType === "ConsensusAddressOwner") {
    return {
      kind: "unresolved",
      ownerText: ownerAddress || ownerType,
      unresolvedReason: "Owner is consensus-address-owned; final wallet resolution required.",
    };
  }

  return {
    kind: "unresolved",
    ownerText: ownerType,
    unresolvedReason: "Owner type is not supported by the automatic snapshot source.",
  };
}

const OWNER_FRAGMENT = `
  owner {
    __typename
    ... on AddressOwner {
      address {
        address
      }
    }
    ... on ObjectOwner {
      address {
        address
      }
    }
    ... on Shared {
      initialSharedVersion
    }
    ... on Immutable {
      _
    }
    ... on ConsensusAddressOwner {
      startVersion
      address {
        address
      }
    }
  }
`;

function normalizeNode(node: any) {
  const nftreeObjectId = stringValue(node.address) || stringValue(node.objectId);
  if (!isSuiAddress(nftreeObjectId)) return {};

  const parsedOwner = parseOwner(node.owner);
  const base = {
    nftreeObjectId: nftreeObjectId.toLowerCase(),
    version: node.version === undefined ? undefined : String(node.version),
    digest: stringValue(node.digest),
  };

  if (parsedOwner.kind === "direct") {
    return {
      nftree: {
        ...base,
        ownerAddress: parsedOwner.ownerAddress,
        ownerSource: "direct",
        resolutionPath: [`NFTree directly owned by ${parsedOwner.ownerAddress}`],
      },
    };
  }

  if (parsedOwner.kind === "object") {
    return {
      objectOwned: {
        ...base,
        ownerObjectId: parsedOwner.ownerObjectId,
        owner: parsedOwner.ownerText,
        reason: parsedOwner.unresolvedReason,
      },
    };
  }

  return {
    unresolved: {
      ...base,
      owner: parsedOwner.ownerText,
      reason: parsedOwner.unresolvedReason || "Owner is not a direct address. Kiosk/object owner resolution required.",
    },
  };
}

async function graphQlRequest(graphqlUrl: string, query: string, variables: Record<string, unknown>) {
  const response = await fetch(graphqlUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Sui GraphQL request failed with HTTP ${response.status}.`);
  }

  const payload = await response.json();
  if (Array.isArray(payload.errors) && payload.errors.length) {
    const message = payload.errors.map((error: any) => error.message).filter(Boolean).join("; ");
    throw new Error(message || "Sui GraphQL returned an error while querying NFTree objects.");
  }

  return payload;
}

function readObjectsConnection(payload: any) {
  const root = payload && typeof payload === "object" && payload.data && typeof payload.data === "object" ? payload.data : {};
  const connection = root.objects;
  const nodes = Array.isArray(connection?.nodes) ? connection.nodes : [];
  const pageInfo = connection?.pageInfo && typeof connection.pageInfo === "object" ? connection.pageInfo : {};

  return {
    nodes,
    hasNextPage: Boolean(pageInfo.hasNextPage),
    endCursor: stringValue(pageInfo.endCursor) || null,
  };
}

async function fetchObjectOwner(graphqlUrl: string, objectId: string) {
  const query = `
    query NFTreeOwnerObject($address: SuiAddress!) {
      object(address: $address) {
        address
        ${OWNER_FRAGMENT}
      }
    }
  `;
  const payload = await graphQlRequest(graphqlUrl, query, { address: objectId });
  return payload?.data?.object?.owner;
}

async function resolveFinalWalletOwner({
  graphqlUrl,
  ownerObjectId,
  depth = 0,
  resolutionPath = [],
  cache,
}: {
  graphqlUrl: string;
  ownerObjectId: string;
  depth?: number;
  resolutionPath?: string[];
  cache: Map<string, Promise<OwnerResolution>>;
}): Promise<OwnerResolution> {
  const normalizedOwnerObjectId = ownerObjectId.toLowerCase();
  const startingPath =
    resolutionPath.length > 0
      ? resolutionPath
      : [`NFTree object-owned by ${normalizedOwnerObjectId}`];

  if (depth >= MAX_OWNER_RESOLUTION_DEPTH) {
    return {
      unresolvedReason: "Owner chain did not resolve to direct wallet within max depth.",
      resolutionPath: startingPath,
    };
  }

  const cached = cache.get(normalizedOwnerObjectId);
  if (cached) {
    const result = await cached;
    return {
      ...result,
      resolutionPath: [...startingPath, ...result.resolutionPath.slice(1)],
    };
  }

  const resolutionPromise = (async (): Promise<OwnerResolution> => {
    const owner = await fetchObjectOwner(graphqlUrl, normalizedOwnerObjectId);
    const parsedOwner = parseOwner(owner);

    if (parsedOwner.kind === "direct") {
      return {
        ownerAddress: parsedOwner.ownerAddress,
        resolutionPath: [...startingPath, `${normalizedOwnerObjectId} owned by ${parsedOwner.ownerAddress}`],
        confidence: "resolved-by-owner-chain",
      };
    }

    if (parsedOwner.kind === "object") {
      return resolveFinalWalletOwner({
        graphqlUrl,
        ownerObjectId: parsedOwner.ownerObjectId,
        depth: depth + 1,
        resolutionPath: [...startingPath, `${normalizedOwnerObjectId} object-owned by ${parsedOwner.ownerObjectId}`],
        cache,
      });
    }

    return {
      unresolvedReason: parsedOwner.unresolvedReason,
      resolutionPath: [...startingPath, `${normalizedOwnerObjectId}: ${parsedOwner.unresolvedReason}`],
    };
  })();

  cache.set(normalizedOwnerObjectId, resolutionPromise);
  return resolutionPromise;
}

async function queryObjectsByType(graphqlUrl: string, nftreeType: string) {
  const nftrees = [];
  const unresolved = [];
  const ownerResolutionCache = new Map<string, Promise<OwnerResolution>>();
  let cursor = null;
  let pages = 0;

  const query = `
    query NFTreeHolderSnapshot($type: String!, $first: Int!, $after: String) {
      objects(filter: { type: $type }, first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          address
          version
          digest
          ${OWNER_FRAGMENT}
        }
      }
    }
  `;

  do {
    pages += 1;
    if (pages > MAX_PAGES) throw new Error(`Snapshot query exceeded ${MAX_PAGES} pages.`);

    const payload = await graphQlRequest(graphqlUrl, query, {
      type: nftreeType,
      first: DEFAULT_PAGE_SIZE,
      after: cursor,
    });

    const connection = readObjectsConnection(payload);
    for (const node of connection.nodes) {
      const normalized = normalizeNode(node);
      if (normalized.nftree) nftrees.push(normalized.nftree);
      if (normalized.objectOwned) {
        try {
          const resolution = await resolveFinalWalletOwner({
            graphqlUrl,
            ownerObjectId: normalized.objectOwned.ownerObjectId,
            cache: ownerResolutionCache,
          });
          if ("ownerAddress" in resolution && isSuiAddress(resolution.ownerAddress)) {
            nftrees.push({
              nftreeObjectId: normalized.objectOwned.nftreeObjectId,
              version: normalized.objectOwned.version,
              digest: normalized.objectOwned.digest,
              ownerAddress: resolution.ownerAddress,
              ownerSource: "resolved",
              resolutionPath: resolution.resolutionPath,
              confidence: resolution.confidence,
            });
          } else {
            unresolved.push({
              nftreeObjectId: normalized.objectOwned.nftreeObjectId,
              version: normalized.objectOwned.version,
              digest: normalized.objectOwned.digest,
              owner: normalized.objectOwned.owner,
              reason: resolution.unresolvedReason,
              resolutionPath: resolution.resolutionPath,
            });
          }
        } catch (error) {
          unresolved.push({
            nftreeObjectId: normalized.objectOwned.nftreeObjectId,
            version: normalized.objectOwned.version,
            digest: normalized.objectOwned.digest,
            owner: normalized.objectOwned.owner,
            reason: error instanceof Error ? error.message : "Owner-chain resolution failed.",
            resolutionPath: [`NFTree object-owned by ${normalized.objectOwned.ownerObjectId}`],
          });
        }
      }
      if (normalized.unresolved) unresolved.push(normalized.unresolved);
    }

    cursor = connection.hasNextPage ? connection.endCursor : null;
  } while (cursor);

  return { nftrees, unresolved };
}

export default async function handler(request: Request) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  const graphqlUrl = envValue("SUI_GRAPHQL_URL") || DEFAULT_SUI_GRAPHQL_URL;
  const nftreeType = envValue("NFTREE_TYPE") || DEFAULT_NFTREE_TYPE;
  const snapshotTime = new Date().toISOString();

  if (!graphqlUrl) {
    return jsonResponse(
      {
        error: "Snapshot data source is not configured.",
        requiredEnv: ["SUI_GRAPHQL_URL", "NFTREE_TYPE"],
      },
      { status: 503 },
    );
  }

  try {
    const { nftrees, unresolved } = await queryObjectsByType(graphqlUrl, nftreeType);
    const directNFTrees = nftrees.filter((nftree: any) => nftree.ownerSource !== "resolved").length;
    const resolvedNFTrees = nftrees.filter((nftree: any) => nftree.ownerSource === "resolved").length;
    return jsonResponse({
      snapshotTime,
      createdAt: snapshotTime,
      source: "Auto Indexer",
      nftreeType,
      directNFTrees,
      resolvedNFTrees,
      unresolvedNFTrees: unresolved.length,
      nftrees,
      unresolved,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Automatic holder snapshot failed.",
        source: "Auto Indexer",
        nftreeType,
      },
      { status: 502 },
    );
  }
}

export const config = {
  path: "/.netlify/functions/nftree-holder-snapshot",
  method: ["GET"],
};

