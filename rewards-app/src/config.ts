export const CONFIG = {
  network: "mainnet",
  rpcUrl: "https://fullnode.mainnet.sui.io:443",
  grpcUrl: "https://fullnode.mainnet.sui.io:443",
  packageId: "0x2e0029466734d5baca6ee6dae6e9ae08b0c44c4ec3d0d0f93b0ccccf2ada290e",
  poolId: "0x35861dba2b386e4bd34272fd0150df76fadb56eb24fef8c84d5d98838d756fd2",
  poolInitialSharedVersion: 905295433,
  adminCapId: "0xc68d11f4568ea0f316252e451c85ffb2e2f7ba26a43b68cbfce3c432c56f5942",
  upgradeCapId: "0x431447d1e8cf8a9d25ca68cce0571870315b1156e35cdc5bd0b1cc303169fec7",
  nftreeType: "0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT",
  adminAddress: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4",
  deployer: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4",
  backgroundVideoUrl: "https://6a341f32af7c92417c67c69d--nftgiftbag.netlify.app/buy-tree-hero-city.mp4",
  tokenLogoUrl: "/assets/tree-token-logo-official.webp",
  nftreeMintUrl: "https://nftree.net/mint",
  rewardToken: {
    symbol: "SUI",
    name: "Sui",
    logoUrl: "/assets/sui-token.svg",
  },
  treeTokenUrl: "https://tree-token.xyz/",
} as const;

export const MIST_PER_SUI = 1_000_000_000n;

