export type CampaignRewardStatus =
  | "coming-soon"
  | "draft"
  | "snapshot-pending"
  | "ready"
  | "active"
  | "closed";

export type CampaignParticipant = {
  wallet: string;
  xUsername?: string;
  telegramUsername?: string;
  points?: number;
  rank?: number;
  tier?: string;
  rewardAmount?: string;
  eligibleFromRaidar: boolean;
  requiredTreeHeldAtCheck?: boolean;
  nftreeHeldAtCheck?: boolean;
  claimed: boolean;
};

export type CampaignRewardConfig = {
  campaignId: string;
  title: string;
  description: string;
  status: CampaignRewardStatus;
  featuredProject: string;
  featuredTokenId: string;
  rewardTokenId: string;
  rewardPoolTokenId: string;
  startDate?: string;
  endDate?: string;
  claimDeadline?: string;
  requiredTreeAmount?: string;
  requiresNFTree: boolean;
  requiresCampaignSnapshot: boolean;
  snapshotSource: "Raidar export" | "manual";
  participants: CampaignParticipant[];
  notes: string;
};

export const SAMPLE_CAMPAIGN_REWARDS: CampaignRewardConfig[] = [
  {
    campaignId: "tree-community-raid-preview",
    title: "TREE Community Raid",
    description:
      "A future campaign reward preview for TREE community raid and X campaign participants.",
    status: "coming-soon",
    featuredProject: "Victory Token",
    featuredTokenId: "victory",
    rewardTokenId: "victory",
    rewardPoolTokenId: "victory",
    requiredTreeAmount: "TBD",
    requiresNFTree: true,
    requiresCampaignSnapshot: true,
    snapshotSource: "Raidar export",
    participants: [],
    notes:
      "Campaign rewards are separate from standard NFTree holder distributions and will use manual campaign snapshots before claim support is enabled.",
  },
];

// Future campaign rewards should only become claimable when:
// - wallet appears in the Raidar campaign snapshot
// - wallet satisfies campaign rules
// - wallet holds the required TREE amount if configured
// - wallet holds an NFTree if required
// - wallet is not in the reward-excluded project wallet list
// - wallet/NFTree has not already claimed that campaign
// - campaign claim window is open
// - selected reward pool is funded and active

