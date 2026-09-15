export type TreeKnowledgeTrialSupabaseConfig = {
  url: string;
  secretKey: string;
};

export type TreeKnowledgeTrialChallenge = {
  challengeId: string;
  roundId: string;
  wallet: string;
  qualifyingTxDigest: string;
  message: string;
  expiresAt: string;
  consumed: boolean;
};

export type TreeKnowledgeTrialAttemptContext = {
  attemptId: string;
  roundId: string;
  wallet: string;
  questionSetVersion: string;
  startedAt: string;
  expiresAt: string;
  submitted: boolean;
};

export type TreeKnowledgeTrialTiebreakChallenge = {
  challengeId: string;
  roundId: string;
  wallet: string;
  stage: number;
  message: string;
  expiresAt: string;
  consumed: boolean;
};

export type TreeKnowledgeTrialTiebreakAttemptContext = {
  attemptId: string;
  roundId: string;
  wallet: string;
  stage: number;
  startedAt: string;
  expiresAt: string;
  submitted: boolean;
};

export type TreeKnowledgeTrialEligibility = {
  roundId: string;
  wallet: string;
  eligible: boolean;
  status: 'not-eligible' | 'eligible' | 'pass-issued' | 'attempt-started' | 'completed';
  minimumQualifyingUsdCents: number;
  qualifyingUsdCents: number | null;
  verifiedAt: string | null;
  passIssued: boolean;
  attemptStarted: boolean;
  attemptCompleted: boolean;
};

type Environment = Record<string, string | undefined>;
type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function required(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${label} is not configured.`);
  return normalized;
}

export function treeKnowledgeTrialSupabaseConfig(env: Environment): TreeKnowledgeTrialSupabaseConfig {
  // Knowledge Trial qualification and round data live beside the verified-buy
  // ledger. Prefer that actively used credential so an obsolete dedicated
  // override cannot silently disconnect the public challenge.
  const rawUrl = env.TREE_RAFFLE_SUPABASE_URL || env.TREE_KNOWLEDGE_TRIAL_SUPABASE_URL;
  const rawKey = env.TREE_RAFFLE_SUPABASE_SECRET_KEY || env.TREE_KNOWLEDGE_TRIAL_SUPABASE_SECRET_KEY;
  const url = required(rawUrl, 'TREE_KNOWLEDGE_TRIAL_SUPABASE_URL');
  const secretKey = required(rawKey, 'TREE_KNOWLEDGE_TRIAL_SUPABASE_SECRET_KEY');
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('TREE_KNOWLEDGE_TRIAL_SUPABASE_URL must be a valid HTTPS URL.');
  }
  if (parsed.protocol !== 'https:') throw new Error('TREE_KNOWLEDGE_TRIAL_SUPABASE_URL must use HTTPS.');
  return { url: parsed.origin, secretKey };
}

function text(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Supabase returned an invalid ${label}.`);
  return value;
}

function boolean(value: unknown, label: string) {
  if (typeof value !== 'boolean') throw new Error(`Supabase returned an invalid ${label}.`);
  return value;
}

function integer(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`Supabase returned an invalid ${label}.`);
  return parsed;
}

function nonnegativeInteger(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`Supabase returned an invalid ${label}.`);
  return parsed;
}

function parseEligibility(value: unknown): TreeKnowledgeTrialEligibility {
  const row = record(value);
  const status = String(row.status || '');
  if (!['not-eligible', 'eligible', 'pass-issued', 'attempt-started', 'completed'].includes(status)) {
    throw new Error('Supabase returned an invalid Knowledge Trial eligibility state.');
  }
  const qualifyingUsdCents = row.qualifyingUsdCents == null
    ? null
    : nonnegativeInteger(row.qualifyingUsdCents, 'qualifying purchase value');
  const verifiedAt = row.verifiedAt == null ? null : text(row.verifiedAt, 'qualifying purchase verification time');
  return {
    roundId: text(row.roundId, 'eligibility round ID'),
    wallet: text(row.wallet, 'eligibility wallet'),
    eligible: boolean(row.eligible, 'eligibility result'),
    status: status as TreeKnowledgeTrialEligibility['status'],
    minimumQualifyingUsdCents: nonnegativeInteger(row.minimumQualifyingUsdCents, 'minimum qualifying value'),
    qualifyingUsdCents,
    verifiedAt,
    passIssued: boolean(row.passIssued, 'pass issuance state'),
    attemptStarted: boolean(row.attemptStarted, 'attempt start state'),
    attemptCompleted: boolean(row.attemptCompleted, 'attempt completion state'),
  };
}

function parseChallenge(value: unknown): TreeKnowledgeTrialChallenge {
  const row = record(value);
  return {
    challengeId: text(row.challengeId, 'challenge ID'),
    roundId: text(row.roundId, 'round ID'),
    wallet: text(row.wallet, 'challenge wallet'),
    qualifyingTxDigest: text(row.qualifyingTxDigest, 'qualifying transaction digest'),
    message: text(row.message, 'wallet challenge message'),
    expiresAt: text(row.expiresAt, 'challenge expiration'),
    consumed: boolean(row.consumed, 'challenge consumption state'),
  };
}

function parseAttemptContext(value: unknown): TreeKnowledgeTrialAttemptContext {
  const row = record(value);
  return {
    attemptId: text(row.attemptId, 'attempt ID'),
    roundId: text(row.roundId, 'attempt round ID'),
    wallet: text(row.wallet, 'attempt wallet'),
    questionSetVersion: text(row.questionSetVersion, 'question-set version'),
    startedAt: text(row.startedAt, 'attempt start time'),
    expiresAt: text(row.expiresAt, 'attempt expiration'),
    submitted: boolean(row.submitted, 'attempt submission state'),
  };
}

function parseTiebreakChallenge(value: unknown): TreeKnowledgeTrialTiebreakChallenge {
  const row = record(value);
  return {
    challengeId: text(row.challengeId, 'sudden-death challenge ID'),
    roundId: text(row.roundId, 'sudden-death round ID'),
    wallet: text(row.wallet, 'sudden-death wallet'),
    stage: integer(row.stage, 'sudden-death stage'),
    message: text(row.message, 'sudden-death wallet challenge message'),
    expiresAt: text(row.expiresAt, 'sudden-death challenge expiration'),
    consumed: boolean(row.consumed, 'sudden-death challenge consumption state'),
  };
}

function parseTiebreakAttemptContext(value: unknown): TreeKnowledgeTrialTiebreakAttemptContext {
  const row = record(value);
  return {
    attemptId: text(row.attemptId, 'sudden-death attempt ID'),
    roundId: text(row.roundId, 'sudden-death attempt round ID'),
    wallet: text(row.wallet, 'sudden-death attempt wallet'),
    stage: integer(row.stage, 'sudden-death attempt stage'),
    startedAt: text(row.startedAt, 'sudden-death attempt start time'),
    expiresAt: text(row.expiresAt, 'sudden-death attempt expiration'),
    submitted: boolean(row.submitted, 'sudden-death attempt submission state'),
  };
}

export class SupabaseTreeKnowledgeTrialStore {
  private readonly config: TreeKnowledgeTrialSupabaseConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: TreeKnowledgeTrialSupabaseConfig, fetchImpl: typeof fetch = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  // The private Knowledge Trial snapshot joins rounds, passes, attempts, and
  // recent history. Supabase can legitimately take longer than 7.5 seconds
  // after an idle period, so keep the request inside Netlify's execution
  // window instead of returning a false empty round during a cold start.
  private async rpc(name: string, body: JsonRecord, timeoutMs = 20_000): Promise<unknown> {
    const response = await this.fetchImpl(`${this.config.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.secretKey}`,
        apikey: this.config.secretKey,
        'X-Client-Info': 'tree-command-center-knowledge-trial/1',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = typeof record(payload).message === 'string'
        ? String(record(payload).message)
        : `Supabase Knowledge Trial request failed with HTTP ${response.status}.`;
      throw new Error(message);
    }
    return payload;
  }

  async publicSnapshot() {
    let value: JsonRecord;
    try {
      value = record(await this.rpc('read_tree_knowledge_trial_public_snapshot_v2', {}));
    } catch (error) {
      if (!/could not find|does not exist|PGRST202|HTTP 404/i.test(error instanceof Error ? error.message : '')) throw error;
      value = record(await this.rpc('read_tree_knowledge_trial_public_snapshot_v1', {}));
    }
    if (value.round !== null && (!value.round || typeof value.round !== 'object')) {
      throw new Error('Supabase returned an invalid Knowledge Trial round snapshot.');
    }
    if (!Array.isArray(value.leaderboard)) throw new Error('Supabase returned an invalid Knowledge Trial leaderboard.');
    const participation = record(value.participation);
    const submissionCount = nonnegativeInteger(value.submissionCount || 0, 'submission count');
    return {
      round: value.round as JsonRecord | null,
      leaderboard: value.leaderboard,
      submissionCount,
      participation: {
        verifiedPasses: nonnegativeInteger(participation.verifiedPasses || 0, 'verified pass count'),
        attemptsStarted: nonnegativeInteger(participation.attemptsStarted || 0, 'attempt start count'),
        completedAttempts: nonnegativeInteger(participation.completedAttempts ?? submissionCount, 'completed attempt count'),
        completionRatePercent: nonnegativeInteger(participation.completionRatePercent || 0, 'completion rate'),
      },
      recentRounds: Array.isArray(value.recentRounds) ? value.recentRounds : [],
    };
  }

  async readEligibility(roundId: string, wallet: string) {
    return parseEligibility(await this.rpc('read_tree_knowledge_trial_wallet_eligibility_v1', {
      p_round_id: roundId,
      p_wallet: wallet,
    }));
  }

  async createChallenge(input: {
    roundId: string;
    wallet: string;
    qualifyingTxDigest: string | null;
    nonceSha256: string;
    messagePrefix: string;
    requestFingerprint: string;
    expiresAt: string;
  }) {
    return parseChallenge(await this.rpc('create_tree_knowledge_trial_wallet_challenge_v1', {
      p_round_id: input.roundId,
      p_wallet: input.wallet,
      p_qualifying_tx_digest: input.qualifyingTxDigest,
      p_nonce_sha256: input.nonceSha256,
      p_message_prefix: input.messagePrefix,
      p_request_fingerprint: input.requestFingerprint,
      p_expires_at: input.expiresAt,
    }));
  }

  async readChallenge(challengeId: string) {
    return parseChallenge(await this.rpc('read_tree_knowledge_trial_wallet_challenge_v1', {
      p_challenge_id: challengeId,
    }));
  }

  async consumeChallenge(challengeId: string, wallet: string, roundId: string) {
    return parseChallenge(await this.rpc('consume_tree_knowledge_trial_wallet_challenge_v1', {
      p_challenge_id: challengeId,
      p_wallet: wallet,
      p_round_id: roundId,
    }));
  }

  async issuePass(roundId: string, wallet: string, qualifyingTxDigest: string) {
    return record(await this.rpc('issue_tree_knowledge_trial_pass_v1', {
      p_round_id: roundId,
      p_wallet: wallet,
      p_qualifying_tx_digest: qualifyingTxDigest,
    }));
  }

  async startAttempt(roundId: string, wallet: string, attemptTokenSha256: string) {
    return parseAttemptContext(await this.rpc('start_tree_knowledge_trial_attempt_v2', {
      p_round_id: roundId,
      p_wallet: wallet,
      p_attempt_token_sha256: attemptTokenSha256,
    }));
  }

  async readAttempt(attemptTokenSha256: string) {
    return parseAttemptContext(await this.rpc('read_tree_knowledge_trial_attempt_context_v1', {
      p_attempt_token_sha256: attemptTokenSha256,
    }));
  }

  async questionSet(questionSetVersion: string) {
    const value = record(await this.rpc('read_tree_knowledge_trial_question_set_v1', {
      p_question_set_version: questionSetVersion,
    }));
    return value.questions;
  }

  async submitAttempt(attemptTokenSha256: string, answers: unknown, correctCount: number) {
    return record(await this.rpc('submit_tree_knowledge_trial_attempt_v2', {
      p_attempt_token_sha256: attemptTokenSha256,
      p_answers: answers,
      p_correct_count: correctCount,
    }));
  }

  async createTiebreakChallenge(input: {
    roundId: string;
    wallet: string;
    nonceSha256: string;
    message: string;
    requestFingerprint: string;
    expiresAt: string;
  }) {
    return parseTiebreakChallenge(await this.rpc('create_tree_knowledge_trial_tiebreak_challenge_v1', {
      p_round_id: input.roundId,
      p_wallet: input.wallet,
      p_nonce_sha256: input.nonceSha256,
      p_message: input.message,
      p_request_fingerprint: input.requestFingerprint,
      p_expires_at: input.expiresAt,
    }));
  }

  async readTiebreakChallenge(challengeId: string) {
    return parseTiebreakChallenge(await this.rpc('read_tree_knowledge_trial_tiebreak_challenge_v1', {
      p_challenge_id: challengeId,
    }));
  }

  async consumeTiebreakChallenge(challengeId: string, wallet: string, roundId: string, stage: number) {
    return parseTiebreakChallenge(await this.rpc('consume_tree_knowledge_trial_tiebreak_challenge_v1', {
      p_challenge_id: challengeId,
      p_wallet: wallet,
      p_round_id: roundId,
      p_stage: stage,
    }));
  }

  async startTiebreakAttempt(roundId: string, wallet: string, stage: number, attemptTokenSha256: string) {
    return parseTiebreakAttemptContext(await this.rpc('start_tree_knowledge_trial_tiebreak_attempt_v1', {
      p_round_id: roundId,
      p_wallet: wallet,
      p_stage: stage,
      p_attempt_token_sha256: attemptTokenSha256,
    }));
  }

  async readTiebreakAttempt(attemptTokenSha256: string) {
    return parseTiebreakAttemptContext(await this.rpc('read_tree_knowledge_trial_tiebreak_attempt_context_v1', {
      p_attempt_token_sha256: attemptTokenSha256,
    }));
  }

  async tiebreakQuestion(roundId: string, stage: number) {
    return record(await this.rpc('read_tree_knowledge_trial_tiebreak_question_v1', {
      p_round_id: roundId,
      p_stage: stage,
    }));
  }

  async submitTiebreakAttempt(attemptTokenSha256: string, selectedOptionId: string) {
    return record(await this.rpc('submit_tree_knowledge_trial_tiebreak_attempt_v1', {
      p_attempt_token_sha256: attemptTokenSha256,
      p_selected_option_id: selectedOptionId,
    }));
  }

  async prepareDraft(input: {
    roundId: string;
    questionSetVersion: string;
    questions: unknown;
    tiebreakQuestions: unknown;
    purchaseWindowOpensAt: string;
    purchaseWindowClosesAt: string;
    challengeOpensAt: string;
    challengeClosesAt: string;
    prizeTokenType: string;
    prizeAmountRaw: string;
    requestSha256: string;
  }) {
    return record(await this.rpc('prepare_tree_knowledge_trial_round_v2', {
      p_round_id: input.roundId,
      p_question_set_version: input.questionSetVersion,
      p_questions: input.questions,
      p_tiebreak_questions: input.tiebreakQuestions,
      p_purchase_window_opens_at: input.purchaseWindowOpensAt,
      p_purchase_window_closes_at: input.purchaseWindowClosesAt,
      p_challenge_opens_at: input.challengeOpensAt,
      p_challenge_closes_at: input.challengeClosesAt,
      p_prize_token_type: input.prizeTokenType,
      p_prize_amount_raw: input.prizeAmountRaw,
      p_request_sha256: input.requestSha256,
    }));
  }

  async readDraftSetup(roundId: string) {
    const value = await this.rpc('read_tree_knowledge_trial_round_setup_v2', {
      p_round_id: roundId,
    });
    return value === null ? null : record(value);
  }

  async scheduleRound(roundId: string) {
    return record(await this.rpc('schedule_tree_knowledge_trial_round_v2', {
      p_round_id: roundId,
    }));
  }

  async resolveRound(roundId: string) {
    return record(await this.rpc('resolve_tree_knowledge_trial_round_v2', {
      p_round_id: roundId,
    }));
  }

  async nextResolvableRound() {
    const value = await this.rpc('read_next_resolvable_tree_knowledge_trial_round_v1', {});
    return value === null ? null : record(value);
  }

  async readAward(roundId: string, wallet: string) {
    const value = await this.rpc('read_tree_knowledge_trial_award_v1', {
      p_round_id: roundId,
      p_wallet: wallet,
    });
    return value === null ? null : record(value);
  }

  async recordClaim(roundId: string, wallet: string, claimTxDigest: string) {
    return record(await this.rpc('record_tree_knowledge_trial_claim_v1', {
      p_round_id: roundId,
      p_wallet: wallet,
      p_claim_tx_digest: claimTxDigest,
    }));
  }
}

export function configuredSupabaseTreeKnowledgeTrialStore(env: Environment, fetchImpl: typeof fetch = fetch) {
  return new SupabaseTreeKnowledgeTrialStore(treeKnowledgeTrialSupabaseConfig(env), fetchImpl);
}
