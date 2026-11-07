import { bcs, TypeTagSerializer } from "@mysten/sui/bcs";
import { GrpcWebFetchTransport, SuiGrpcClient } from "@mysten/sui/grpc";
import { deriveDynamicFieldID, normalizeStructTag, parseStructTag } from "@mysten/sui/utils";
import { CONFIG } from "./config";

/** Reward reads use the same supported transport as wallet transactions. */
export const rewardClient = new SuiGrpcClient({
  network: CONFIG.network,
  transport: new GrpcWebFetchTransport({ baseUrl: CONFIG.grpcUrl, timeout: 20_000 }),
});

const ClaimKey = bcs.struct("ClaimKey", { round: bcs.u64(), nftree_id: bcs.Address });

export function claimKeyBytes(round: bigint, nftreeId: string) {
  return ClaimKey.serialize({ round, nftree_id: nftreeId }).toBytes();
}

export function moveFields(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} fields are unavailable.`);
  }
  const record = value as Record<string, unknown>;
  return record.fields && typeof record.fields === "object" && !Array.isArray(record.fields)
    ? record.fields as Record<string, unknown>
    : record;
}

/** A missing/unreadable value must never become a zero balance. */
export function moveInteger(value: unknown, label: string): bigint {
  if (typeof value === "bigint") {
    if (value < 0n) throw new Error(`${label} is invalid.`);
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} is invalid.`);
    return BigInt(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  if (value && typeof value === "object") {
    const fields = moveFields(value, label);
    for (const key of ["value", "balance", "size"]) {
      if (fields[key] !== undefined) return moveInteger(fields[key], label);
    }
  }
  throw new Error(`${label} is unavailable.`);
}

export function moveAddress(value: unknown): string | undefined {
  if (typeof value === "string" && /^0x[0-9a-fA-F]{1,64}$/.test(value)) {
    return `0x${value.slice(2).padStart(64, "0").toLowerCase()}`;
  }
  if (!value || typeof value !== "object") return undefined;
  const fields = moveFields(value, "Address");
  for (const key of ["id", "bytes", "value", "owner", "owner_address", "address"]) {
    if (fields[key] !== undefined) {
      const address = moveAddress(fields[key]);
      if (address) return address;
    }
  }
  return undefined;
}

export function requiredMoveAddress(value: unknown, label: string) {
  const address = moveAddress(value);
  if (!address) throw new Error(`${label} is unavailable.`);
  return address;
}

export async function fetchRewardObject(objectId: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const { object } = await rewardClient.getObject({ objectId, include: { json: true }, signal });
  signal?.throwIfAborted();
  return { object, fields: moveFields(object.json, "Reward object") };
}

// Only an explicit missing field is an unclaimed/unallocated result. Network,
// permission, decoding and aborted requests continue to reject.
export async function fetchRewardField(
  parentId: string,
  type: string,
  nameBytes: Uint8Array,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const fieldId = deriveDynamicFieldID(parentId, TypeTagSerializer.parseFromStr(type), nameBytes);
  // SDK 2.20's Core getDynamicField discards the per-object gRPC status code.
  // Retain that code so only NOT_FOUND can be treated as an absent receipt.
  const { response } = await rewardClient.ledgerService.batchGetObjects({
    requests: [{ objectId: fieldId }],
    readMask: { paths: ["object_id", "object_type", "contents"] },
  }, { abort: signal });
  const result = response.objects[0]?.result;
  if (result?.oneofKind === "error") {
    if (result.error.code === 5) return undefined;
    throw new Error(result.error.message || "Reward field read failed.");
  }
  if (result?.oneofKind !== "object") throw new Error("Reward field response is unavailable.");
  const field = result.object;
  const fieldType = parseStructTag(field.objectType || "");
  if (fieldType.module !== "dynamic_field" || fieldType.name !== "Field") {
    throw new Error("Reward field has an unexpected object type.");
  }
  const content = field.contents?.value;
  if (!content || content.length <= 32 + nameBytes.length) throw new Error("Reward field contents are unavailable.");
  const valueType = fieldType.typeParams[1];
  if (!valueType) throw new Error("Reward field value type is unavailable.");
  return {
    fieldId,
    value: {
      type: typeof valueType === "string" ? valueType : normalizeStructTag(valueType),
      bcs: content.slice(32 + nameBytes.length),
    },
  };
}

export async function fetchRewardBalance(owner: string, coinType: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const { balance } = await rewardClient.getBalance({ owner, coinType, signal });
  signal?.throwIfAborted();
  return moveInteger(balance.balance, "Wallet token balance");
}

export async function fetchRewardCoins(owner: string, coinType: string, signal?: AbortSignal) {
  const coins: Array<{ coinObjectId: string; balance: string }> = [];
  let page = await rewardClient.listCoins({ owner, coinType, limit: 50, signal });
  const seenCursors = new Set<string>();
  while (true) {
    signal?.throwIfAborted();
    for (const coin of page.objects) coins.push({ coinObjectId: coin.objectId, balance: coin.balance });
    if (!page.hasNextPage) break;
    if (!page.cursor || seenCursors.has(page.cursor)) throw new Error("Token coin scan did not return a new page cursor.");
    seenCursors.add(page.cursor);
    page = await rewardClient.listCoins({ owner, coinType, limit: 50, cursor: page.cursor, signal });
  }
  return coins;
}
