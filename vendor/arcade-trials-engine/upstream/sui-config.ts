// Sui Blockchain Configuration - SUI MAINNET
// Sui Foundation mainnet fullnodes disabled JSON-RPC in July 2026. The legacy
// dApp Kit still needs JSON-RPC while the app is migrated to gRPC, so keep two
// independent compatibility providers and fail over between them in App.tsx.
const DEFAULT_PUBLIC_SUI_RPC_URL = "https://sui-rpc.publicnode.com";
const DEFAULT_PUBLIC_SUI_RPC_FALLBACK_URL =
  "https://sui-mainnet-endpoint.blockvision.org";
const DEFAULT_GARDEN_BATTLES_API_BASE =
  "https://gardenbattles-production.up.railway.app";
const GARDEN_BATTLES_API_BASE = (
  ((import.meta as any).env?.VITE_GARDEN_BATTLES_API_URL as string | undefined) ||
  DEFAULT_GARDEN_BATTLES_API_BASE
).replace(/\/$/, "");
const DEFAULT_GARDEN_BATTLES_SUI_RPC_PROXY = `${GARDEN_BATTLES_API_BASE}/api/sui-rpc`;

export const SUI_CONFIG = {
  NETWORK: "mainnet",
  CHAIN: "sui:mainnet",
  RPC_URL:
    ((import.meta as any).env?.VITE_SUI_RPC_URL as string | undefined) ||
    DEFAULT_PUBLIC_SUI_RPC_URL,
  READ_RPC_URL:
    ((import.meta as any).env?.VITE_SUI_READ_RPC_URL as string | undefined) ||
    DEFAULT_GARDEN_BATTLES_SUI_RPC_PROXY,
  RPC_FALLBACK_URL:
    ((import.meta as any).env?.VITE_SUI_RPC_FALLBACK_URL as string | undefined) ||
    DEFAULT_PUBLIC_SUI_RPC_FALLBACK_URL,
  READ_RPC_FALLBACK_URL:
    ((import.meta as any).env?.VITE_SUI_READ_RPC_FALLBACK_URL as string | undefined) ||
    ((import.meta as any).env?.VITE_SUI_RPC_FALLBACK_URL as string | undefined) ||
    DEFAULT_PUBLIC_SUI_RPC_FALLBACK_URL,
  WS_URL: "wss://fullnode.mainnet.sui.io:443",
  PACKAGE_ID: "0x4a77289a2cd3d54c18f16a17cc7fe7b8890322e60e566df8683391d5a479f7ec",
  PVP_EVENT_PACKAGE_ID:
    "0x9a80317a43e1d59a4d13f9771a003b773153d729e79da329fa1793d301042edf",
  ORIGINAL_PACKAGE_ID:
    "0x656ac984c39b952b40ccaaad4c26a3e074c4c99f56e2bac0862b811557de448b",
  BOT_MOVE_RESOLVED_EVENT_PACKAGE_ID: "0x6cae4020693bcfcac9523ce8bc3d0bef7f830900e48b743d002b5d6b676e5142",
  MODULE: "battle",
  CONFIG_ID:
    "0x30addc978abe37f31d55cc60a395f30fd6cfdcbfb3cd4e319d2920b0e780a9bf",
  LEGACY_MATCHMAKING_QUEUE_ID:
    "0xb5c054185c98d9cb80e35c50f78e306ca2d7bed52955e397df9f1acad9938e4d",
  MATCHMAKING_QUEUE_ID:
    "0xb5c054185c98d9cb80e35c50f78e306ca2d7bed52955e397df9f1acad9938e4d",
  MATCHMAKING_QUEUE_50_ID:
    "0x469a5da237047f4c78223e3a2fac6bf42427ba488fd1e26f2233b65f01a31960",
  MATCHMAKING_QUEUE_75_ID:
    "0x9d805e74d3a4412e4bb935ed383ad8f9dde00715632ea61704ccc4af804666cd",
  MATCHMAKING_QUEUE_V3_50_ID:
    ((import.meta as any).env?.VITE_MATCHMAKING_QUEUE_V3_50_ID as string | undefined) ||
    "0xb380a69e611ad7636f2b7993fab6656c272c0802fd7a6ec35448a58956a0c38f",
  MATCHMAKING_QUEUE_V3_75_ID:
    ((import.meta as any).env?.VITE_MATCHMAKING_QUEUE_V3_75_ID as string | undefined) ||
    "0x03e77c44e4ef2a6203a0d84378a4a8faf3acfb82ddfef84cd5e0bb243ff5abe1",
  FIFTH_MOVE_CONFIG_ID:
    ((import.meta as any).env?.VITE_FIFTH_MOVE_CONFIG_ID as string | undefined) ||
    "0x083a9303bd13b789e87f3e746b817a8723290f25414f3686ac8868f90a5020b3",
  TREE_LOCK_ENABLED:
    (((import.meta as any).env?.VITE_TREE_LOCK_ENABLED as string | undefined) ?? "true") === "true",
  TREE_CONFIG_ID:
    ((import.meta as any).env?.VITE_TREE_CONFIG_ID as string | undefined) ||
    "0x828da1764a6c1d4d9c31cc2dc54eac9e1096172e9b68a629510818c5475119a1",
  BOT_ADDRESS:
    "0xbbe518c2a2025d2d95b9e5b6435911771f64d7d9fe037fbf2ec661981890d5b4",
  SAPLING_STRUCT:
    "0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT",
  COLLECTION_PACKAGE_ID:
    "0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705",
  COLLECTION_MODULE: "collection",
  COLLECTION_MINT_CONFIG_ID: "0xe83616020f61f73b30c40fd3f888ed397626afd071bd4666374c306d8e98b06b",
  COLLECTION_POOL_ID: "0x8cb91464eec7ada1af801a439207647d78de66bc0d4f124d6437091745a0163a",
  COLLECTION_MINT_PRICE_MIST: 25_000_000_000,
  COLLECTION_IMAGE_BASE_URI:
    "https://gateway.pinata.cloud/ipfs/bafybeieqdexmp545rptji3w4j6uigoqs3nk5lhtulunpnkjdjopaclobda",
  COLLECTION_NAME_PREFIX: "Tree NFT #",
  COLLECTION_DESCRIPTION: "Tree NFT Collection",
  ENTRY_FEE: 3_000_000_000, // Intended battle entry fee: 3 SUI.
  RANDOM_OBJECT_CANDIDATES: ["0x8", "0x6"],
  ADMIN_ADDRESSES: [
    "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4", // Contract admin
  ],
} as const;

export type PvpBattleVersion = "legacy" | "pvp-v2" | "pvp-v3" | "bot-v2";
export type PvpMatchTarget = 50 | 75 | 100;
export type PvpQueueType = "legacy" | "v2" | "v3";

export interface PvpMatchOption {
  targetGrowth: PvpMatchTarget;
  label: string;
  shortLabel: string;
  queueId: string;
  queueType: PvpQueueType;
}

export function getPvpMatchOption(targetGrowth: PvpMatchTarget): PvpMatchOption {
  if (targetGrowth === 50) {
    const v3QueueId = SUI_CONFIG.MATCHMAKING_QUEUE_V3_50_ID.trim();
    return {
      targetGrowth,
      label: "Quick Match",
      shortLabel: "50 Growth",
      queueId: v3QueueId || SUI_CONFIG.MATCHMAKING_QUEUE_50_ID,
      queueType: v3QueueId ? "v3" : "v2",
    };
  }

  if (targetGrowth === 75) {
    const v3QueueId = SUI_CONFIG.MATCHMAKING_QUEUE_V3_75_ID.trim();
    return {
      targetGrowth,
      label: "Standard Match",
      shortLabel: "75 Growth",
      queueId: v3QueueId || SUI_CONFIG.MATCHMAKING_QUEUE_75_ID,
      queueType: v3QueueId ? "v3" : "v2",
    };
  }

  return {
    targetGrowth: 100,
    label: "Legacy Match",
    shortLabel: "100 Growth",
    queueId: SUI_CONFIG.LEGACY_MATCHMAKING_QUEUE_ID,
    queueType: "legacy",
  };
}

export function getConfiguredPvpQueueOptions(): PvpMatchOption[] {
  return [
    getPvpMatchOption(100),
    getPvpMatchOption(50),
    getPvpMatchOption(75),
  ].filter((option) => option.queueId.trim().length > 0);
}

export function getPvpMatchDisplayLabel(targetGrowth: PvpMatchTarget): string {
  const option = getPvpMatchOption(targetGrowth);
  return `${option.label} - First to ${option.targetGrowth} Growth`;
}

// Short display label for buttons
export const MOVE_LABELS: Record<number, string> = {
  1: "Wedgebreaker",
  2: "Skyreach Saw",
  3: "Chainsaw Cyclone",
  4: "Rootpiercer",
  5: "Limbfall Slam",
  6: "Acorn Barrage",
  7: "Log Swing Rampage",
  8: "Barklash Shield",
  9: "Root Siphon",
  10: "Beetle Blight",
  11: "Lightning Crown",
  12: "Air Spade Blast",
  13: "Fungal Doom",
  14: "Compost Cleanse",
  15: "Rootlink Surge",
  16: "Pruning Fury",
  17: "Mulch Fortress",
  18: "Graft Fusion",
  19: "Wildwood Gamble",
  20: "Root Revival",
  21: "Solar Bloom",
  22: "Rainmaker",
  23: "Myco Might",
  24: "Canopy Downpour",
  25: "Potassium Power",
  26: "Photosynthesis Overdrive",
  27: "Ironbark Armor",
  28: "Sap Surge",
  29: "Gale Guard",
  30: "Shadow Canopy",
  31: "Chainsaw Cataclysm",
  32: "Beetle Swarm Blitz",
  33: "Lightning Split",
  34: "Ancient Root Awakening",
  35: "Canopy Explosion",
  36: "Solar Crown Surge",
  37: "Ironwood Fortress",
  38: "Rootstorm Siphon",
  39: "Arborist Ascension",
};

export type MoveType = "attack" | "growth" | "hybrid";

export interface MoveMeta {
  type: MoveType;
  effect: string; // human-readable effect description
  emoji: string;
  fifthExclusive?: boolean;
  draftLane?: "offense" | "growth" | "defense";
}

// Full metadata for tooltips and color-coding
export const MOVE_META: Record<number, MoveMeta> = {
  1: { type: "attack", emoji: "", effect: "Drains 11 Growth. Against a block, breaks it and still drains 7." },
  2: { type: "attack", emoji: "", effect: "Drains 8 Growth, or 12 when the opponent has at least 40 Growth." },
  3: { type: "attack", emoji: "", effect: "75% chance to drain 16 Growth." },
  4: { type: "attack", emoji: "", effect: "Pierces blocks and drains 11 Growth." },
  5: { type: "attack", emoji: "", effect: "Drains 12 after an opponent Growth card; otherwise drains 8." },
  6: { type: "attack", emoji: "", effect: "Fires two separate 6-Growth hits." },
  7: { type: "attack", emoji: "", effect: "Drains 13 while you are behind; otherwise drains 10." },
  8: { type: "hybrid", emoji: "", effect: "Gains 6 Growth and blocks the next hit; a fresh shield reflects 4." },
  9: { type: "hybrid", emoji: "", effect: "Drains 6 Growth and gains 4 Growth." },
  10: { type: "attack", emoji: "", effect: "Deals 4 poison damage for the opponent's next two turns; does not stack." },
  11: { type: "attack", emoji: "", effect: "75% chance to drain 17 Growth." },
  12: { type: "attack", emoji: "", effect: "Removes one block, then pierces for 10 Growth." },
  13: { type: "attack", emoji: "", effect: "Drains 7 now and 4 more on the opponent's next turn." },
  14: { type: "hybrid", emoji: "", effect: "Clears pending damage first; gains 14 when cleansing, otherwise 10." },
  15: { type: "growth", emoji: "", effect: "Gains 12 Growth while behind; otherwise gains 8." },
  16: { type: "attack", emoji: "", effect: "Spends 4 Growth to drain 16. Requires at least 4 Growth." },
  17: { type: "hybrid", emoji: "", effect: "With a block, gains 10; otherwise gains 7 and adds one block." },
  18: { type: "hybrid", emoji: "", effect: "Gains 5 Growth and drains 5 Growth." },
  19: { type: "growth", emoji: "", effect: "60% chance to gain 20 Growth; otherwise loses 4." },
  20: { type: "growth", emoji: "", effect: "Clears a pending one-turn penalty and gains 10 Growth." },
  21: { type: "growth", emoji: "", effect: "Gains a random 8 to 14 Growth." },
  22: { type: "growth", emoji: "", effect: "Gains 14 after an opponent Attack; otherwise gains 10." },
  23: { type: "growth", emoji: "", effect: "Gains 15 if the opponent is protected; otherwise gains 10." },
  24: { type: "growth", emoji: "", effect: "Gains 14 Growth while the opponent also gains 3." },
  25: { type: "growth", emoji: "", effect: "75% chance to gain 15 Growth; otherwise gains 3." },
  26: { type: "growth", emoji: "", effect: "Gains 13 after your Attack card; otherwise gains 11." },
  27: { type: "hybrid", emoji: "", effect: "Gains 7 Growth and halves the next direct hit." },
  28: { type: "growth", emoji: "", effect: "Gains 13 at 10 Growth or below; otherwise gains 10." },
  29: { type: "hybrid", emoji: "", effect: "Gains 8 Growth with a 50% chance to add one block." },
  30: { type: "growth", emoji: "", effect: "Gains 8 Growth and caps the next direct attack at 8." },
  31: { type: "attack", emoji: "", effect: "Gains 3 Growth and drains 8.", fifthExclusive: true, draftLane: "offense" },
  32: { type: "attack", emoji: "", effect: "Gains 4 Growth and deals 3 poison damage for two turns.", fifthExclusive: true, draftLane: "offense" },
  33: { type: "attack", emoji: "", effect: "Gains 3 Growth with a 75% chance to drain 10.", fifthExclusive: true, draftLane: "offense" },
  34: { type: "growth", emoji: "", effect: "Gains 11 Growth while behind; otherwise gains 10.", fifthExclusive: true, draftLane: "growth" },
  35: { type: "growth", emoji: "", effect: "Removes one opponent block and gains 10 Growth.", fifthExclusive: true, draftLane: "growth" },
  36: { type: "growth", emoji: "", effect: "Clears pending damage before it triggers and gains 9 Growth.", fifthExclusive: true, draftLane: "growth" },
  37: { type: "hybrid", emoji: "", effect: "Gains 7 Growth and adds one block.", fifthExclusive: true, draftLane: "defense" },
  38: { type: "hybrid", emoji: "", effect: "Gains 6 Growth and drains 6 Growth.", fifthExclusive: true, draftLane: "defense" },
  39: { type: "hybrid", emoji: "", effect: "Gains 8 Growth and caps the next direct attack at 8.", fifthExclusive: true, draftLane: "defense" },
};

const SELF_GROWTH_MOVE_IDS = new Set([
  8, 9, 14, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
  31, 32, 33, 34, 35, 36, 37, 38, 39,
]);

export function moveGrowsSelf(moveId: number): boolean {
  return SELF_GROWTH_MOVE_IDS.has(moveId);
}

export function getBattleUpdateEvent() {
  return `${SUI_CONFIG.ORIGINAL_PACKAGE_ID}::${SUI_CONFIG.MODULE}::BattleUpdate`;
}

export function getPvpBattleV2UpdateEvent() {
  return `${SUI_CONFIG.PVP_EVENT_PACKAGE_ID}::${SUI_CONFIG.MODULE}::PvpBattleV2Update`;
}

export function getPvpBattleV3UpdateEvent() {
  return `${SUI_CONFIG.PVP_EVENT_PACKAGE_ID}::${SUI_CONFIG.MODULE}::PvpBattleV3Update`;
}

export function getRankedBotBattleV2UpdateEvent() {
  return `${SUI_CONFIG.PVP_EVENT_PACKAGE_ID}::${SUI_CONFIG.MODULE}::RankedBotBattleV2Update`;
}

export function getBotMoveResolvedEvent() {
  return `${SUI_CONFIG.BOT_MOVE_RESOLVED_EVENT_PACKAGE_ID}::${SUI_CONFIG.MODULE}::BotMoveResolved`;
}
