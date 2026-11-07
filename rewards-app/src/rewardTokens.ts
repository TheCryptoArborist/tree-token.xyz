import { CONFIG } from "./config";

export type RewardTokenStatus = "live" | "registered" | "planned";

export type RegisteredRewardToken = {
  tokenId: string;
  symbol: string;
  name: string;
  coinType: string;
  decimals: number;
  logoUrl: string;
  projectName: string;
  projectUrl?: string;
  xUrl?: string;
  telegramUrl?: string;
  chartUrl?: string;
  isFeatured: boolean;
  isActive: boolean;
  isClaimable: boolean;
  isDepositable: boolean;
  rewardPoolObjectId?: string;
  balanceObjectId?: string;
  status: RewardTokenStatus;
  rewardType: string;
  notes: string;
};

const REGISTERED_COMMUNITY_TOKEN_DEFAULTS = {
  logoUrl: "",
  isFeatured: false,
  isActive: true,
  isClaimable: false,
  isDepositable: false,
  status: "registered" as const,
  rewardType: "Registered community reward",
  notes: "Registered with TreeDrop for community reward pool participation.",
};

export const REGISTERED_REWARD_TOKENS: RegisteredRewardToken[] = [
  {
    tokenId: "sui",
    symbol: "SUI",
    name: "Sui",
    coinType: "0x2::sui::SUI",
    decimals: 9,
    logoUrl: CONFIG.rewardToken.logoUrl,
    projectName: "Sui",
    projectUrl: "https://sui.io/",
    isFeatured: false,
    isActive: true,
    isClaimable: true,
    isDepositable: true,
    rewardPoolObjectId: CONFIG.poolId,
    status: "live",
    rewardType: "Live NFTree reward claim",
    notes: "Current deployed RewardPool supports SUI deposits and SUI claims.",
  },
  {
    tokenId: "tree",
    symbol: "TREE",
    name: "TREE",
    coinType: "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE",
    decimals: 6,
    logoUrl: CONFIG.tokenLogoUrl,
    projectName: "Thickquidity",
    projectUrl: CONFIG.treeTokenUrl,
    telegramUrl: "https://t.me/cryptoarborist",
    isFeatured: false,
    isActive: true,
    isClaimable: false,
    isDepositable: false,
    status: "registered",
    rewardType: "Host ecosystem token",
    notes: "TREE is the host ecosystem for TreeDrop and NFTrees. Its community reward pool is configured.",
  },
  {
    tokenId: "suitrump",
    symbol: "SUITRUMP",
    name: "SUI TRUMP",
    coinType: "0xdeb831e796f16f8257681c0d5d4108fa94333060300b2459133a96631bf470b8::suitrump::SUITRUMP",
    decimals: 6,
    ...REGISTERED_COMMUNITY_TOKEN_DEFAULTS,
    projectName: "SUI TRUMP",
  },
  {
    tokenId: "victory",
    symbol: "VICTORY",
    name: "Victory Token",
    coinType: "0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a::victory_token::VICTORY_TOKEN",
    decimals: 6,
    ...REGISTERED_COMMUNITY_TOKEN_DEFAULTS,
    projectName: "Victory Token",
    isFeatured: true,
  },
  {
    tokenId: "wbtc",
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    coinType: "0xaafb102dd0902f5055cadecd687fb5b71ca82ef0e0285d90afde828ec58ca96b::btc::BTC",
    decimals: 8,
    ...REGISTERED_COMMUNITY_TOKEN_DEFAULTS,
    projectName: "SuiDex BTC",
  },
  {
    tokenId: "usdc",
    symbol: "USDC",
    name: "USDC",
    coinType: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
    decimals: 6,
    ...REGISTERED_COMMUNITY_TOKEN_DEFAULTS,
    projectName: "USDC",
  },
  {
    tokenId: "xaum",
    symbol: "XAUM",
    name: "XAUM",
    coinType: "0x9d297676e7a4b771ab023291377b2adfaa4938fb9080b8d12430e4b108b836a9::xaum::XAUM",
    decimals: 9,
    ...REGISTERED_COMMUNITY_TOKEN_DEFAULTS,
    projectName: "XAUM",
  },
  {
    tokenId: "swarm",
    symbol: "TRUTH",
    name: "TRUTH (registered as SWARM)",
    coinType: "0x0a48f85a3905cfa49a652bdb074d9e9fabad27892d54afaa5c9e0adeb7ac3cdf::swarm_network_token::SWARM_NETWORK_TOKEN",
    decimals: 8,
    ...REGISTERED_COMMUNITY_TOKEN_DEFAULTS,
    projectName: "Swarm Network",
  },
  {
    tokenId: "wal",
    symbol: "WAL",
    name: "WAL",
    coinType: "0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL",
    decimals: 9,
    ...REGISTERED_COMMUNITY_TOKEN_DEFAULTS,
    projectName: "WAL",
  },
  {
    tokenId: "ns",
    symbol: "NS",
    name: "NS",
    coinType: "0x5145494a5f5100e645e4b0aa950fa6b68f614e8c59e17bc5ded3495123a79178::ns::NS",
    decimals: 6,
    ...REGISTERED_COMMUNITY_TOKEN_DEFAULTS,
    projectName: "NS",
  },
  {
    tokenId: "tato",
    symbol: "TATO",
    name: "TATO",
    coinType: "0x04deb377c33bfced1ab81cde96918e2538fe78735777150b0064ccf7df5e1c81::tato::TATO",
    decimals: 9,
    ...REGISTERED_COMMUNITY_TOKEN_DEFAULTS,
    projectName: "TATO",
  },
  {
    tokenId: "mews",
    symbol: "MEWS",
    name: "MEWS",
    coinType: "0x2dcf8629a70b235cda598170fc9b271f03f33d34dd6fa148adaff481e7a792d2::mews::MEWS",
    decimals: 6,
    ...REGISTERED_COMMUNITY_TOKEN_DEFAULTS,
    projectName: "MEWS",
  },
  {
    tokenId: "axol",
    symbol: "AXOL",
    name: "AXOL",
    coinType: "0xf00eb7ab086967a33c04a853ad960e5c6b0955ef5a47d50b376d83856dc1215e::axol::AXOL",
    decimals: 9,
    ...REGISTERED_COMMUNITY_TOKEN_DEFAULTS,
    projectName: "AXOL",
  },
  {
    tokenId: "usdsui",
    symbol: "USDSUI",
    name: "USDSUI",
    coinType: "0x44f838219cf67b058f3b37907b655f226153c18e33dfcd0da559a844fea9b1c1::usdsui::USDSUI",
    decimals: 6,
    ...REGISTERED_COMMUNITY_TOKEN_DEFAULTS,
    projectName: "USDSUI",
  },
  {
    tokenId: "wheels",
    symbol: "WHEELS",
    name: "WHEELS",
    coinType: "0x6a9c2ded791f1eea4c23ac9bc3dbebf3e5b9f828a9837c9dd62d5e5698aac3ee::wheels::WHEELS",
    decimals: 9,
    ...REGISTERED_COMMUNITY_TOKEN_DEFAULTS,
    projectName: "WHEELS",
  },
  {
    tokenId: "mbp",
    symbol: "MBP",
    name: "MBP",
    coinType: "0x4d68a38f0c7abcea02106da3bab76f5e6b0b242c100746eb1ef9692cd1129d25::mbp::MBP",
    decimals: 9,
    ...REGISTERED_COMMUNITY_TOKEN_DEFAULTS,
    projectName: "MBP",
  },
  {
    tokenId: "pans",
    symbol: "PANS",
    name: "PANS",
    coinType: "0xc9523f683256502be15ec4979098d510f67b6d3f0df02eebf124515014433270::pans::PANS",
    decimals: 9,
    ...REGISTERED_COMMUNITY_TOKEN_DEFAULTS,
    projectName: "PANS",
  },
  {
    tokenId: "deep",
    symbol: "DEEP",
    name: "DEEP",
    coinType: "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP",
    decimals: 6,
    ...REGISTERED_COMMUNITY_TOKEN_DEFAULTS,
    projectName: "DEEP",
  },
];

export const LIVE_CLAIMABLE_REWARD_TOKENS = REGISTERED_REWARD_TOKENS.filter((token) => token.isClaimable);
export const LIVE_DEPOSITABLE_REWARD_TOKENS = REGISTERED_REWARD_TOKENS.filter((token) => token.isDepositable);
export const FEATURED_REWARD_TOKENS = REGISTERED_REWARD_TOKENS.filter((token) => token.isFeatured && token.isActive);

