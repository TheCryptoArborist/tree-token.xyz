import { CONFIG } from "./config";
import { DEFAULT_SNAPSHOT_GRAPHQL_URL, readAutomaticHolderSnapshot } from "./snapshotClient";

export type HolderSnapshotNFTree = {
  nftreeObjectId: string;
  ownerAddress?: string;
  label: string;
  version?: string;
  digest?: string;
  ownerSource?: "direct" | "resolved" | "manual" | "manual-resolved";
  resolutionPath?: string[];
  confidence?: string;
  notes?: string;
  source?: string;
};

export type HolderSnapshotUnresolvedOwner = {
  nftreeObjectId: string;
  owner?: string;
  version?: string;
  digest?: string;
  reason: string;
  resolutionPath?: string[];
};

export type HolderSnapshotSource = "auto-rpc" | "manual-import" | "indexer-graphql" | "unavailable";

export type HolderSnapshotHolder = {
  ownerAddress: string;
  nftreeCount: number;
  nftreeObjectIds: string[];
};

export type HolderSnapshot = {
  snapshotId: string;
  createdAt: string;
  importedAt?: string;
  snapshotTime: string;
  nftreeType: string;
  excludedWallets: string[];
  totalNFTrees: number;
  totalHolderWallets: number;
  excludedProjectWalletNFTrees: number;
  eligibleNFTrees: number;
  eligibleHolderWallets: number;
  directNFTrees: number;
  resolvedNFTrees: number;
  manualResolvedNFTrees: number;
  unresolvedNFTrees: number;
  holders: HolderSnapshotHolder[];
  nftrees: HolderSnapshotNFTree[];
  excludedNFTrees: HolderSnapshotNFTree[];
  unresolved: HolderSnapshotUnresolvedOwner[];
  source: HolderSnapshotSource;
  warning?: string;
  rpcMethod?: "suix_queryObjects";
  /** Present only on verified automatic snapshots, never inferred from local time. */
  checkpoint?: string;
  checkpointDigest?: string;
  chainIdentifier?: string;
  graphqlUrl?: string;
  complete?: boolean;
  manifestHash?: string;
  validationErrors?: string[];
};

function snapshotId(createdAt: string) {
  return `holder-${createdAt.replace(/[^0-9]/g, "").slice(0, 14)}`;
}

function isSuiAddress(value: string | undefined) {
  return Boolean(value && /^0x[0-9a-fA-F]{64}$/.test(value.trim()));
}

function normalizeAddress(value: string | undefined) {
  return isSuiAddress(value) ? value!.trim().toLowerCase() : undefined;
}

function buildHolderGroups(nftrees: HolderSnapshotNFTree[]) {
  const holdersByAddress = new Map<string, HolderSnapshotHolder>();

  for (const nftree of nftrees) {
    if (!nftree.ownerAddress) continue;
    const ownerAddress = nftree.ownerAddress.toLowerCase();
    const existing =
      holdersByAddress.get(ownerAddress) ||
      ({
        ownerAddress,
        nftreeCount: 0,
        nftreeObjectIds: [],
      } satisfies HolderSnapshotHolder);
    existing.nftreeCount += 1;
    existing.nftreeObjectIds.push(nftree.nftreeObjectId);
    holdersByAddress.set(ownerAddress, existing);
  }

  return [...holdersByAddress.values()].sort((a, b) =>
    b.nftreeCount === a.nftreeCount
      ? a.ownerAddress.localeCompare(b.ownerAddress)
      : b.nftreeCount - a.nftreeCount,
  );
}

export function createHolderSnapshotFromNFTrees({
  nftrees,
  unresolved,
  excludedWallets,
  source,
  snapshotTime,
  importedAt,
  warning,
  rpcMethod,
  checkpoint,
  checkpointDigest,
  chainIdentifier,
  graphqlUrl,
  complete,
}: {
  nftrees: HolderSnapshotNFTree[];
  unresolved?: HolderSnapshotUnresolvedOwner[];
  excludedWallets: string[];
  source: HolderSnapshotSource;
  snapshotTime?: string;
  importedAt?: string;
  warning?: string;
  rpcMethod?: "suix_queryObjects";
  checkpoint?: string;
  checkpointDigest?: string;
  chainIdentifier?: string;
  graphqlUrl?: string;
  complete?: boolean;
}): HolderSnapshot {
  const normalizedExcludedWallets = [...new Set([CONFIG.adminAddress, CONFIG.deployer, ...excludedWallets]
    .map((wallet) => normalizeAddress(wallet)).filter((wallet): wallet is string => Boolean(wallet)))].sort();
  const excludedSet = new Set(normalizedExcludedWallets);
  const seenNFTrees = new Set<string>();
  const normalizedNFTrees: HolderSnapshotNFTree[] = [];
  const normalizedUnresolved: HolderSnapshotUnresolvedOwner[] = [];
  let duplicateCount = 0;
  let invalidOwnerCount = 0;
  let invalidNFTreeCount = 0;

  for (const nftree of nftrees) {
    const nftreeObjectId = normalizeAddress(nftree.nftreeObjectId);
    if (!nftreeObjectId) {
      invalidNFTreeCount += 1;
      continue;
    }
    if (seenNFTrees.has(nftreeObjectId)) {
      duplicateCount += 1;
      continue;
    }
    seenNFTrees.add(nftreeObjectId);

    const ownerAddress = normalizeAddress(nftree.ownerAddress);
    if (nftree.ownerAddress && !ownerAddress) invalidOwnerCount += 1;

    if (!ownerAddress) {
      normalizedUnresolved.push({
        nftreeObjectId,
        version: nftree.version,
        digest: nftree.digest,
        owner: nftree.ownerAddress,
        reason: "NFTree has no valid owner address. Resolve its custody before preparing payments.",
      });
      continue;
    }
    normalizedNFTrees.push({
      ...nftree,
      nftreeObjectId,
      ownerAddress,
      label: nftree.label || nftreeObjectId,
      ownerSource: nftree.ownerSource || "manual",
    });
  }

  for (const item of unresolved ?? []) {
    const nftreeObjectId = normalizeAddress(item.nftreeObjectId);
    if (!nftreeObjectId) {
      invalidNFTreeCount += 1;
      continue;
    }
    if (normalizedUnresolved.some((row) => row.nftreeObjectId === nftreeObjectId)) continue;
    // Conflicting owner records are never converted to an eligible payment.
    const resolvedIndex = normalizedNFTrees.findIndex((row) => row.nftreeObjectId === nftreeObjectId);
    if (resolvedIndex >= 0) normalizedNFTrees.splice(resolvedIndex, 1);
    normalizedUnresolved.push({
      ...item,
      nftreeObjectId,
      reason: item.reason || "Owner is not a direct address. Kiosk/object owner resolution required.",
    });
  }

  const eligibleNFTrees = normalizedNFTrees.filter(
    (nftree) => nftree.ownerAddress && !excludedSet.has(nftree.ownerAddress),
  );
  const excludedNFTrees = normalizedNFTrees.filter(
    (nftree) => nftree.ownerAddress && excludedSet.has(nftree.ownerAddress),
  );
  const holders = buildHolderGroups(eligibleNFTrees);
  const directNFTrees = normalizedNFTrees.filter((nftree) => nftree.ownerSource === "direct").length;
  const resolvedNFTrees = normalizedNFTrees.filter((nftree) => nftree.ownerSource === "resolved").length;
  const manualResolvedNFTrees = normalizedNFTrees.filter((nftree) => nftree.ownerSource === "manual-resolved").length;
  const createdAt = new Date().toISOString();
  const resolvedSnapshotTime = snapshotTime || createdAt;
  const warnings = [
    warning,
    duplicateCount ? `${duplicateCount} duplicate NFTree object ID${duplicateCount === 1 ? "" : "s"} skipped.` : "",
    invalidNFTreeCount ? `${invalidNFTreeCount} invalid NFTree object ID${invalidNFTreeCount === 1 ? "" : "s"} skipped.` : "",
    invalidOwnerCount ? `${invalidOwnerCount} invalid owner address${invalidOwnerCount === 1 ? "" : "es"} skipped.` : "",
    normalizedUnresolved.length
      ? `${normalizedUnresolved.length} NFTree${normalizedUnresolved.length === 1 ? " has" : "s have"} unresolved owners. Direct payouts are blocked until every owner is verified.`
      : "",
  ].filter(Boolean);

  return {
    snapshotId: snapshotId(createdAt),
    createdAt,
    importedAt,
    snapshotTime: resolvedSnapshotTime,
    nftreeType: CONFIG.nftreeType,
    excludedWallets: normalizedExcludedWallets,
    totalNFTrees: normalizedNFTrees.length + normalizedUnresolved.length,
    totalHolderWallets: buildHolderGroups(normalizedNFTrees).length,
    excludedProjectWalletNFTrees: excludedNFTrees.length,
    eligibleNFTrees: eligibleNFTrees.length,
    eligibleHolderWallets: holders.length,
    directNFTrees,
    resolvedNFTrees,
    manualResolvedNFTrees,
    unresolvedNFTrees: normalizedUnresolved.length,
    holders,
    nftrees: eligibleNFTrees,
    excludedNFTrees,
    unresolved: normalizedUnresolved,
    source,
    warning: warnings.join(" "),
    rpcMethod,
    checkpoint,
    checkpointDigest,
    chainIdentifier,
    graphqlUrl,
    complete: complete === true && !duplicateCount && !invalidNFTreeCount && !invalidOwnerCount,
    validationErrors: [
      duplicateCount ? "Snapshot contained duplicate NFTree IDs." : "",
      invalidNFTreeCount ? "Snapshot contained invalid NFTree IDs." : "",
      invalidOwnerCount ? "Snapshot contained invalid owner addresses." : "",
    ].filter(Boolean),
  };
}

function parseCsvRows(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(value.trim());
      value = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
      continue;
    }
    value += char;
  }

  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function stringField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function parseHolderSnapshotImport(input: string, excludedWallets: string[], fallbackSnapshotTime?: string) {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Paste a holder snapshot JSON or CSV before importing.");

  let nftrees: HolderSnapshotNFTree[];
  let snapshotTime = fallbackSnapshotTime;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      snapshotTime = stringField(record, ["snapshotTime", "createdAt"]) || fallbackSnapshotTime;
    }
    const rows = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && "nftrees" in parsed
        ? (parsed as { nftrees?: unknown }).nftrees
        : undefined;
    if (!Array.isArray(rows)) throw new Error('JSON import must include a "nftrees" array.');
    nftrees = rows.map((row, index) => {
      const record = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      const nftreeObjectId = String(record.nftreeObjectId || record.objectId || "");
      const ownerAddress = String(record.ownerAddress || record.owner || "");
      return {
        nftreeObjectId,
        ownerAddress,
        label: String(record.nftreeLabel || record.label || record.name || nftreeObjectId || `NFTree ${index + 1}`),
        version: record.version ? String(record.version) : undefined,
        digest: record.digest ? String(record.digest) : undefined,
        ownerSource: "manual",
      };
    });
  } else {
    const rows = parseCsvRows(trimmed);
    const headers = rows.shift()?.map((header) => header.trim().toLowerCase()) ?? [];
    const ownerIndex = headers.indexOf("owneraddress");
    const nftreeIndex = headers.indexOf("nftreeobjectid");
    if (ownerIndex < 0 || nftreeIndex < 0) {
      throw new Error("CSV import requires ownerAddress and nftreeObjectId columns.");
    }
    const labelIndex = headers.indexOf("nftreelabel");
    const versionIndex = headers.indexOf("version");
    const digestIndex = headers.indexOf("digest");
    nftrees = rows.map((row, index) => {
      const nftreeObjectId = row[nftreeIndex] || "";
      return {
        nftreeObjectId,
        ownerAddress: row[ownerIndex] || "",
        label: labelIndex >= 0 ? row[labelIndex] || nftreeObjectId : nftreeObjectId || `NFTree ${index + 1}`,
        version: versionIndex >= 0 ? row[versionIndex] || undefined : undefined,
        digest: digestIndex >= 0 ? row[digestIndex] || undefined : undefined,
        ownerSource: "manual",
      };
    });
  }

  return createHolderSnapshotFromNFTrees({
    nftrees,
    excludedWallets,
    source: "manual-import",
    snapshotTime,
    importedAt: new Date().toISOString(),
  });
}

export function applyResolvedOwnersImport({
  snapshot,
  input,
  excludedWallets,
}: {
  snapshot: HolderSnapshot;
  input: string;
  excludedWallets: string[];
}) {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Paste a resolved owners CSV before importing.");

  const rows = parseCsvRows(trimmed);
  const headers = rows.shift()?.map((header) => header.trim().toLowerCase()) ?? [];
  const nftreeIndex = headers.indexOf("nftreeobjectid");
  const ownerIndex = headers.indexOf("owneraddress");
  if (nftreeIndex < 0 || ownerIndex < 0) {
    throw new Error("Resolved owners CSV requires nftreeObjectId and ownerAddress columns.");
  }
  const notesIndex = headers.indexOf("notes");
  const sourceIndex = headers.indexOf("source");
  const unresolvedById = new Map(snapshot.unresolved.map((item) => [item.nftreeObjectId.toLowerCase(), item]));
  const excludedSet = new Set(excludedWallets.map((wallet) => wallet.toLowerCase()));
  const seenImportIds = new Set<string>();
  const resolvedNFTrees: HolderSnapshotNFTree[] = [];
  const resolvedIds = new Set<string>();
  let duplicateCount = 0;
  let invalidNFTreeCount = 0;
  let invalidOwnerCount = 0;
  let unknownNFTreeCount = 0;
  let excludedOwnerCount = 0;

  for (const row of rows) {
    const nftreeObjectId = normalizeAddress(row[nftreeIndex]);
    const ownerAddress = normalizeAddress(row[ownerIndex]);
    if (!nftreeObjectId) {
      invalidNFTreeCount += 1;
      continue;
    }
    if (seenImportIds.has(nftreeObjectId)) {
      duplicateCount += 1;
      continue;
    }
    seenImportIds.add(nftreeObjectId);
    if (!ownerAddress) {
      invalidOwnerCount += 1;
      continue;
    }
    if (excludedSet.has(ownerAddress)) {
      excludedOwnerCount += 1;
      continue;
    }
    const unresolved = unresolvedById.get(nftreeObjectId);
    if (!unresolved) {
      unknownNFTreeCount += 1;
      continue;
    }
    const notes = notesIndex >= 0 ? row[notesIndex] || undefined : undefined;
    const source = sourceIndex >= 0 ? row[sourceIndex] || undefined : undefined;
    resolvedIds.add(nftreeObjectId);
    resolvedNFTrees.push({
      nftreeObjectId,
      ownerAddress,
      label: unresolved.nftreeObjectId,
      version: unresolved.version,
      digest: unresolved.digest,
      ownerSource: "manual-resolved",
      resolutionPath: [
        ...(unresolved.resolutionPath ?? []),
        `Manually resolved to ${ownerAddress}${source ? ` from ${source}` : ""}`,
      ],
      notes,
      source,
    });
  }

  if (!resolvedNFTrees.length) {
    const reasons = [
      invalidNFTreeCount ? `${invalidNFTreeCount} invalid NFTree ID${invalidNFTreeCount === 1 ? "" : "s"}` : "",
      invalidOwnerCount ? `${invalidOwnerCount} invalid owner address${invalidOwnerCount === 1 ? "" : "es"}` : "",
      duplicateCount ? `${duplicateCount} duplicate NFTree ID${duplicateCount === 1 ? "" : "s"}` : "",
      unknownNFTreeCount ? `${unknownNFTreeCount} NFTree ID${unknownNFTreeCount === 1 ? " is" : "s are"} not in the unresolved list` : "",
      excludedOwnerCount ? `${excludedOwnerCount} project wallet owner${excludedOwnerCount === 1 ? "" : "s"} rejected` : "",
    ].filter(Boolean);
    throw new Error(`No resolved owner rows were imported.${reasons.length ? ` ${reasons.join("; ")}.` : ""}`);
  }

  const remainingUnresolved = snapshot.unresolved.filter((item) => !resolvedIds.has(item.nftreeObjectId.toLowerCase()));
  const warnings = [
    `${resolvedNFTrees.length} unresolved NFTree owner${resolvedNFTrees.length === 1 ? "" : "s"} manually resolved.`,
    invalidNFTreeCount ? `${invalidNFTreeCount} invalid NFTree ID${invalidNFTreeCount === 1 ? "" : "s"} skipped.` : "",
    invalidOwnerCount ? `${invalidOwnerCount} invalid owner address${invalidOwnerCount === 1 ? "" : "es"} skipped.` : "",
    duplicateCount ? `${duplicateCount} duplicate NFTree ID${duplicateCount === 1 ? "" : "s"} skipped.` : "",
    unknownNFTreeCount ? `${unknownNFTreeCount} NFTree ID${unknownNFTreeCount === 1 ? " was" : "s were"} not in the unresolved list.` : "",
    excludedOwnerCount ? `${excludedOwnerCount} project wallet owner${excludedOwnerCount === 1 ? "" : "s"} rejected.` : "",
  ].filter(Boolean);

  return createHolderSnapshotFromNFTrees({
    nftrees: [...snapshot.nftrees, ...snapshot.excludedNFTrees, ...resolvedNFTrees],
    unresolved: remainingUnresolved,
    excludedWallets: snapshot.excludedWallets.length ? snapshot.excludedWallets : excludedWallets,
    source: snapshot.source,
    snapshotTime: snapshot.snapshotTime,
    importedAt: new Date().toISOString(),
    warning: warnings.join(" "),
    rpcMethod: snapshot.rpcMethod,
  });
}

export function snapshotToCsv(snapshot: HolderSnapshot) {
  const rows = [
    ["ownerAddress", "nftreeCount", "nftreeObjectIds"],
    ...snapshot.holders.map((holder) => [
      holder.ownerAddress,
      String(holder.nftreeCount),
      holder.nftreeObjectIds.join(" "),
    ]),
  ];

  return rows
    .map((row) =>
      row
        .map((value) => {
          const escaped = value.replace(/"/g, '""');
          return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
        })
        .join(","),
    )
    .join("\n");
}

export function unresolvedOwnersToCsv(snapshot: HolderSnapshot) {
  const rows = [
    ["nftreeObjectId", "ownerAddress", "unresolvedOwnerObject", "reason", "resolutionPath", "notes", "source"],
    ...snapshot.unresolved.map((item) => [
      item.nftreeObjectId,
      "",
      item.owner || "",
      item.reason,
      item.resolutionPath?.join(" | ") || "",
      "",
      "",
    ]),
  ];

  return rows
    .map((row) =>
      row
        .map((value) => {
          const escaped = value.replace(/"/g, '""');
          return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
        })
        .join(","),
    )
    .join("\n");
}

/** Stable inventory evidence for exports and payment-ledger reconciliation. */
export async function hashHolderSnapshotManifest(snapshot: HolderSnapshot): Promise<string> {
  const inventory = [...snapshot.nftrees, ...snapshot.excludedNFTrees].map((item) => ({
    id: item.nftreeObjectId,
    owner: item.ownerAddress,
    version: item.version,
    digest: item.digest,
  })).sort((a, b) => a.id.localeCompare(b.id));
  const unresolved = snapshot.unresolved.map((item) => ({
    id: item.nftreeObjectId,
    owner: item.owner,
    version: item.version,
    digest: item.digest,
    reason: item.reason,
  })).sort((a, b) => a.id.localeCompare(b.id));
  const manifest = JSON.stringify({
    schema: "treedrop-holder-snapshot-v1",
    chainIdentifier: snapshot.chainIdentifier,
    checkpoint: snapshot.checkpoint,
    checkpointDigest: snapshot.checkpointDigest,
    nftreeType: snapshot.nftreeType,
    excludedWallets: [...snapshot.excludedWallets].sort(),
    complete: snapshot.complete === true,
    inventory,
    unresolved,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(manifest));
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function holderSnapshotPayoutBlockers(snapshot: HolderSnapshot): string[] {
  return [
    snapshot.source !== "indexer-graphql" || snapshot.complete !== true ? "Load a complete automatic holder snapshot before paying." : "",
    !snapshot.checkpoint || !snapshot.checkpointDigest || !snapshot.chainIdentifier || !snapshot.manifestHash ? "Verified checkpoint and snapshot manifest evidence are required." : "",
    snapshot.nftreeType !== CONFIG.nftreeType ? "The holder snapshot is for a different NFT collection." : "",
    snapshot.unresolvedNFTrees || snapshot.unresolved.length ? "Every NFTree owner must be resolved before direct payments." : "",
    snapshot.totalNFTrees !== snapshot.eligibleNFTrees + snapshot.excludedProjectWalletNFTrees + snapshot.unresolvedNFTrees ? "Holder snapshot inventory totals do not reconcile." : "",
    !snapshot.eligibleHolderWallets || !snapshot.eligibleNFTrees ? "The snapshot has no eligible NFTree holders." : "",
    ...(snapshot.validationErrors || []),
  ].filter(Boolean);
}

export async function fetchHolderSnapshot({
  excludedWallets,
  signal,
}: {
  excludedWallets: string[];
  snapshotTime?: string;
  signal?: AbortSignal;
}): Promise<HolderSnapshot> {
  try {
    const payload = await readAutomaticHolderSnapshot({
      nftreeType: CONFIG.nftreeType,
      graphqlUrl: import.meta.env?.VITE_SUI_GRAPHQL_URL || DEFAULT_SNAPSHOT_GRAPHQL_URL,
      projectWallets: [CONFIG.adminAddress, CONFIG.deployer, ...excludedWallets],
      signal,
    });
    const snapshot = createHolderSnapshotFromNFTrees({
      nftrees: payload.nftrees,
      unresolved: payload.unresolved,
      excludedWallets,
      source: "indexer-graphql",
      snapshotTime: payload.snapshotTime,
      checkpoint: payload.checkpoint,
      checkpointDigest: payload.checkpointDigest,
      chainIdentifier: payload.chainIdentifier,
      graphqlUrl: payload.graphqlUrl,
      complete: payload.complete,
    });
    snapshot.manifestHash = await hashHolderSnapshotManifest(snapshot);
    snapshot.snapshotId = `holder-cp-${payload.checkpoint}-${snapshot.manifestHash.slice(7, 19)}`;
    return snapshot;
  } catch (error) {
    if (signal?.aborted) throw error;
    const message = error instanceof Error ? error.message : "Automatic snapshot source unavailable.";
    throw new Error(`${message} A complete verified automatic snapshot is required before direct payouts.`);
  }
}

