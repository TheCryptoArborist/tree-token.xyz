export const TREE_KNOWLEDGE_TRIAL_VERSION = 'tree-knowledge-trial-v1';
export const TREE_KNOWLEDGE_TRIAL_QUESTION_SET = 'tree-ecosystem-foundations-v1';
export const TREE_KNOWLEDGE_TRIAL_DURATION_SECONDS = 180;
export const TREE_KNOWLEDGE_TRIAL_QUESTION_COUNT = 5;
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

const TREE_KNOWLEDGE_TRIAL_QUESTION_BANK: readonly TreeKnowledgeQuestion[] = Object.freeze([
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
      { id: 'a', label: 'SuiDex V2, SuiDex V3, and Turbos' },
      { id: 'b', label: 'Uniswap and Curve only' },
      { id: 'c', label: 'Coinbase and Kraken only' },
      { id: 'd', label: 'No liquidity venues are recognized' },
    ]),
    correctOptionId: 'a',
    explanation: 'The verified liquidity view covers SuiDex V2, SuiDex V3, and Turbos.',
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
    prompt: 'What share of NFTree sale proceeds is allocated to TREE Fund?',
    options: Object.freeze([
      { id: 'a', label: '1%' },
      { id: 'b', label: '5%' },
      { id: 'c', label: '25%' },
      { id: 'd', label: '50%' },
    ]),
    correctOptionId: 'b',
    explanation: 'Five percent of NFTree sale proceeds is allocated to TREE Fund.',
  },
]);

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
