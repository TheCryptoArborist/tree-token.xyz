export const TREE_KNOWLEDGE_TRIAL_VERSION = 'tree-knowledge-trial-v1';
export const TREE_KNOWLEDGE_TRIAL_QUESTION_SET = 'tree-ecosystem-rotating-v3';
export const TREE_KNOWLEDGE_TRIAL_DURATION_SECONDS = 90;
export const TREE_KNOWLEDGE_TRIAL_QUESTION_COUNT = 3;
export const TREE_KNOWLEDGE_TRIAL_MINIMUM_USD_CENTS = 500;

export type TreeKnowledgeOption = Readonly<{ id: string; label: string }>;
export type TreeKnowledgeQuestion = Readonly<{
  id: string;
  prompt: string;
  options: readonly TreeKnowledgeOption[];
  correctOptionId: string;
  explanation: string;
}>;

export type PublicTreeKnowledgeQuestion = Omit<TreeKnowledgeQuestion, 'correctOptionId' | 'explanation'>;
export type TreeKnowledgeAnswer = { questionId: string; optionId: string };
export type TreeKnowledgeScore = {
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  elapsedMs: number;
  elapsedSeconds: number;
  timedOut: boolean;
  answers: Array<{
    questionId: string;
    optionId: string | null;
    correct: boolean;
    correctOptionId: string;
    explanation: string;
  }>;
};

export const TREE_KNOWLEDGE_TRIAL_QUESTION_BANK: readonly TreeKnowledgeQuestion[] = Object.freeze([
  {
    id: 'network',
    prompt: 'Which network is the TREE ecosystem built on?',
    options: Object.freeze([
      { id: 'a', label: 'Ethereum Mainnet' },
      { id: 'b', label: 'Sui Mainnet' },
      { id: 'c', label: 'Solana Mainnet' },
      { id: 'd', label: 'Base' },
    ]),
    correctOptionId: 'b',
    explanation: 'TREE is a Sui-native utility ecosystem.',
  },
  {
    id: 'nftree-access',
    prompt: 'What is the primary role of an NFTree in the ecosystem?',
    options: Object.freeze([
      { id: 'a', label: 'Access to holder rewards, games, identity, and future utilities' },
      { id: 'b', label: 'A replacement for the TREE token' },
      { id: 'c', label: 'A guaranteed investment return' },
      { id: 'd', label: 'A Sui validator license' },
    ]),
    correctOptionId: 'a',
    explanation: 'NFTree is the ecosystem access asset for rewards, games, identity, and future utility.',
  },
  {
    id: 'treedrop',
    prompt: 'What does TreeDrop provide?',
    options: Object.freeze([
      { id: 'a', label: 'Automatic token trading' },
      { id: 'b', label: 'NFTree holder reward checks and protected distribution rounds' },
      { id: 'c', label: 'A centralized exchange account' },
      { id: 'd', label: 'A random NFT mint' },
    ]),
    correctOptionId: 'b',
    explanation: 'TreeDrop lets eligible NFTrees claim configured rewards once per applicable round.',
  },
  {
    id: 'canopy-board',
    prompt: 'What does the verified Canopy Board rank?',
    options: Object.freeze([
      { id: 'a', label: 'Only social-media followers' },
      { id: 'b', label: 'Only NFT artwork rarity' },
      { id: 'c', label: 'Liquid TREE plus verified TREE principal in supported LP positions' },
      { id: 'd', label: 'Wallet age on Sui' },
    ]),
    correctOptionId: 'c',
    explanation: 'The board combines liquid TREE with verified principal from supported liquidity positions.',
  },
  {
    id: 'liquidity-venues',
    prompt: 'Which venues are recognized for TREE liquidity in the Command Center?',
    options: Object.freeze([
      { id: 'a', label: 'SuiDex V2, SuiDex V3, Turbos, and Cetus' },
      { id: 'b', label: 'Uniswap and Curve only' },
      { id: 'c', label: 'Coinbase and Kraken only' },
      { id: 'd', label: 'No liquidity venues are recognized' },
    ]),
    correctOptionId: 'a',
    explanation: 'The verified TREE liquidity view combines SuiDex V2, SuiDex V3, Turbos, and Cetus.',
  },
  {
    id: 'burned-tree',
    prompt: 'How does the site define burned TREE?',
    options: Object.freeze([
      { id: 'a', label: 'TREE held by any exchange wallet' },
      { id: 'b', label: 'TREE temporarily locked in liquidity' },
      { id: 'c', label: 'TREE held by the Sui zero address' },
      { id: 'd', label: 'TREE moved between personal wallets' },
    ]),
    correctOptionId: 'c',
    explanation: 'TREE held by the Sui zero address is reported as burned.',
  },
  {
    id: 'nftree-mint',
    prompt: 'What is the published NFTree mint price?',
    options: Object.freeze([
      { id: 'a', label: '5 SUI' },
      { id: 'b', label: '10 SUI' },
      { id: 'c', label: '25 SUI' },
      { id: 'd', label: '100 SUI' },
    ]),
    correctOptionId: 'c',
    explanation: 'The current published NFTree mint price is 25 SUI.',
  },
  {
    id: 'coin-type',
    prompt: 'What should a user verify before approving a TREE transaction?',
    options: Object.freeze([
      { id: 'a', label: 'Only the ticker symbol' },
      { id: 'b', label: 'Only the token logo' },
      { id: 'c', label: 'The complete TREE coin type' },
      { id: 'd', label: 'The wallet color theme' },
    ]),
    correctOptionId: 'c',
    explanation: 'A name, symbol, or shortened address is not enough; verify the complete coin type.',
  },
  {
    id: 'v3-liquidity',
    prompt: 'What does the V3 section manage?',
    options: Object.freeze([
      { id: 'a', label: 'Concentrated SUI/TREE liquidity positions' },
      { id: 'b', label: 'Email subscriptions' },
      { id: 'c', label: 'NFT artwork generation' },
      { id: 'd', label: 'Sui validator voting' },
    ]),
    correctOptionId: 'a',
    explanation: 'V3 is the concentrated-liquidity workspace for verified SUI/TREE positions.',
  },
  {
    id: 'tree-fund',
    prompt: 'What share of NFTree sales is donated to supported causes such as TREE Fund and Saluting Branches?',
    options: Object.freeze([
      { id: 'a', label: '1%' },
      { id: 'b', label: '5%' },
      { id: 'c', label: '25%' },
      { id: 'd', label: '50%' },
    ]),
    correctOptionId: 'b',
    explanation: 'Five percent of NFTree sales is donated to supported causes such as TREE Fund and Saluting Branches.',
  },
  {
    id: 'root-token',
    prompt: 'Which asset is described as the root token of the TREE ecosystem?',
    options: Object.freeze([
      { id: 'a', label: 'TREE' },
      { id: 'b', label: 'NFTree' },
      { id: 'c', label: 'SUI' },
      { id: 'd', label: 'wBTC' },
    ]),
    correctOptionId: 'a',
    explanation: 'TREE is the root token connecting the ecosystem utilities.',
  },
  {
    id: 'swap-routing',
    prompt: 'What is the TREE swap router designed to compare?',
    options: Object.freeze([
      { id: 'a', label: 'Only centralized exchanges' },
      { id: 'b', label: 'Verified TREE routes across SuiDex V2, SuiDex V3, Turbos, and Cetus' },
      { id: 'c', label: 'Only NFT marketplaces' },
      { id: 'd', label: 'Validator commission rates' },
    ]),
    correctOptionId: 'b',
    explanation: 'The swap interface compares supported SuiDex V2, SuiDex V3, Turbos, and Cetus routes for TREE.',
  },
  {
    id: 'v2-location',
    prompt: 'Where are SUI/TREE V2 liquidity positions managed in the Command Center?',
    options: Object.freeze([
      { id: 'a', label: 'Earn' },
      { id: 'b', label: 'Burn' },
      { id: 'c', label: 'Canopy' },
      { id: 'd', label: 'Docs' },
    ]),
    correctOptionId: 'a',
    explanation: 'The Earn section contains the SUI/TREE V2 position and reward tools.',
  },
  {
    id: 'v3-location',
    prompt: 'Where are concentrated SUI/TREE liquidity positions managed?',
    options: Object.freeze([
      { id: 'a', label: 'The V3 section' },
      { id: 'b', label: 'The Burn section' },
      { id: 'c', label: 'The Canopy badge guide' },
      { id: 'd', label: 'The homepage footer' },
    ]),
    correctOptionId: 'a',
    explanation: 'Concentrated SUI/TREE positions are managed in the dedicated V3 section.',
  },
  {
    id: 'limit-cancel',
    prompt: 'What can a user do with an open supported limit order?',
    options: Object.freeze([
      { id: 'a', label: 'Cancel it before it fills' },
      { id: 'b', label: 'Convert it into an NFTree' },
      { id: 'c', label: 'Use it as a validator vote' },
      { id: 'd', label: 'Erase it from Sui history' },
    ]),
    correctOptionId: 'a',
    explanation: 'Supported open limit orders can be reviewed and cancelled before execution.',
  },
  {
    id: 'supported-wallets',
    prompt: 'Which group contains supported Sui wallets shown by the TREE app?',
    options: Object.freeze([
      { id: 'a', label: 'Slush, Phantom, and Nightly' },
      { id: 'b', label: 'MetaMask only' },
      { id: 'c', label: 'Bitcoin Core only' },
      { id: 'd', label: 'No external wallets' },
    ]),
    correctOptionId: 'a',
    explanation: 'The wallet selector supports Sui wallets including Slush, Phantom, and Nightly.',
  },
  {
    id: 'victory-v2',
    prompt: 'Which incentive token is emitted by the supported SUI/TREE V2 position?',
    options: Object.freeze([
      { id: 'a', label: 'VICTORY' },
      { id: 'b', label: 'ETH' },
      { id: 'c', label: 'DOGE' },
      { id: 'd', label: 'USDC only' },
    ]),
    correctOptionId: 'a',
    explanation: 'The supported SUI/TREE V2 position includes VICTORY incentives.',
  },
  {
    id: 'v3-claim-all',
    prompt: 'What is the V3 Claim All action intended to collect?',
    options: Object.freeze([
      { id: 'a', label: 'Available position fees and rewards' },
      { id: 'b', label: 'Only wallet gas rebates' },
      { id: 'c', label: 'NFT artwork files' },
      { id: 'd', label: 'Leaderboard badges' },
    ]),
    correctOptionId: 'a',
    explanation: 'Claim All combines the available trading-fee and incentive-reward claims for a V3 position.',
  },
  {
    id: 'v3-close',
    prompt: 'What is the guarded V3 Close action designed to do?',
    options: Object.freeze([
      { id: 'a', label: 'Withdraw the position assets and collect available fees and rewards' },
      { id: 'b', label: 'Delete the connected wallet' },
      { id: 'c', label: 'Burn every token in the wallet' },
      { id: 'd', label: 'Transfer the NFTree collection' },
    ]),
    correctOptionId: 'a',
    explanation: 'Closing a V3 position withdraws its assets and collects what is available from that position.',
  },
  {
    id: 'victory-reinvest',
    prompt: 'What does a full VICTORY reinvest do?',
    options: Object.freeze([
      { id: 'a', label: 'Uses VICTORY toward TREE liquidity reinvestment' },
      { id: 'b', label: 'Mints an unrelated NFT' },
      { id: 'c', label: 'Changes the wallet address' },
      { id: 'd', label: 'Removes TREE from circulation automatically' },
    ]),
    correctOptionId: 'a',
    explanation: 'The full reinvest workflow uses VICTORY toward TREE and the selected liquidity destination.',
  },
  {
    id: 'sustainable-reinvest',
    prompt: 'How does the sustainable VICTORY reinvest differ from a full reinvest?',
    options: Object.freeze([
      { id: 'a', label: 'It divides the selected VICTORY between reinvestment and locking' },
      { id: 'b', label: 'It guarantees a fixed return' },
      { id: 'c', label: 'It sends every token to an exchange' },
      { id: 'd', label: 'It skips wallet approval' },
    ]),
    correctOptionId: 'a',
    explanation: 'The sustainable path divides the selected VICTORY between TREE reinvestment and a VICTORY lock.',
  },
  {
    id: 'stats-purpose',
    prompt: 'What is the purpose of the TREE Stats section?',
    options: Object.freeze([
      { id: 'a', label: 'Show verified TREE market, liquidity, volume, and ecosystem data' },
      { id: 'b', label: 'Store wallet recovery phrases' },
      { id: 'c', label: 'Create email accounts' },
      { id: 'd', label: 'Run a validator node in the browser' },
    ]),
    correctOptionId: 'a',
    explanation: 'Stats consolidates verified TREE market and ecosystem information.',
  },
  {
    id: 'canopy-size',
    prompt: 'How many ranked wallets are displayed on the verified Canopy Board?',
    options: Object.freeze([
      { id: 'a', label: '10' },
      { id: 'b', label: '25' },
      { id: 'c', label: '50' },
      { id: 'd', label: '1,000' },
    ]),
    correctOptionId: 'c',
    explanation: 'The Canopy Board is the verified Top 50 TREE leaderboard.',
  },
  {
    id: 'canopy-badges',
    prompt: 'What do badges beside a Canopy wallet represent?',
    options: Object.freeze([
      { id: 'a', label: 'Verified ecosystem milestones or recent wallet behavior' },
      { id: 'b', label: 'Guaranteed future profits' },
      { id: 'c', label: 'The wallet password strength' },
      { id: 'd', label: 'A centralized exchange rating' },
    ]),
    correctOptionId: 'a',
    explanation: 'Canopy badges identify defined ecosystem milestones or qualifying recent behavior.',
  },
  {
    id: 'arcade-access',
    prompt: 'What serves as the access key for TREE ecosystem games?',
    options: Object.freeze([
      { id: 'a', label: 'An NFTree' },
      { id: 'b', label: 'An email subscription' },
      { id: 'c', label: 'A centralized exchange account' },
      { id: 'd', label: 'A paper wallet printout' },
    ]),
    correctOptionId: 'a',
    explanation: 'Holding an NFTree provides access to TREE ecosystem game utilities.',
  },
  {
    id: 'arcade-games',
    prompt: 'Which group contains TREE Arcade projects?',
    options: Object.freeze([
      { id: 'a', label: 'Garden Battles, Arboretum, and TREE FORCE ’89' },
      { id: 'b', label: 'Fortnite, Roblox, and Minecraft' },
      { id: 'c', label: 'Uniswap, Curve, and Aave' },
      { id: 'd', label: 'No games are planned' },
    ]),
    correctOptionId: 'a',
    explanation: 'The TREE Arcade presents Garden Battles, Arboretum, TREE FORCE ’89, and future ecosystem games.',
  },
  {
    id: 'qualifying-minimum',
    prompt: 'What is the minimum TREE purchase required to unlock one daily Knowledge Trial attempt?',
    options: Object.freeze([
      { id: 'a', label: '$1' },
      { id: 'b', label: '$5' },
      { id: 'c', label: '$25' },
      { id: 'd', label: '$100' },
    ]),
    correctOptionId: 'b',
    explanation: 'A verified purchase worth at least five US dollars unlocks one attempt for that round.',
  },
  {
    id: 'qualification-direction',
    prompt: 'Which trade direction qualifies for Knowledge Trial access?',
    options: Object.freeze([
      { id: 'a', label: 'A supported SUI-to-TREE purchase' },
      { id: 'b', label: 'Selling TREE for SUI' },
      { id: 'c', label: 'Moving TREE between personal wallets' },
      { id: 'd', label: 'Claiming an NFT reward' },
    ]),
    correctOptionId: 'a',
    explanation: 'Eligibility requires a verified supported purchase of TREE using SUI.',
  },
  {
    id: 'one-attempt',
    prompt: 'How many scored Knowledge Trial attempts can one wallet use in a daily round?',
    options: Object.freeze([
      { id: 'a', label: 'One' },
      { id: 'b', label: 'Three' },
      { id: 'c', label: 'One per purchase' },
      { id: 'd', label: 'Unlimited' },
    ]),
    correctOptionId: 'a',
    explanation: 'One qualifying wallet can use one scored attempt in each daily round.',
  },
  {
    id: 'purchase-multiplicity',
    prompt: 'Do additional qualifying purchases create extra Knowledge Trial attempts in the same round?',
    options: Object.freeze([
      { id: 'a', label: 'No, the wallet still receives one attempt' },
      { id: 'b', label: 'Yes, every purchase creates ten attempts' },
      { id: 'c', label: 'Only if the wallet changes its name' },
      { id: 'd', label: 'Only on centralized exchanges' },
    ]),
    correctOptionId: 'a',
    explanation: 'Extra purchases do not create extra scored attempts for the same wallet and round.',
  },
  {
    id: 'trial-length',
    prompt: 'How many questions are in the daily TREE Knowledge Trial?',
    options: Object.freeze([
      { id: 'a', label: 'Three' },
      { id: 'b', label: 'Five' },
      { id: 'c', label: 'Ten' },
      { id: 'd', label: 'Twenty-five' },
    ]),
    correctOptionId: 'a',
    explanation: 'The daily skill challenge contains three questions.',
  },
  {
    id: 'trial-timer',
    prompt: 'How much time is allowed for the three-question daily Knowledge Trial?',
    options: Object.freeze([
      { id: 'a', label: '30 seconds' },
      { id: 'b', label: '90 seconds' },
      { id: 'c', label: '10 minutes' },
      { id: 'd', label: 'There is no time limit' },
    ]),
    correctOptionId: 'b',
    explanation: 'Each daily three-question attempt has a 90-second limit.',
  },
  {
    id: 'scoring-primary',
    prompt: 'What is the primary ranking factor in the Knowledge Trial?',
    options: Object.freeze([
      { id: 'a', label: 'Number of correct answers' },
      { id: 'b', label: 'Wallet balance' },
      { id: 'c', label: 'Number of purchases' },
      { id: 'd', label: 'NFT artwork rarity' },
    ]),
    correctOptionId: 'a',
    explanation: 'Accuracy ranks first in the Knowledge Trial.',
  },
  {
    id: 'scoring-secondary',
    prompt: 'When two participants have the same score, what ranks them next?',
    options: Object.freeze([
      { id: 'a', label: 'Verified completion time' },
      { id: 'b', label: 'Wallet balance' },
      { id: 'c', label: 'Social-media followers' },
      { id: 'd', label: 'A random coin flip' },
    ]),
    correctOptionId: 'a',
    explanation: 'Faster verified completion time ranks equal scores.',
  },
  {
    id: 'exact-tie',
    prompt: 'How is an exact tie for the leading Knowledge Trial result resolved?',
    options: Object.freeze([
      { id: 'a', label: 'A private sudden-death question' },
      { id: 'b', label: 'The larger wallet wins' },
      { id: 'c', label: 'The prize is always cancelled' },
      { id: 'd', label: 'A random drawing' },
    ]),
    correctOptionId: 'a',
    explanation: 'Exactly tied leaders advance to a private sudden-death question.',
  },
  {
    id: 'daily-prize',
    prompt: 'What is the planned prize for the single daily Knowledge Trial winner?',
    options: Object.freeze([
      { id: 'a', label: '50,000 TREE' },
      { id: 'b', label: 'A guaranteed NFTree mint' },
      { id: 'c', label: 'One validator node' },
      { id: 'd', label: 'No prize' },
    ]),
    correctOptionId: 'a',
    explanation: 'The planned daily skill prize is 50,000 TREE for one winner.',
  },
  {
    id: 'wallet-signature',
    prompt: 'What does the Knowledge Trial wallet-ownership signature authorize?',
    options: Object.freeze([
      { id: 'a', label: 'Proof that the participant controls the qualifying wallet' },
      { id: 'b', label: 'An automatic transfer of every wallet asset' },
      { id: 'c', label: 'A new validator account' },
      { id: 'd', label: 'A token sale' },
    ]),
    correctOptionId: 'a',
    explanation: 'The signed personal message proves wallet control and does not authorize a fund transfer.',
  },
  {
    id: 'winner-claim-wallet',
    prompt: 'Which wallet must claim a Knowledge Trial prize?',
    options: Object.freeze([
      { id: 'a', label: 'The verified winning wallet' },
      { id: 'b', label: 'Any wallet that visits the site' },
      { id: 'c', label: 'A centralized exchange deposit wallet' },
      { id: 'd', label: 'The fastest wallet to connect after the round' },
    ]),
    correctOptionId: 'a',
    explanation: 'Only the verified winning wallet can claim its awarded prize.',
  },
  {
    id: 'practice-mode',
    prompt: 'Does completing a practice trial consume a qualifying daily attempt?',
    options: Object.freeze([
      { id: 'a', label: 'No' },
      { id: 'b', label: 'Yes, always' },
      { id: 'c', label: 'Only when all answers are correct' },
      { id: 'd', label: 'Only on mobile' },
    ]),
    correctOptionId: 'a',
    explanation: 'Practice mode does not consume a pass, affect the leaderboard, or award a prize.',
  },
  {
    id: 'sui-gas',
    prompt: 'Which token pays network gas for TREE app transactions on Sui?',
    options: Object.freeze([
      { id: 'a', label: 'SUI' },
      { id: 'b', label: 'TREE only' },
      { id: 'c', label: 'BTC' },
      { id: 'd', label: 'ETH' },
    ]),
    correctOptionId: 'a',
    explanation: 'SUI is the native gas token used for transactions on the Sui network.',
  },
  {
    id: 'safe-simulation',
    prompt: 'Why does the Command Center simulate supported transactions before wallet approval?',
    options: Object.freeze([
      { id: 'a', label: 'To check whether the transaction is expected to succeed safely' },
      { id: 'b', label: 'To reveal the wallet recovery phrase' },
      { id: 'c', label: 'To guarantee investment profit' },
      { id: 'd', label: 'To bypass the connected wallet' },
    ]),
    correctOptionId: 'a',
    explanation: 'Simulation checks the prepared transaction before the user is asked for wallet approval.',
  },
  {
    id: 'purchase-window',
    prompt: 'When must a qualifying TREE purchase occur for a daily Knowledge Trial round?',
    options: Object.freeze([
      { id: 'a', label: 'Inside that round’s published purchase window' },
      { id: 'b', label: 'At any time in the project’s history' },
      { id: 'c', label: 'Only after the winner is announced' },
      { id: 'd', label: 'Only during a centralized exchange listing' },
    ]),
    correctOptionId: 'a',
    explanation: 'The verified purchase must finalize inside the applicable round window.',
  },
  {
    id: 'one-daily-winner',
    prompt: 'How many winners are selected from a completed daily Knowledge Trial round?',
    options: Object.freeze([
      { id: 'a', label: 'One' },
      { id: 'b', label: 'Every qualifying buyer' },
      { id: 'c', label: 'Fifty' },
      { id: 'd', label: 'None' },
    ]),
    correctOptionId: 'a',
    explanation: 'The daily trial produces one skill-ranked winner.',
  },
  {
    id: 'suidex-v2-v3-difference',
    prompt: 'What is the main liquidity difference between SuiDex V2 and SuiDex V3?',
    options: Object.freeze([
      { id: 'a', label: 'V3 can concentrate liquidity inside chosen price ranges, while V2 uses a full-range pool model' },
      { id: 'b', label: 'V2 supports only NFTs, while V3 supports only stablecoins' },
      { id: 'c', label: 'V2 runs on Bitcoin, while V3 runs on Ethereum' },
      { id: 'd', label: 'There is no difference in how liquidity is positioned' },
    ]),
    correctOptionId: 'a',
    explanation: 'SuiDex V3 lets providers choose concentrated price ranges; V2 liquidity follows the pool’s full-range model.',
  },
  {
    id: 'suidex-route-output',
    prompt: 'When the TREE swap compares routes for the same input, which result matters most?',
    options: Object.freeze([
      { id: 'a', label: 'The highest protected executable output after route costs' },
      { id: 'b', label: 'The venue with the largest logo' },
      { id: 'c', label: 'The pool with the highest advertised APR' },
      { id: 'd', label: 'The route listed first alphabetically' },
    ]),
    correctOptionId: 'a',
    explanation: 'Best-route selection should compare the protected amount the wallet can actually receive for the entered trade.',
  },
  {
    id: 'suidex-wallet-review',
    prompt: 'What should a user review before approving a SuiDex swap in a wallet?',
    options: Object.freeze([
      { id: 'a', label: 'Trade direction, input amount, expected output, and minimum received' },
      { id: 'b', label: 'Only the color of the confirmation button' },
      { id: 'c', label: 'Only the token ticker shown on social media' },
      { id: 'd', label: 'Nothing, because every wallet request is automatically safe' },
    ]),
    correctOptionId: 'a',
    explanation: 'Review the assets, amounts, and protected minimum before signing any swap transaction.',
  },
  {
    id: 'suidex-slippage',
    prompt: 'What does a swap slippage setting control?',
    options: Object.freeze([
      { id: 'a', label: 'How much execution movement the user will accept before the swap should fail' },
      { id: 'b', label: 'How many wallet accounts can connect at once' },
      { id: 'c', label: 'How long a token has existed' },
      { id: 'd', label: 'The number of validators on Sui' },
    ]),
    correctOptionId: 'a',
    explanation: 'Slippage tolerance limits how far execution may move from the quoted result before protection rejects the trade.',
  },
  {
    id: 'suidex-price-impact',
    prompt: 'What most directly increases price impact on a SuiDex pool?',
    options: Object.freeze([
      { id: 'a', label: 'A trade that is large relative to the pool’s available liquidity' },
      { id: 'b', label: 'Changing the wallet theme' },
      { id: 'c', label: 'Viewing the Stats tab' },
      { id: 'd', label: 'Holding an unrelated NFT' },
    ]),
    correctOptionId: 'a',
    explanation: 'Trades consume pool liquidity, so a larger trade relative to available depth generally moves the execution price more.',
  },
  {
    id: 'suidex-fee-source',
    prompt: 'Where do liquidity-provider trading fees generally come from?',
    options: Object.freeze([
      { id: 'a', label: 'Fees paid by swaps that use the pool' },
      { id: 'b', label: 'Guaranteed payments from the Sui network' },
      { id: 'c', label: 'Wallet connection fees' },
      { id: 'd', label: 'Automatic NFT sales' },
    ]),
    correctOptionId: 'a',
    explanation: 'A portion of swap fees is allocated to eligible liquidity positions according to the pool’s rules.',
  },
  {
    id: 'suidex-v3-in-range',
    prompt: 'When is a SuiDex V3 position in range?',
    options: Object.freeze([
      { id: 'a', label: 'When the current pool price is between the position’s selected lower and upper prices' },
      { id: 'b', label: 'Whenever the wallet is connected' },
      { id: 'c', label: 'Only when SUI has risen during the last 24 hours' },
      { id: 'd', label: 'Whenever the position contains equal token counts' },
    ]),
    correctOptionId: 'a',
    explanation: 'A concentrated-liquidity position is in range while the current pool price sits inside its chosen bounds.',
  },
  {
    id: 'suidex-liquidity-risk',
    prompt: 'What risk can make a liquidity position perform differently from simply holding both tokens?',
    options: Object.freeze([
      { id: 'a', label: 'Relative token-price movement can change the position’s token mix and value' },
      { id: 'b', label: 'The wallet automatically reveals its recovery phrase' },
      { id: 'c', label: 'The blockchain deletes every position after one day' },
      { id: 'd', label: 'Every liquidity position guarantees a fixed return' },
    ]),
    correctOptionId: 'a',
    explanation: 'As relative prices move, an automated-market-maker position can hold a different token mix and underperform simple holding.',
  },
  {
    id: 'suidex-v3-zap',
    prompt: 'What is the purpose of the SuiDex V3 Zap workflow?',
    options: Object.freeze([
      { id: 'a', label: 'Create or increase a position from one token by preparing the needed token mix' },
      { id: 'b', label: 'Move every wallet asset to a centralized exchange' },
      { id: 'c', label: 'Remove all liquidity without wallet approval' },
      { id: 'd', label: 'Guarantee that a position always remains in range' },
    ]),
    correctOptionId: 'a',
    explanation: 'Zap simplifies liquidity entry by using one deposit token and preparing the pair needed for the selected V3 position.',
  },
]);

export const TREE_KNOWLEDGE_TRIAL_QUESTION_BANK_VERSION = 'tree-knowledge-bank-v3';

const ROTATION_POOLS = Object.freeze({
  easy: Object.freeze([
    'network', 'nftree-access', 'root-token', 'supported-wallets', 'arcade-access',
    'arcade-games', 'qualifying-minimum', 'trial-length', 'trial-timer', 'daily-prize',
    'one-daily-winner', 'practice-mode', 'sui-gas', 'tree-fund', 'nftree-mint',
    'suidex-v2-v3-difference', 'suidex-route-output', 'suidex-wallet-review',
  ]),
  medium: Object.freeze([
    'treedrop', 'liquidity-venues', 'burned-tree', 'coin-type', 'v3-liquidity',
    'swap-routing', 'v2-location', 'v3-location', 'limit-cancel', 'victory-v2',
    'stats-purpose', 'canopy-size', 'qualification-direction', 'winner-claim-wallet',
    'suidex-slippage', 'suidex-price-impact', 'suidex-fee-source',
  ]),
  hard: Object.freeze([
    'canopy-board', 'v3-claim-all', 'v3-close', 'victory-reinvest', 'sustainable-reinvest',
    'canopy-badges', 'one-attempt', 'purchase-multiplicity', 'scoring-primary',
    'scoring-secondary', 'exact-tie', 'wallet-signature', 'safe-simulation', 'purchase-window',
    'suidex-v3-in-range', 'suidex-liquidity-risk', 'suidex-v3-zap',
  ]),
});

function rotationDate(value: string) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) throw new Error('Invalid Knowledge Trial rotation date.');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Invalid Knowledge Trial rotation date.');
  }
  return parsed;
}

function stableQuestionHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function questionForRotation(id: string) {
  const question = TREE_KNOWLEDGE_TRIAL_QUESTION_BANK.find((candidate) => candidate.id === id);
  if (!question) throw new Error(`Knowledge Trial rotation references missing question ${id}.`);
  return question;
}

function shuffledForRound(question: TreeKnowledgeQuestion, roundDate: string): TreeKnowledgeQuestion {
  const options = [...question.options].sort((left, right) => {
    const delta = stableQuestionHash(`${roundDate}:${question.id}:${left.id}`)
      - stableQuestionHash(`${roundDate}:${question.id}:${right.id}`);
    return delta || left.id.localeCompare(right.id);
  });
  return { ...question, options };
}

function rotatingQuestion(pool: readonly string[], dayNumber: number, offset: number) {
  return questionForRotation(pool[(dayNumber + offset) % pool.length]);
}

export function rotatingTreeKnowledgeTrialRound(roundDate: string) {
  const date = rotationDate(roundDate);
  const dayNumber = Math.floor(date.getTime() / 86_400_000);
  const daily = [
    rotatingQuestion(ROTATION_POOLS.easy, dayNumber, 0),
    rotatingQuestion(ROTATION_POOLS.medium, dayNumber * 5, 0),
    rotatingQuestion(ROTATION_POOLS.hard, dayNumber * 9, 0),
  ].map((question) => shuffledForRound(question, roundDate));
  const tiebreak = [
    rotatingQuestion(ROTATION_POOLS.easy, dayNumber, 1),
    rotatingQuestion(ROTATION_POOLS.medium, dayNumber * 5, 1),
    rotatingQuestion(ROTATION_POOLS.hard, dayNumber * 9, 1),
  ].map((question) => shuffledForRound(question, `${roundDate}:tiebreak`));
  const dailyOffset = dayNumber % daily.length;
  const tiebreakOffset = (dayNumber + 1) % tiebreak.length;
  return Object.freeze({
    bankVersion: TREE_KNOWLEDGE_TRIAL_QUESTION_BANK_VERSION,
    questionSetVersion: `knowledge-${roundDate}-rotating-v3`,
    questions: [...daily.slice(dailyOffset), ...daily.slice(0, dailyOffset)],
    tiebreakQuestions: [...tiebreak.slice(tiebreakOffset), ...tiebreak.slice(0, tiebreakOffset)],
  });
}

const bankIds = TREE_KNOWLEDGE_TRIAL_QUESTION_BANK.map(({ id }) => id);
const rotationIds = [...ROTATION_POOLS.easy, ...ROTATION_POOLS.medium, ...ROTATION_POOLS.hard];
if (new Set(bankIds).size !== bankIds.length || new Set(rotationIds).size !== rotationIds.length
    || bankIds.some((id) => !rotationIds.includes(id)) || rotationIds.some((id) => !bankIds.includes(id))) {
  throw new Error('The TREE Knowledge Trial rotation pools must cover the private question bank exactly once.');
}

export const TREE_KNOWLEDGE_TRIAL_QUESTIONS: readonly TreeKnowledgeQuestion[] = Object.freeze(
  TREE_KNOWLEDGE_TRIAL_QUESTION_BANK.slice(0, TREE_KNOWLEDGE_TRIAL_QUESTION_COUNT),
);

if (TREE_KNOWLEDGE_TRIAL_QUESTIONS.length !== TREE_KNOWLEDGE_TRIAL_QUESTION_COUNT) {
  throw new Error('The TREE Knowledge Trial question count does not match its published rules.');
}

export function validateTreeKnowledgeQuestionSet(
  value: unknown,
  expectedCount = TREE_KNOWLEDGE_TRIAL_QUESTION_COUNT,
): TreeKnowledgeQuestion[] {
  if (!Array.isArray(value) || value.length !== expectedCount) {
    throw new Error('The Knowledge Trial question set has an invalid question count.');
  }
  const ids = new Set<string>();
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('A Knowledge Trial question is invalid.');
    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' && /^[a-z0-9][a-z0-9-]{1,63}$/.test(row.id) ? row.id : null;
    const prompt = typeof row.prompt === 'string' && row.prompt.trim().length >= 8 && row.prompt.length <= 500
      ? row.prompt.trim() : null;
    if (!id || ids.has(id) || !prompt || !Array.isArray(row.options) || row.options.length < 2 || row.options.length > 6) {
      throw new Error('A Knowledge Trial question is invalid.');
    }
    ids.add(id);
    const optionIds = new Set<string>();
    const options = row.options.map((option) => {
      if (!option || typeof option !== 'object' || Array.isArray(option)) throw new Error('A Knowledge Trial option is invalid.');
      const candidate = option as Record<string, unknown>;
      const optionId = typeof candidate.id === 'string' && /^[a-z0-9]{1,8}$/.test(candidate.id) ? candidate.id : null;
      const label = typeof candidate.label === 'string' && candidate.label.trim().length >= 1 && candidate.label.length <= 300
        ? candidate.label.trim() : null;
      if (!optionId || optionIds.has(optionId) || !label) throw new Error('A Knowledge Trial option is invalid.');
      optionIds.add(optionId);
      return { id: optionId, label };
    });
    const correctOptionId = typeof row.correctOptionId === 'string' && optionIds.has(row.correctOptionId)
      ? row.correctOptionId : null;
    const explanation = typeof row.explanation === 'string' && row.explanation.trim().length >= 3 && row.explanation.length <= 1_000
      ? row.explanation.trim() : null;
    if (!correctOptionId || !explanation) throw new Error('A Knowledge Trial answer key is invalid.');
    return { id, prompt, options, correctOptionId, explanation };
  });
}

export function publicTreeKnowledgeQuestions(
  questions: readonly TreeKnowledgeQuestion[] = TREE_KNOWLEDGE_TRIAL_QUESTIONS,
): PublicTreeKnowledgeQuestion[] {
  return questions.map(({ id, prompt, options }) => ({ id, prompt, options }));
}

function validElapsedMs(value: unknown): number {
  const elapsedMs = Number(value);
  if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0 || elapsedMs > 3_600_000) {
    throw new Error('Elapsed time must be a non-negative whole number of milliseconds.');
  }
  return elapsedMs;
}

export function scoreTreeKnowledgeTrialAgainst(
  questions: readonly TreeKnowledgeQuestion[],
  rawAnswers: readonly TreeKnowledgeAnswer[],
  rawElapsedMs: number,
): TreeKnowledgeScore {
  if (!Array.isArray(rawAnswers) || rawAnswers.length > questions.length) {
    throw new Error('Knowledge Trial answers are invalid.');
  }
  const elapsedMs = validElapsedMs(rawElapsedMs);
  const submitted = new Map<string, string>();
  for (const answer of rawAnswers) {
    if (!answer || typeof answer.questionId !== 'string' || typeof answer.optionId !== 'string') {
      throw new Error('Every Knowledge Trial answer must identify a question and option.');
    }
    const question = questions.find(({ id }) => id === answer.questionId);
    if (!question || !question.options.some(({ id }) => id === answer.optionId)) {
      throw new Error('A Knowledge Trial answer references an unknown question or option.');
    }
    if (submitted.has(answer.questionId)) throw new Error('A Knowledge Trial question was answered more than once.');
    submitted.set(answer.questionId, answer.optionId);
  }
  const answers = questions.map((question) => {
    const optionId = submitted.get(question.id) ?? null;
    return {
      questionId: question.id,
      optionId,
      correct: optionId === question.correctOptionId,
      correctOptionId: question.correctOptionId,
      explanation: question.explanation,
    };
  });
  const correctCount = answers.filter(({ correct }) => correct).length;
  return {
    correctCount,
    totalQuestions: questions.length,
    percentage: Math.round(correctCount * 10_000 / questions.length) / 100,
    elapsedMs,
    elapsedSeconds: Math.round(elapsedMs / 100) / 10,
    timedOut: elapsedMs > TREE_KNOWLEDGE_TRIAL_DURATION_SECONDS * 1_000,
    answers,
  };
}

export function scoreTreeKnowledgeTrial(
  rawAnswers: readonly TreeKnowledgeAnswer[],
  rawElapsedMs: number,
): TreeKnowledgeScore {
  return scoreTreeKnowledgeTrialAgainst(TREE_KNOWLEDGE_TRIAL_QUESTIONS, rawAnswers, rawElapsedMs);
}

export function compareTreeKnowledgeScores(
  left: Pick<TreeKnowledgeScore, 'correctCount' | 'elapsedMs'>,
  right: Pick<TreeKnowledgeScore, 'correctCount' | 'elapsedMs'>,
): number {
  if (left.correctCount !== right.correctCount) return right.correctCount - left.correctCount;
  return left.elapsedMs - right.elapsedMs;
}

export function rankTreeKnowledgeScores<T extends Pick<TreeKnowledgeScore, 'correctCount' | 'elapsedMs'>>(
  submissions: readonly T[],
): Array<T & { rank: number; exactTie: boolean }> {
  const sorted = [...submissions].sort(compareTreeKnowledgeScores);
  let currentRank = 0;
  return sorted.map((submission, index) => {
    const previous = sorted[index - 1];
    if (!previous || compareTreeKnowledgeScores(previous, submission) !== 0) currentRank = index + 1;
    const exactTie = sorted.some((candidate) => candidate !== submission && compareTreeKnowledgeScores(candidate, submission) === 0);
    return { ...submission, rank: currentRank, exactTie };
  });
}

export function resolveTreeKnowledgeDailyWinner<
  T extends Pick<TreeKnowledgeScore, 'correctCount' | 'elapsedMs'> & { wallet: string },
>(submissions: readonly T[]) {
  const ranked = rankTreeKnowledgeScores(submissions);
  if (!ranked.length) return { outcome: 'no-entries' as const, winner: null, tiedWallets: [] as string[], ranked };
  const leaders = ranked.filter(({ rank }) => rank === 1);
  if (leaders.length === 1) {
    return { outcome: 'winner' as const, winner: leaders[0], tiedWallets: [] as string[], ranked };
  }
  return {
    outcome: 'sudden-death-required' as const,
    winner: null,
    tiedWallets: leaders.map(({ wallet }) => wallet).sort(),
    ranked,
  };
}

export function treeKnowledgeTrialStatus(env: Record<string, string | undefined> = process.env) {
  const legalApproved = env.TREE_KNOWLEDGE_TRIAL_LEGAL_APPROVED === 'true';
  const databaseReady = env.TREE_KNOWLEDGE_TRIAL_DATABASE_READY === 'true';
  const questionSetReady = env.TREE_KNOWLEDGE_TRIAL_QUESTION_SET_READY === 'true';
  const prizeSettlementReady = env.TREE_KNOWLEDGE_TRIAL_PRIZE_SETTLEMENT_READY === 'true';
  const claimsEnabled = env.TREE_KNOWLEDGE_TRIAL_CLAIMS_ENABLED === 'true' && prizeSettlementReady;
  const requestedEnabled = env.TREE_KNOWLEDGE_TRIAL_ENABLED === 'true';
  return {
    version: TREE_KNOWLEDGE_TRIAL_VERSION,
    questionSetVersion: TREE_KNOWLEDGE_TRIAL_QUESTION_SET,
    publicAttemptsEnabled: requestedEnabled && legalApproved && databaseReady && questionSetReady && prizeSettlementReady,
    claimsEnabled,
    practiceEnabled: true,
    durationSeconds: TREE_KNOWLEDGE_TRIAL_DURATION_SECONDS,
    questionCount: TREE_KNOWLEDGE_TRIAL_QUESTION_COUNT,
    minimumQualifyingUsdCents: TREE_KNOWLEDGE_TRIAL_MINIMUM_USD_CENTS,
    scoring: Object.freeze({ primary: 'correct-answers', secondary: 'elapsed-time', exactTie: 'sudden-death' }),
    activation: { requestedEnabled, legalApproved, databaseReady, questionSetReady, prizeSettlementReady },
  };
}
