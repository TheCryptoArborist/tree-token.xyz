import { buildTreeRaffleBrowserClaim } from '../dapp/raffle-transaction-core.js';
import { confirmTransaction } from '../dapp/transaction-review.js';
import {
  CHALLENGE_FUNDING_WALLET,
  DAILY_CHALLENGE_PRIZE_RAW,
  TREE_RAFFLE_PACKAGE_ID,
  TREE_RAFFLE_PRIZE_POOL_ID,
  TREE_TYPE,
  buildChallengePoolFundingTransaction,
  formatTreeRaw,
  isChallengeFundingWallet,
  parseTreeFundingAmount,
  summarizeChallengeKeeper,
} from '../dapp/challenge-funding-core.js';

const root = document.getElementById('canopy-draw');

if (root) {
  const isTestDapp = location.hostname === 'test.tree-token.xyz'
    || location.hostname === 'tree-token-test-dapp.netlify.app'
    || location.hostname.endsWith('--tree-token-test-dapp.netlify.app');
  const API = isTestDapp ? '/api/tree-knowledge-trial-test' : '/api/tree-knowledge-trial';
  const CLAIM_API = isTestDapp ? '/api/tree-knowledge-trial-claim-test' : '/api/tree-knowledge-trial-claim';
  const nodes = {
    meta: root.querySelector('#knowledgeTrialMeta'),
    state: root.querySelector('#knowledgeTrialState'),
    overviewTab: root.querySelector('#raffleDailyTab'),
    standingsTab: root.querySelector('#knowledgeStandingsTab'),
    practiceTab: root.querySelector('#raffleWeeklyTab'),
    passTab: root.querySelector('#raffleEntriesTab'),
    startCard: root.querySelector('#knowledgeTrialStartCard'),
    activityRoundState: root.querySelector('#knowledgeActivityRoundState'),
    verifiedPasses: root.querySelector('#knowledgeVerifiedPasses'),
    attemptsStarted: root.querySelector('#knowledgeAttemptsStarted'),
    completedAttempts: root.querySelector('#knowledgeCompletedAttempts'),
    completionRate: root.querySelector('#knowledgeCompletionRate'),
    activityWindow: root.querySelector('#knowledgeActivityWindow'),
    winnerTime: root.querySelector('#knowledgeTrialWinnerTime'),
    winnerDetail: root.querySelector('#knowledgeTrialWinnerDetail'),
    standingsTitle: root.querySelector('#knowledgeStandingsTitle'),
    standingsState: root.querySelector('#knowledgeStandingsState'),
    standingsCopy: root.querySelector('#knowledgeStandingsCopy'),
    leaderboard: root.querySelector('#knowledgeLeaderboard'),
    recentRounds: root.querySelector('#knowledgeRecentRounds'),
    shortcut: root.querySelector('#knowledgeTrialPracticeShortcut'),
    card: root.querySelector('#knowledgeTrialPracticeCard'),
    modeLabel: root.querySelector('#knowledgeTrialModeLabel'),
    title: root.querySelector('#knowledgeTrialPracticeTitle'),
    intro: root.querySelector('#knowledgeTrialIntro'),
    start: root.querySelector('#knowledgeTrialStartPractice'),
    form: root.querySelector('#knowledgeTrialForm'),
    timer: root.querySelector('#knowledgeTrialTimer'),
    progress: root.querySelector('#knowledgeTrialProgress'),
    answered: root.querySelector('#knowledgeTrialAnswered'),
    progressBar: root.querySelector('#knowledgeTrialProgressBar'),
    question: root.querySelector('#knowledgeTrialQuestion'),
    actionHint: root.querySelector('#knowledgeTrialActionHint'),
    previous: root.querySelector('#knowledgeTrialPrevious'),
    next: root.querySelector('#knowledgeTrialNext'),
    submit: root.querySelector('#knowledgeTrialSubmit'),
    result: root.querySelector('#knowledgeTrialResult'),
    status: root.querySelector('#knowledgeTrialStatus'),
    passState: root.querySelector('#knowledgeTrialPassState'),
    passCopy: root.querySelector('#knowledgeTrialPassCopy'),
    eligibility: root.querySelector('#knowledgeTrialEligibility'),
    checkEligibility: root.querySelector('#knowledgeTrialCheckEligibility'),
    startLive: root.querySelector('#knowledgeTrialStartLive'),
    activation: root.querySelector('#knowledgeTrialActivation'),
    claim: root.querySelector('#knowledgeTrialClaimPrize'),
    claimStatus: root.querySelector('#knowledgeTrialClaimStatus'),
    purchaseStep: root.querySelector('#knowledgeTrialPurchaseStep'),
    purchaseStepState: root.querySelector('#knowledgeTrialPurchaseStepState'),
    verifyStep: root.querySelector('#knowledgeTrialVerifyStep'),
    verifyStepState: root.querySelector('#knowledgeTrialVerifyStepState'),
    challengeStep: root.querySelector('#knowledgeTrialChallengeStep'),
    challengeStepState: root.querySelector('#knowledgeTrialChallengeStepState'),
    fundingControl: root.querySelector('#knowledgeFundingControl'),
    fundingPoolState: root.querySelector('#knowledgeFundingPoolState'),
    fundingPoolBalance: root.querySelector('#knowledgeFundingPoolBalance'),
    fundingReservedBalance: root.querySelector('#knowledgeFundingReservedBalance'),
    fundingTotalBalance: root.querySelector('#knowledgeFundingTotalBalance'),
    fundingCoverage: root.querySelector('#knowledgeFundingCoverage'),
    fundingWalletBalance: root.querySelector('#knowledgeFundingWalletBalance'),
    fundingQueueState: root.querySelector('#knowledgeFundingQueueState'),
    fundingAmount: root.querySelector('#knowledgeFundingAmount'),
    fundingAmountHelp: root.querySelector('#knowledgeFundingAmountHelp'),
    fundingSubmit: root.querySelector('#knowledgeFundingSubmit'),
    fundingStatus: root.querySelector('#knowledgeFundingStatus'),
    fundingPresets: [...root.querySelectorAll('[data-knowledge-funding-amount]')],
  };
  const state = {
    config: null,
    publicRound: null,
    practiceQuestions: [],
    questions: [],
    answers: new Map(),
    current: 0,
    startedAt: 0,
    deadline: 0,
    timerId: null,
    running: false,
    submitting: false,
    mode: 'practice',
    attemptToken: '',
    contracts: null,
    claiming: false,
    participation: { verifiedPasses: 0, attemptsStarted: 0, completedAttempts: 0, completionRatePercent: 0 },
    leaderboard: [],
    recentRounds: [],
    eligibilityResult: null,
    eligibilityWallet: '',
    eligibilityChecking: false,
    fundingPoolRaw: 0n,
    fundingReservedRaw: 0n,
    fundingQueueReady: false,
    fundingUnresolvedRoundCount: 0,
    fundingWalletRaw: 0n,
    fundingRefreshing: false,
    fundingSubmitting: false,
  };

  const tabPairs = [
    [nodes.overviewTab, root.querySelector('#raffleDailyPanel')],
    [nodes.standingsTab, root.querySelector('#knowledgeStandingsPanel')],
    [nodes.practiceTab, root.querySelector('#raffleWeeklyPanel')],
    [nodes.passTab, root.querySelector('#raffleEntriesPanel')],
  ];

  function selectTab(selected) {
    tabPairs.forEach(([tab, panel]) => {
      const active = tab === selected;
      tab?.classList.toggle('active', active);
      tab?.setAttribute('aria-selected', String(active));
      if (panel) panel.hidden = !active;
    });
  }

  tabPairs.forEach(([tab]) => tab?.addEventListener('click', () => {
    selectTab(tab);
    if (tab === nodes.standingsTab) refreshPublicSnapshot({ refreshEligibility: true });
  }));

  document.addEventListener('click', (event) => {
    const trigger = event.target instanceof Element ? event.target.closest('[data-open-challenge-pass]') : null;
    if (!trigger) return;
    selectTab(nodes.passTab);
    window.setTimeout(() => {
      nodes.startCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      nodes.startCard?.classList.remove('highlight');
      window.requestAnimationFrame(() => nodes.startCard?.classList.add('highlight'));
    }, 0);
  });

  function setStatus(message, kind = '') {
    nodes.status.textContent = message;
    nodes.status.className = `status${kind ? ` ${kind}` : ''}`;
  }

  function formatTime(milliseconds) {
    const seconds = Math.max(0, Math.ceil(milliseconds / 1_000));
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function roundWindowState(round, now = Date.now()) {
    const opensAt = Date.parse(String(round?.challengeOpensAt || ''));
    const closesAt = Date.parse(String(round?.challengeClosesAt || ''));
    if (!Number.isFinite(opensAt) || !Number.isFinite(closesAt) || opensAt >= closesAt) return 'unavailable';
    if (now < opensAt) return 'scheduled';
    if (now >= closesAt) return 'closed';
    return 'active';
  }

  function maskedWallet(wallet) {
    const value = String(wallet || '');
    return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value || '—';
  }

  function localDateTime(milliseconds) {
    return new Date(milliseconds).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    });
  }

  function nextWinnerReviewAt(closesAt) {
    const review = new Date(closesAt);
    review.setUTCSeconds(0, 0);
    if (review.getUTCMinutes() >= 5) review.setUTCHours(review.getUTCHours() + 1, 5, 0, 0);
    else review.setUTCMinutes(5, 0, 0);
    return review.getTime();
  }

  function renderWinnerTiming(roundState, closes) {
    if (!Number.isFinite(closes)) {
      nodes.winnerTime.textContent = 'Timing pending';
      nodes.winnerDetail.textContent = 'The exact closing and winner-review time will appear when the daily round is scheduled.';
      return;
    }
    const reviewAt = nextWinnerReviewAt(closes);
    if (['scored', 'awarded'].includes(roundState)) {
      nodes.winnerTime.textContent = 'Final standings posted';
      nodes.winnerDetail.textContent = `This round closed ${localDateTime(closes)} and its final standings have been determined.`;
      return;
    }
    if (roundState === 'tiebreak') {
      nodes.winnerTime.textContent = 'After sudden death';
      nodes.winnerDetail.textContent = `The round closed ${localDateTime(closes)}, but an exact tie requires sudden death. The final winner is determined when one tied leader remains.`;
      return;
    }
    nodes.winnerTime.textContent = `About ${localDateTime(reviewAt)}`;
    nodes.winnerDetail.textContent = `Entries close ${localDateTime(closes)}. Winner review begins about ${localDateTime(reviewAt)}. If the leading score and time are tied exactly, the final winner is determined after sudden death.`;
  }

  function renderActivity() {
    const participation = state.participation || {};
    nodes.verifiedPasses.textContent = String(Number(participation.verifiedPasses || 0));
    nodes.attemptsStarted.textContent = String(Number(participation.attemptsStarted || 0));
    nodes.completedAttempts.textContent = String(Number(participation.completedAttempts || 0));
    nodes.completionRate.textContent = `${Number(participation.completionRatePercent || 0)}%`;
    const roundState = String(state.publicRound?.state || 'preparing');
    nodes.activityRoundState.textContent = roundState === 'open' ? 'Open' : roundState === 'tiebreak' ? 'Sudden death' : roundState === 'scored' || roundState === 'awarded' ? 'Complete' : 'Preparing';
    const opens = Date.parse(String(state.publicRound?.challengeOpensAt || ''));
    const closes = Date.parse(String(state.publicRound?.challengeClosesAt || ''));
    renderWinnerTiming(roundState, closes);
    nodes.activityWindow.textContent = Number.isFinite(opens) && Number.isFinite(closes)
      ? `Challenge window: ${new Date(opens).toLocaleString()} – ${new Date(closes).toLocaleString()}`
      : 'Daily round timing is not published yet.';

    const resolved = ['scored', 'awarded'].includes(roundState);
    nodes.standingsState.textContent = resolved ? 'Final' : 'Hidden live';
    nodes.standingsState.className = `data-state ${resolved ? 'live' : 'staged'}`;
    nodes.standingsTitle.textContent = resolved ? 'Final daily standings' : 'Scores unlock after the round closes';
    nodes.standingsCopy.textContent = resolved
      ? 'Final scores are ranked by accuracy first, then verified completion time.'
      : 'Live scores stay private while the challenge is open so later participants cannot gain an advantage.';
    nodes.leaderboard.replaceChildren();
    if (resolved && state.leaderboard.length) {
      state.leaderboard.forEach((entry) => {
        const row = document.createElement('div');
        row.className = 'knowledge-standing-row';
        const rank = document.createElement('b');
        rank.textContent = `#${Number(entry.rank || 0)}`;
        const wallet = document.createElement('strong');
        wallet.textContent = maskedWallet(entry.wallet);
        const score = document.createElement('span');
        score.textContent = `${Number(entry.correctCount || 0)}/${Number(state.publicRound?.questionCount || state.config?.questionCount || 3)} · ${(Number(entry.elapsedMs || 0) / 1_000).toFixed(1)}s`;
        row.append(rank, wallet, score);
        nodes.leaderboard.append(row);
      });
    } else {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = resolved ? 'No completed eligible attempts were recorded for this round.' : 'Rankings will appear here once the round is officially scored.';
      nodes.leaderboard.append(empty);
    }

    nodes.recentRounds.replaceChildren();
    if (state.recentRounds.length) {
      state.recentRounds.forEach((round) => {
        const row = document.createElement('div');
        row.className = 'knowledge-history-row';
        const date = document.createElement('strong');
        const closedAt = Date.parse(String(round.challengeClosesAt || ''));
        date.textContent = Number.isFinite(closedAt) ? new Date(closedAt).toLocaleDateString() : String(round.roundId || 'Round');
        const participationCopy = document.createElement('span');
        participationCopy.textContent = `${Number(round.submissionCount || 0)} completed`;
        const winner = document.createElement('span');
        winner.textContent = round.winnerWallet
          ? `Winner ${maskedWallet(round.winnerWallet)} · ${Number(round.winnerCorrectCount || 0)} correct · ${(Number(round.winnerElapsedMs || 0) / 1_000).toFixed(1)}s`
          : round.state === 'cancelled' ? 'Cancelled' : 'No winner';
        row.append(date, participationCopy, winner);
        const award = round.award;
        if (award?.claimable) {
          const claim = document.createElement('button');
          const claimStatus = document.createElement('p');
          const connectedWallet = String(window.playerAddress || '').toLowerCase();
          const ownsAward = Boolean(connectedWallet && award.wallet === connectedWallet);
          claim.type = 'button';
          claim.className = 'button gold knowledge-history-claim';
          claim.textContent = ownsAward ? 'Claim 50,000 TREE' : `Prize reserved for ${maskedWallet(award.wallet)}`;
          claim.disabled = !ownsAward || state.claiming;
          claimStatus.className = 'status knowledge-history-claim-status';
          claimStatus.setAttribute('role', 'status');
          claimStatus.setAttribute('aria-live', 'polite');
          claim.addEventListener('click', () => claimPrize(round, claimStatus).catch((error) => {
            claimStatus.textContent = error instanceof Error ? error.message : 'The prize claim could not be completed.';
          }));
          row.append(claim, claimStatus);
        } else if (award?.claimed) {
          const claimed = document.createElement('span');
          claimed.className = 'knowledge-history-claimed';
          claimed.textContent = 'Prize claimed';
          row.append(claimed);
        }
        nodes.recentRounds.append(row);
      });
    } else {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Completed rounds will appear after public competition begins.';
      nodes.recentRounds.append(empty);
    }
  }

  function renderEligibility() {
    const wallet = String(window.playerAddress || '').toLowerCase();
    const currentEligibility = state.eligibilityWallet === wallet ? state.eligibilityResult : null;
    nodes.checkEligibility.disabled = !wallet || !state.publicRound?.roundId || state.eligibilityChecking || Boolean(currentEligibility?.eligible);
    if (state.eligibilityChecking) {
      nodes.eligibility.className = 'knowledge-eligibility checking';
      nodes.eligibility.textContent = 'Checking the verified purchase ledger…';
      return;
    }
    if (!wallet) {
      nodes.eligibility.className = 'knowledge-eligibility';
      nodes.eligibility.textContent = 'Connect a wallet for an automatic eligibility check.';
      return;
    }
    const eligibility = state.eligibilityWallet === wallet ? state.eligibilityResult : null;
    if (!eligibility) {
      nodes.eligibility.className = 'knowledge-eligibility';
      nodes.eligibility.textContent = 'Your connected wallet is ready to be checked.';
      return;
    }
    if (eligibility.eligible) {
      const amount = eligibility.qualifyingUsdCents == null ? '' : ` A $${(Number(eligibility.qualifyingUsdCents) / 100).toFixed(2)} TREE purchase was verified.`;
      nodes.eligibility.className = 'knowledge-eligibility eligible';
      nodes.eligibility.textContent = eligibility.attemptCompleted
        ? `Daily challenge complete.${amount}`
        : eligibility.attemptStarted ? `Your scored attempt has started.${amount}`
          : eligibility.passIssued ? `Your Challenge Pass is active.${amount}`
            : `Eligible for this daily round.${amount}`;
    } else {
      nodes.eligibility.className = 'knowledge-eligibility not-eligible';
      nodes.eligibility.textContent = 'No qualifying purchase has been verified for this daily window yet. A new swap can take a short time to appear—check again shortly.';
    }
  }

  async function checkEligibility({ automatic = false } = {}) {
    const wallet = String(window.playerAddress || '').toLowerCase();
    const selectedRoundId = state.publicRound?.roundId;
    if (!wallet || !selectedRoundId || state.eligibilityChecking) return;
    state.eligibilityChecking = true;
    renderEligibility();
    try {
      const payload = await post('eligibility', { wallet, roundId: selectedRoundId });
      if (String(window.playerAddress || '').toLowerCase() !== wallet) return;
      state.eligibilityWallet = wallet;
      state.eligibilityResult = payload.eligibility;
    } catch (error) {
      if (!automatic) nodes.claimStatus.textContent = error instanceof Error ? error.message : 'Eligibility could not be checked.';
      state.eligibilityWallet = wallet;
      state.eligibilityResult = null;
    } finally {
      state.eligibilityChecking = false;
      renderEligibility();
      updateWalletState();
    }
  }

  async function verifySubmittedPurchase(detail) {
    const wallet = String(window.playerAddress || '').toLowerCase();
    const selectedRoundId = state.publicRound?.roundId;
    const digest = typeof detail?.digest === 'string' ? detail.digest.trim() : '';
    const submittedWallet = typeof detail?.wallet === 'string' ? detail.wallet.toLowerCase() : '';
    if (!wallet || !selectedRoundId || !digest || submittedWallet !== wallet || state.eligibilityChecking) return;
    state.eligibilityChecking = true;
    renderEligibility();
    try {
      const payload = await post('verify-purchase', { wallet, roundId: selectedRoundId, digest });
      if (String(window.playerAddress || '').toLowerCase() !== wallet) return;
      state.eligibilityWallet = wallet;
      state.eligibilityResult = payload.eligibility;
      nodes.claimStatus.textContent = payload.eligibility?.eligible
        ? 'Purchase verified. Your daily challenge is ready.'
        : 'The purchase was verified, but it does not meet this round’s eligibility rules.';
    } catch (error) {
      state.eligibilityWallet = wallet;
      state.eligibilityResult = null;
      nodes.claimStatus.textContent = error instanceof Error
        ? error.message
        : 'The purchase could not be verified automatically.';
    } finally {
      state.eligibilityChecking = false;
      renderEligibility();
      updateWalletState();
    }
  }

  function updateWalletState() {
    const wallet = String(window.playerAddress || '');
    const normalizedWallet = wallet.toLowerCase();
    const award = state.publicRound?.award;
    const isWinner = Boolean(normalizedWallet && award?.wallet === normalizedWallet);
    const canClaim = Boolean(isWinner && award?.claimable && state.config?.claimsEnabled
      && state.contracts?.packageId && state.contracts?.poolId);
    const roundTiming = roundWindowState(state.publicRound);
    const suddenDeathReady = Boolean(
      state.config?.publicAttemptsEnabled
      && state.publicRound?.state === 'tiebreak'
      && Number.isInteger(Number(state.publicRound?.tiebreakStage)),
    );
    const liveReady = Boolean(
      state.config?.publicAttemptsEnabled
      && state.publicRound?.roundId
      && state.publicRound?.state === 'open'
      && roundTiming === 'active',
    );
    const eligibility = state.eligibilityWallet === normalizedWallet ? state.eligibilityResult : null;
    const purchaseVerified = Boolean(eligibility?.eligible);
    const attemptComplete = Boolean(eligibility?.attemptCompleted);
    const canStart = Boolean(wallet && purchaseVerified && !attemptComplete && (liveReady || suddenDeathReady));
    nodes.startLive.textContent = suddenDeathReady ? 'Start Sudden Death' : attemptComplete ? 'Challenge Complete' : 'Start Daily Challenge';
    nodes.startLive.hidden = false;
    nodes.startLive.disabled = !canStart;
    nodes.checkEligibility.textContent = state.eligibilityChecking ? 'Checking Purchase…' : purchaseVerified ? 'Purchase Verified' : 'Check Purchase';
    nodes.checkEligibility.disabled = !wallet || !state.publicRound?.roundId || state.eligibilityChecking || purchaseVerified;
    const setStep = (node, stateNode, status, mode) => {
      node?.classList.toggle('complete', mode === 'complete');
      node?.classList.toggle('current', mode === 'current');
      node?.classList.toggle('locked', mode === 'locked');
      if (stateNode) stateNode.textContent = status;
    };
    setStep(nodes.purchaseStep, nodes.purchaseStepState,
      purchaseVerified ? 'Complete' : wallet ? 'Purchase or verify' : 'Connect wallet first',
      purchaseVerified ? 'complete' : 'current');
    setStep(nodes.verifyStep, nodes.verifyStepState,
      purchaseVerified ? 'Complete' : state.eligibilityChecking ? 'Checking…' : wallet ? 'Ready to check' : 'Waiting for wallet',
      purchaseVerified ? 'complete' : wallet ? 'current' : 'locked');
    setStep(nodes.challengeStep, nodes.challengeStepState,
      attemptComplete ? 'Complete' : canStart ? 'Ready' : purchaseVerified && !liveReady && !suddenDeathReady ? 'Waiting for next round' : 'Locked until verified',
      attemptComplete ? 'complete' : canStart ? 'current' : 'locked');
    nodes.claim.hidden = !canClaim;
    nodes.claim.disabled = state.claiming;
    if (isWinner && award?.claimed) {
      nodes.passState.textContent = 'Prize claimed';
      nodes.passCopy.textContent = 'Your 50,000 TREE Knowledge Trial prize has been claimed and reconciled on Sui.';
    } else if (canClaim) {
      nodes.passState.textContent = 'You won';
      nodes.passCopy.textContent = 'Your 50,000 TREE prize is reserved in the on-chain prize pool. Claim it with the winning wallet.';
    } else if (wallet && eligibility?.attemptCompleted) {
      nodes.passState.textContent = 'Attempt complete';
      nodes.passCopy.textContent = 'Your verified daily result is recorded. Your score and time are locked—there is no retry for this round. Final standings will appear after the round closes.';
    } else if (wallet && eligibility?.eligible && !liveReady) {
      nodes.passState.textContent = 'Purchase verified';
      nodes.passCopy.textContent = 'Your qualifying purchase is recognized. The scored challenge button will appear when public attempts and the daily challenge window are active.';
    } else if (wallet && suddenDeathReady) {
      nodes.passState.textContent = 'Tie-break active';
      nodes.passCopy.textContent = `Connected wallet ${wallet.slice(0, 6)}…${wallet.slice(-4)}. Eligible tied leaders can verify their wallet and begin the current 30-second sudden-death question.`;
    } else if (wallet && liveReady) {
      nodes.passState.textContent = 'Ready to verify';
      nodes.passCopy.textContent = `Connected wallet ${wallet.slice(0, 6)}…${wallet.slice(-4)}. Start the daily challenge to verify a qualifying $5+ TREE purchase and sign one wallet-ownership message.`;
    } else if (wallet && state.config?.publicAttemptsEnabled && state.publicRound?.state === 'open' && roundTiming === 'scheduled') {
      nodes.passState.textContent = 'Scheduled';
      nodes.passCopy.textContent = `The next scored challenge opens ${new Date(state.publicRound.challengeOpensAt).toLocaleString()}. Your wallet can be checked when the window begins.`;
    } else if (wallet) {
      nodes.passState.textContent = 'No live round';
      nodes.passCopy.textContent = `Connected wallet ${wallet.slice(0, 6)}…${wallet.slice(-4)}. Your purchase can be checked when the next daily challenge window opens.`;
    } else {
      nodes.passState.textContent = liveReady || suddenDeathReady ? 'Connect wallet' : 'No live round';
      nodes.passCopy.textContent = liveReady || suddenDeathReady
        ? 'Connect the same wallet used for your qualifying $5+ TREE purchase, then check your Challenge Pass.'
        : 'Connect a wallet to check eligibility when the next daily challenge window opens.';
    }
    renderEligibility();
    renderFundingAccess();
  }

  function renderActivation(trial) {
    const checks = [
      [trial.activation?.legalApproved, 'Final operating terms approved'],
      [trial.activation?.databaseReady, 'Production attempt ledger ready'],
      [trial.activation?.questionSetReady, 'Private daily question set ready'],
      [trial.activation?.prizeSettlementReady, '50,000 TREE winner settlement ready'],
      [trial.activation?.requestedEnabled, 'Public activation enabled'],
    ];
    nodes.activation.replaceChildren(...checks.map(([ready, label]) => {
      const item = document.createElement('li');
      item.className = ready ? 'ready' : 'pending';
      item.textContent = `${ready ? 'Ready' : 'Pending'} · ${label}`;
      return item;
    }));
  }

  function applyPublicSnapshot(payload) {
    state.publicRound = payload.publicRound;
    state.participation = payload.participation || state.participation;
    state.leaderboard = Array.isArray(payload.leaderboard) ? payload.leaderboard : [];
    state.recentRounds = Array.isArray(payload.recentRounds) ? payload.recentRounds : [];
    state.fundingQueueReady = true;
    state.fundingUnresolvedRoundCount = state.recentRounds.filter((round) => round?.state === 'scored' && !round?.award).length;
    renderActivity();
    renderFundingAmount();
  }

  async function refreshPublicSnapshot({ refreshEligibility = false } = {}) {
    try {
      const response = await fetch(`${API}?action=status`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || payload.status !== 'ok' || !payload.publicRound) throw new Error('Challenge activity is temporarily unavailable.');
      applyPublicSnapshot(payload);
      if (refreshEligibility && window.playerAddress && state.publicRound?.roundId) {
        await checkEligibility({ automatic: true });
      }
      return true;
    } catch (error) {
      console.error('TREE Knowledge Trial activity refresh failed', error);
      return false;
    }
  }

  async function loadTrial() {
    try {
      const response = await fetch(`${API}?action=status`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || payload.status !== 'ok' || !Array.isArray(payload.practice?.questions)) throw new Error('Trial framework unavailable.');
      state.config = payload.trial;
      state.contracts = payload.contracts;
      applyPublicSnapshot(payload);
      state.practiceQuestions = payload.practice.questions;
      state.questions = state.practiceQuestions;
      nodes.meta.textContent = `${payload.trial.questionCount} questions · ${payload.trial.durationSeconds} seconds · $${(payload.trial.minimumQualifyingUsdCents / 100).toFixed(2)} minimum TREE purchase · one attempt per daily round`;
      const publicTiming = roundWindowState(payload.publicRound);
      const publicActive = payload.trial.publicAttemptsEnabled && publicTiming === 'active';
      nodes.state.textContent = publicActive ? 'Active' : payload.trial.publicAttemptsEnabled && publicTiming === 'scheduled' ? 'Scheduled' : 'Building';
      nodes.state.className = `data-state ${publicActive ? 'live' : 'staged'}`;
      nodes.timer.textContent = formatTime(payload.trial.durationSeconds * 1_000);
      nodes.start.disabled = false;
      renderActivation(payload.trial);
      updateWalletState();
      if (window.playerAddress && state.publicRound?.roundId) checkEligibility({ automatic: true });
      setStatus('Practice mode is ready. It does not create a scored entry or prize claim.', 'success');
    } catch (error) {
      nodes.meta.textContent = 'The practice question service could not be loaded.';
      nodes.state.textContent = 'Unavailable';
      nodes.state.className = 'data-state error';
      nodes.start.disabled = true;
      setStatus(error instanceof Error ? error.message : 'Trial framework unavailable.', 'error');
    }
  }

  function selectedOptionLabel(question, optionId) {
    return question?.options?.find((option) => option.id === optionId)?.label || optionId;
  }

  function renderQuestion() {
    const question = state.questions[state.current];
    if (!question) return;
    const finalQuestion = state.current === state.questions.length - 1;
    const currentAnswered = state.answers.has(question.id);
    const allAnswered = state.questions.every(({ id }) => state.answers.has(id));
    nodes.progress.textContent = `Question ${state.current + 1} of ${state.questions.length}`;
    nodes.answered.textContent = `${state.answers.size} answered`;
    nodes.progressBar.style.width = `${((state.current + 1) / state.questions.length) * 100}%`;
    nodes.previous.disabled = state.current === 0;
    nodes.next.hidden = finalQuestion;
    nodes.next.disabled = !currentAnswered;
    nodes.next.textContent = `Next Question →`;
    nodes.submit.hidden = !finalQuestion;
    nodes.submit.disabled = !allAnswered || state.submitting;
    nodes.submit.textContent = state.mode === 'tiebreak' ? 'Submit Sudden-Death Answer' : 'Finalize Answers';
    nodes.form.classList.toggle('final-question', finalQuestion);
    nodes.actionHint.classList.toggle('ready', currentAnswered && (!finalQuestion || allAnswered));
    if (!currentAnswered) {
      nodes.actionHint.textContent = finalQuestion
        ? `Select your final answer to unlock “${nodes.submit.textContent}.”`
        : 'Select an answer to unlock “Next Question.”';
    } else if (!finalQuestion) {
      nodes.actionHint.textContent = 'Answer selected. Click “Next Question” to continue.';
    } else if (!allAnswered) {
      nodes.actionHint.textContent = `${state.questions.length - state.answers.size} unanswered question remains. Go back and answer it before finalizing.`;
    } else {
      nodes.actionHint.textContent = state.mode === 'tiebreak'
        ? 'Answer selected. Submit it before the sudden-death timer expires.'
        : `All ${state.questions.length} answers are selected. Click “Finalize Answers” to submit them.`;
    }
    nodes.question.replaceChildren();

    const legend = document.createElement('legend');
    legend.textContent = question.prompt;
    nodes.question.append(legend);
    question.options.forEach((option) => {
      const label = document.createElement('label');
      label.className = 'knowledge-option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `knowledge-${question.id}`;
      input.value = option.id;
      input.checked = state.answers.get(question.id) === option.id;
      input.addEventListener('change', () => {
        state.answers.set(question.id, option.id);
        renderQuestion();
      });
      const copy = document.createElement('span');
      copy.textContent = option.label;
      label.append(input, copy);
      nodes.question.append(label);
    });
  }

  function updateTimer() {
    if (!state.running) return;
    const remaining = state.deadline - Date.now();
    nodes.timer.textContent = formatTime(remaining);
    nodes.timer.classList.toggle('urgent', remaining <= 30_000);
    if (remaining <= 0) submitCurrent(true);
  }

  function startPractice() {
    if (!state.config || state.practiceQuestions.length !== state.config.questionCount) return;
    clearInterval(state.timerId);
    state.mode = 'practice';
    state.attemptToken = '';
    state.questions = state.practiceQuestions;
    state.answers.clear();
    state.current = 0;
    state.startedAt = Date.now();
    state.deadline = state.startedAt + state.config.durationSeconds * 1_000;
    state.running = true;
    state.submitting = false;
    nodes.modeLabel.textContent = 'PRACTICE MODE';
    nodes.title.textContent = 'TREE Ecosystem Foundations';
    nodes.intro.hidden = true;
    nodes.result.hidden = true;
    nodes.form.hidden = false;
    nodes.timer.classList.remove('urgent');
    setStatus('Practice timer started. Choose the best answer for every question.');
    renderQuestion();
    updateTimer();
    state.timerId = setInterval(updateTimer, 250);
  }

  function resultFeedback(payload) {
    const score = payload.score;
    const wrapper = document.createElement('div');
    const heading = document.createElement('strong');
    heading.className = 'knowledge-result-score';
    heading.textContent = `${score.correctCount}/${score.totalQuestions} correct · ${score.elapsedSeconds.toFixed(1)} seconds`;
    const copy = document.createElement('p');
    copy.textContent = score.correctCount === score.totalQuestions
      ? 'Perfect practice score. Accuracy would rank first in a live round.'
      : 'Review the explanations below, then take another practice attempt.';
    wrapper.append(heading, copy);

    const missed = score.answers.filter((answer) => !answer.correct);
    if (missed.length) {
      const list = document.createElement('ul');
      list.className = 'knowledge-review-list';
      missed.forEach((answer) => {
        const question = state.questions.find(({ id }) => id === answer.questionId);
        const item = document.createElement('li');
        item.textContent = `${question?.prompt || answer.questionId} Correct answer: ${selectedOptionLabel(question, answer.correctOptionId)}. ${answer.explanation}`;
        list.append(item);
      });
      wrapper.append(list);
    }
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'button secondary';
    retry.textContent = 'Practice Again';
    retry.addEventListener('click', startPractice);
    wrapper.append(retry);
    return wrapper;
  }

  function liveResultFeedback(payload) {
    const wrapper = document.createElement('div');
    const heading = document.createElement('strong');
    heading.className = 'knowledge-result-score';
    heading.textContent = `${payload.result.correctCount}/${payload.result.totalQuestions} correct · ${(payload.result.elapsedMs / 1_000).toFixed(1)} seconds`;
    const copy = document.createElement('p');
    copy.textContent = state.mode === 'tiebreak'
      ? 'Your sudden-death result is recorded. If the leading result is still tied exactly, only those tied leaders advance to the next private question.'
      : 'Your verified daily result is recorded and locked. This scored attempt cannot be retried or improved; the one daily winner is determined after the round closes, with exact leaders advancing to sudden death.';
    wrapper.append(heading, copy);
    return wrapper;
  }

  async function post(action, body) {
    const response = await fetch(`${API}?action=${action}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.status !== 'ok') throw new Error(payload.message || 'The daily challenge request could not be completed.');
    return payload;
  }

  function transactionDigest(value) {
    return value?.digest || value?.transactionDigest || value?.effects?.transactionDigest || value?.result?.digest || null;
  }

  function transactionSucceeded(value) {
    if (value?.status?.success === true
      || value?.effects?.status?.success === true
      || value?.Transaction?.status?.success === true
      || value?.Transaction?.effects?.status?.success === true) return true;
    const status = value?.effects?.status?.status
      ?? value?.effects?.status
      ?? value?.transaction?.effects?.status?.status
      ?? value?.Transaction?.effects?.status?.status;
    return String(status || '').toLowerCase() === 'success';
  }

  async function suiGraphql(query) {
    const response = await fetch('https://graphql.mainnet.sui.io/graphql', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.errors?.length) throw new Error('The Sui prize-pool balance is temporarily unavailable.');
    return payload.data;
  }

  async function readDynamicFields(address, pageSize = 50) {
    const nodes = [];
    const seenCursors = new Set();
    let after = null;
    for (let page = 0; page < 100; page += 1) {
      const afterArgument = after ? `, after: ${JSON.stringify(after)}` : '';
      const data = await suiGraphql(`query { address(address: "${address}") { dynamicFields(first: ${pageSize}${afterArgument}) { pageInfo { hasNextPage endCursor } nodes { name { type { repr } } value { __typename ... on MoveValue { type { repr } json } } } } } }`);
      const connection = data?.address?.dynamicFields;
      if (!connection || !Array.isArray(connection.nodes)) throw new Error('The verified Challenge prize-pool fields could not be read.');
      nodes.push(...connection.nodes);
      if (!connection.pageInfo?.hasNextPage) return nodes;
      const nextCursor = String(connection.pageInfo?.endCursor || '');
      if (!nextCursor || seenCursors.has(nextCursor)) throw new Error('The Challenge prize-pool field list could not be completed.');
      seenCursors.add(nextCursor);
      after = nextCursor;
    }
    throw new Error('The Challenge prize-pool field list exceeded the safe pagination limit.');
  }

  async function readChallengePoolState() {
    const poolData = await suiGraphql(`query { object(address: "${TREE_RAFFLE_PRIZE_POOL_ID}") { asMoveObject { contents { json } } } }`);
    const bagId = poolData?.object?.asMoveObject?.contents?.json?.unreserved_balances?.id;
    if (!/^0x[0-9a-f]{64}$/i.test(String(bagId || ''))) throw new Error('The verified Challenge prize pool could not be read.');
    const [bagFields, prizeFields] = await Promise.all([
      readDynamicFields(bagId),
      readDynamicFields(TREE_RAFFLE_PRIZE_POOL_ID),
    ]);
    const expectedKey = `::prize_pool::TokenKey<${TREE_TYPE}>`.toLowerCase();
    const entry = bagFields.find((node) => String(node?.name?.type?.repr || '').toLowerCase().endsWith(expectedKey));
    return summarizeChallengeKeeper({
      availableRaw: entry?.value?.json ?? 0,
      poolFields: prizeFields,
      recentRounds: state.recentRounds,
    });
  }

  function fundingBalanceValue(result) {
    return BigInt(result?.balance?.balance ?? result?.balance ?? result?.totalBalance ?? 0);
  }

  function renderFundingAccess() {
    if (!nodes.fundingControl) return;
    const allowed = isChallengeFundingWallet(window.playerAddress);
    nodes.fundingControl.hidden = !allowed;
    if (!allowed) {
      state.fundingWalletRaw = 0n;
      nodes.fundingSubmit.disabled = true;
      return;
    }
    renderFundingAmount();
  }

  function renderFundingAmount() {
    if (!nodes.fundingAmount || !nodes.fundingSubmit) return;
    const queueChecking = !state.fundingQueueReady;
    if (nodes.fundingQueueState) {
      nodes.fundingQueueState.className = `knowledge-funding-queue ${queueChecking ? 'checking' : state.fundingUnresolvedRoundCount > 0 ? 'warning' : 'clear'}`;
      const detail = nodes.fundingQueueState.querySelector('span');
      if (detail) detail.textContent = queueChecking
        ? 'Checking completed rounds before enabling another deposit…'
        : state.fundingUnresolvedRoundCount > 0
          ? `${state.fundingUnresolvedRoundCount} completed round${state.fundingUnresolvedRoundCount === 1 ? '' : 's'} still await settlement. Deposited TREE may be assigned to those older awards before it becomes available for a new daily prize.`
          : 'No unresolved completed rounds are visible. Deposits may proceed after the Mainnet safety checks.';
    }
    try {
      const raw = parseTreeFundingAmount(nodes.fundingAmount.value);
      const display = formatTreeRaw(raw, 6);
      const fullDays = raw / DAILY_CHALLENGE_PRIZE_RAW;
      nodes.fundingSubmit.textContent = state.fundingSubmitting ? 'Preparing Deposit…' : `Review ${display} TREE Deposit`;
      nodes.fundingAmountHelp.textContent = fullDays > 0n
        ? `${display} TREE covers ${fullDays.toLocaleString()} full daily prize${fullDays === 1n ? '' : 's'} at the current 50,000 TREE rate.`
        : 'This amount is less than one 50,000 TREE daily prize.';
      nodes.fundingSubmit.disabled = state.fundingSubmitting || queueChecking || raw > state.fundingWalletRaw;
    } catch (error) {
      nodes.fundingSubmit.textContent = 'Enter a Valid TREE Amount';
      nodes.fundingSubmit.disabled = true;
      nodes.fundingAmountHelp.textContent = error instanceof Error ? error.message : 'Enter a valid TREE amount.';
    }
  }

  async function refreshFundingBalances() {
    const wallet = String(window.playerAddress || '').toLowerCase();
    if (!isChallengeFundingWallet(wallet) || state.fundingRefreshing) return;
    state.fundingRefreshing = true;
    nodes.fundingPoolState.textContent = 'Checking';
    nodes.fundingPoolState.className = 'data-state refreshing';
    try {
      const client = typeof window.initSuiClient === 'function'
        ? await window.initSuiClient()
        : null;
      if (!client?.core?.getBalance) throw new Error('The Sui Mainnet client is unavailable.');
      const [keeper, walletBalance] = await Promise.all([
        readChallengePoolState(),
        client.core.getBalance({ owner: CHALLENGE_FUNDING_WALLET, coinType: TREE_TYPE }),
      ]);
      if (!isChallengeFundingWallet(window.playerAddress)) return;
      state.fundingPoolRaw = keeper.availableRaw;
      state.fundingReservedRaw = keeper.reservedRaw;
      state.fundingUnresolvedRoundCount = keeper.unresolvedRoundCount;
      state.fundingWalletRaw = fundingBalanceValue(walletBalance);
      nodes.fundingPoolBalance.textContent = `${formatTreeRaw(keeper.availableRaw, 6)} TREE`;
      nodes.fundingReservedBalance.textContent = `${formatTreeRaw(keeper.reservedRaw, 6)} TREE · ${keeper.reservedPrizeCount} prize${keeper.reservedPrizeCount === 1 ? '' : 's'}`;
      nodes.fundingTotalBalance.textContent = `${formatTreeRaw(keeper.totalRaw, 6)} TREE`;
      const coverage = keeper.availableRaw / DAILY_CHALLENGE_PRIZE_RAW;
      nodes.fundingCoverage.textContent = `${coverage.toLocaleString()} day${coverage === 1n ? '' : 's'}`;
      nodes.fundingWalletBalance.textContent = `${formatTreeRaw(state.fundingWalletRaw, 2)} TREE`;
      nodes.fundingPoolState.textContent = state.fundingUnresolvedRoundCount > 0 ? 'Prior awards pending' : keeper.availableRaw >= DAILY_CHALLENGE_PRIZE_RAW ? 'Funded' : 'Funding needed';
      nodes.fundingPoolState.className = `data-state ${state.fundingUnresolvedRoundCount > 0 ? 'staged' : keeper.availableRaw >= DAILY_CHALLENGE_PRIZE_RAW ? 'live' : 'staged'}`;
      renderFundingAmount();
    } catch (error) {
      nodes.fundingPoolState.textContent = 'Unavailable';
      nodes.fundingPoolState.className = 'data-state error';
      nodes.fundingStatus.textContent = error instanceof Error ? error.message : 'Challenge funding balances could not be loaded.';
    } finally {
      state.fundingRefreshing = false;
    }
  }

  async function fundChallengePool() {
    const wallet = String(window.playerAddress || '').toLowerCase();
    if (state.fundingSubmitting) return;
    if (!isChallengeFundingWallet(wallet)) throw new Error('Connect the designated Challenge funding wallet.');
    if (!state.fundingQueueReady) throw new Error('Wait for the historical settlement queue check to finish.');
    const amountRaw = parseTreeFundingAmount(nodes.fundingAmount.value);
    if (amountRaw > state.fundingWalletRaw) throw new Error('The designated wallet does not have enough TREE for this deposit.');
    state.fundingSubmitting = true;
    renderFundingAmount();
    try {
      nodes.fundingStatus.textContent = 'Building and checking the exact prize-pool deposit…';
      const [{ Transaction }, client] = await Promise.all([
        import('https://esm.run/@mysten/sui@2.23.1/transactions'),
        typeof window.initSuiClient === 'function'
          ? window.initSuiClient()
          : Promise.reject(new Error('The Sui Mainnet client is unavailable.')),
      ]);
      const built = await buildChallengePoolFundingTransaction({ Transaction, client, owner: wallet, amountRaw });
      for (let pass = 0; pass < 2; pass += 1) {
        const simulation = await client.core.simulateTransaction({
          transaction: built.transaction,
          checksEnabled: true,
          include: { effects: true, events: true, balanceChanges: true },
        });
        if (!transactionSucceeded(simulation)) throw new Error(`The Challenge pool deposit failed Sui Mainnet safety check ${pass + 1}.`);
      }
      const display = formatTreeRaw(amountRaw, 6);
      const approved = await confirmTransaction(
        `Deposit ${display} TREE into the verified Challenge prize pool?\n\nPool: ${TREE_RAFFLE_PRIZE_POOL_ID}\nAvailable now: ${formatTreeRaw(state.fundingPoolRaw, 6)} TREE\nReserved for existing winners: ${formatTreeRaw(state.fundingReservedRaw, 6)} TREE\nOlder scored rounds awaiting settlement: ${state.fundingUnresolvedRoundCount}\nDaily prize: 50,000 TREE\n\nDeposited TREE may settle older awards first. The deposit transaction passed two Sui Mainnet simulations. This control cannot withdraw funds.`,
        { title: 'Fund Challenge Pool', confirmLabel: 'Continue to Wallet' },
      );
      if (!approved) {
        nodes.fundingStatus.textContent = 'Challenge funding cancelled before wallet approval.';
        return;
      }
      if (!isChallengeFundingWallet(window.playerAddress)) throw new Error('The connected wallet changed before approval.');
      if (typeof window.signAndExecuteTransactionBlock !== 'function') throw new Error('The connected wallet cannot sign this transaction.');
      nodes.fundingStatus.textContent = `Review the ${display} TREE deposit in your wallet…`;
      const submitted = await window.signAndExecuteTransactionBlock(built.transaction);
      const digest = transactionDigest(submitted);
      if (!digest) throw new Error('The wallet returned no transaction digest.');
      nodes.fundingStatus.textContent = 'Waiting for the Challenge funding transaction to finalize…';
      const finalized = await client.core.waitForTransaction({
        digest,
        timeout: 60_000,
        include: { effects: true, events: true, balanceChanges: true },
      });
      if (!transactionSucceeded(finalized)) throw new Error('The Challenge funding transaction did not finalize successfully.');
      nodes.fundingStatus.textContent = `${display} TREE deposited successfully · ${digest.slice(0, 8)}…${digest.slice(-6)}`;
      await refreshFundingBalances();
    } finally {
      state.fundingSubmitting = false;
      renderFundingAmount();
      renderFundingAccess();
    }
  }

  async function claimPrize(round = state.publicRound, statusNode = nodes.claimStatus) {
    const wallet = String(window.playerAddress || '').toLowerCase();
    const award = round?.award;
    const roundId = round?.roundId;
    if (state.claiming) return;
    if (!/^0x[0-9a-f]{64}$/.test(wallet) || award?.wallet !== wallet || !award?.claimable || !roundId) {
      throw new Error('Connect the winning wallet before claiming this prize.');
    }
    if (!state.config?.claimsEnabled || !state.contracts?.packageId || !state.contracts?.poolId) {
      throw new Error('Knowledge Trial prize claims are not active yet.');
    }
    state.claiming = true;
    updateWalletState();
    try {
      statusNode.textContent = 'Checking the prize claim before wallet approval…';
      const [{ Transaction }, client] = await Promise.all([
        import('https://esm.run/@mysten/sui@2.23.1/transactions'),
        typeof window.initSuiClient === 'function'
          ? window.initSuiClient()
          : Promise.reject(new Error('The Sui Mainnet client is unavailable.')),
      ]);
      const transaction = buildTreeRaffleBrowserClaim(Transaction, {
        packageId: state.contracts.packageId,
        poolId: state.contracts.poolId,
        onchainDrawId: award.onchainDrawId,
        tokenType: award.tokenType,
      });
      if (typeof transaction.setSender === 'function') transaction.setSender(wallet);
      const transactionBytes = await transaction.build({ client });
      const simulation = await client.core.simulateTransaction({
        transaction: transactionBytes,
        checksEnabled: true,
        include: { effects: true, events: true, balanceChanges: true },
      });
      if (!transactionSucceeded(simulation)) throw new Error('The 50,000 TREE claim did not pass the Sui Mainnet safety check.');
      if (!(await confirmTransaction('Claim your 50,000 TREE Knowledge Trial prize?', { title: 'Claim Knowledge Trial Prize' }))) return;
      if (typeof window.signAndExecuteTransactionBlock !== 'function') throw new Error('The connected wallet cannot sign this transaction.');
      statusNode.textContent = 'Review and approve the prize claim in your wallet.';
      const submitted = await window.signAndExecuteTransactionBlock(transaction);
      const digest = transactionDigest(submitted);
      if (!digest) throw new Error('The wallet returned no transaction digest.');
      statusNode.textContent = 'Waiting for the TREE prize claim to finalize…';
      const finalized = await client.core.waitForTransaction({
        digest,
        timeout: 60_000,
        include: { effects: true, events: true, balanceChanges: true },
      });
      if (!transactionSucceeded(finalized)) throw new Error('The TREE prize claim did not finalize successfully.');
      const response = await fetch(CLAIM_API, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ digest, wallet, roundId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.status !== 'ok') {
        throw new Error('The claim finalized, but its Knowledge Trial record has not reconciled yet. Keep the transaction digest and refresh shortly.');
      }
      statusNode.textContent = `50,000 TREE claimed successfully · ${digest.slice(0, 8)}…${digest.slice(-6)}`;
      await loadTrial();
    } finally {
      state.claiming = false;
      updateWalletState();
    }
  }

  async function startLiveChallenge() {
    const wallet = String(window.playerAddress || '');
    const roundId = state.publicRound?.roundId;
    if (!wallet) throw new Error('Connect your Sui wallet first.');
    if (!state.config?.publicAttemptsEnabled || !roundId) throw new Error('The daily challenge is not active yet.');
    nodes.startLive.disabled = true;
    setStatus('Checking your qualifying TREE purchase…');
    try {
      const requested = await post('challenge', { wallet, roundId });
      if (typeof window.signTreePersonalMessage !== 'function') throw new Error('This wallet cannot sign the required ownership message.');
      setStatus('Approve the wallet-ownership message. This does not move funds.');
      const signed = await window.signTreePersonalMessage(new TextEncoder().encode(requested.challenge.message));
      const started = await post('start', {
        wallet,
        challengeId: requested.challenge.challengeId,
        signature: signed.signature,
      });
      clearInterval(state.timerId);
      state.mode = 'live';
      state.attemptToken = started.attempt.attemptToken;
      state.questions = started.attempt.questions;
      state.answers.clear();
      state.current = 0;
      state.startedAt = Date.parse(started.attempt.startedAt);
      state.deadline = Date.parse(started.attempt.expiresAt);
      if (!Number.isFinite(state.startedAt) || !Number.isFinite(state.deadline) || state.deadline <= Date.now()) {
        throw new Error('The daily attempt window is invalid or already expired.');
      }
      state.running = true;
      state.submitting = false;
      nodes.modeLabel.textContent = 'SCORED DAILY ATTEMPT';
      nodes.title.textContent = 'TREE Knowledge Trial';
      nodes.practiceTab?.click();
      nodes.intro.hidden = true;
      nodes.result.hidden = true;
      nodes.form.hidden = false;
      nodes.timer.classList.remove('urgent');
      renderQuestion();
      updateTimer();
      state.timerId = setInterval(updateTimer, 250);
      setStatus('Your one scored daily attempt is running. Accuracy ranks first; speed ranks equal scores.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The daily challenge could not start.', 'error');
      throw error;
    } finally {
      nodes.startLive.disabled = false;
    }
  }

  async function startSuddenDeath() {
    const wallet = String(window.playerAddress || '');
    const roundId = state.publicRound?.roundId;
    const stage = Number(state.publicRound?.tiebreakStage);
    if (!wallet) throw new Error('Connect your Sui wallet first.');
    if (!state.config?.publicAttemptsEnabled || state.publicRound?.state !== 'tiebreak' || !roundId || !Number.isInteger(stage)) {
      throw new Error('Sudden death is not active yet.');
    }
    nodes.startLive.disabled = true;
    setStatus('Checking your sudden-death eligibility…');
    try {
      const requested = await post('tiebreak-challenge', { wallet, roundId, stage });
      if (typeof window.signTreePersonalMessage !== 'function') throw new Error('This wallet cannot sign the required ownership message.');
      setStatus('Approve the wallet-ownership message. This does not move funds.');
      const signed = await window.signTreePersonalMessage(new TextEncoder().encode(requested.challenge.message));
      const started = await post('tiebreak-start', {
        wallet,
        challengeId: requested.challenge.challengeId,
        signature: signed.signature,
      });
      clearInterval(state.timerId);
      state.mode = 'tiebreak';
      state.attemptToken = started.attempt.attemptToken;
      state.questions = started.attempt.questions;
      state.answers.clear();
      state.current = 0;
      state.startedAt = Date.parse(started.attempt.startedAt);
      state.deadline = Date.parse(started.attempt.expiresAt);
      if (!Number.isFinite(state.startedAt) || !Number.isFinite(state.deadline) || state.deadline <= Date.now()) {
        throw new Error('The sudden-death window is invalid or already expired.');
      }
      state.running = true;
      state.submitting = false;
      nodes.modeLabel.textContent = `SUDDEN DEATH · STAGE ${started.attempt.stage}`;
      nodes.title.textContent = 'One Question. Accuracy, Then Speed.';
      nodes.practiceTab?.click();
      nodes.intro.hidden = true;
      nodes.result.hidden = true;
      nodes.form.hidden = false;
      nodes.timer.classList.remove('urgent');
      renderQuestion();
      updateTimer();
      state.timerId = setInterval(updateTimer, 250);
      setStatus('Your 30-second sudden-death question is running. Submit one answer before time expires.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Sudden death could not start.', 'error');
      throw error;
    } finally {
      nodes.startLive.disabled = false;
    }
  }

  async function submitCurrent(timedOut = false) {
    if (!state.running || state.submitting) return;
    state.submitting = true;
    state.running = false;
    clearInterval(state.timerId);
    const elapsedMs = Math.min(Date.now() - state.startedAt, state.deadline - state.startedAt);
    nodes.timer.textContent = formatTime(Math.max(0, state.deadline - Date.now()));
    nodes.submit.disabled = true;
    setStatus(timedOut
      ? 'Time expired. Scoring the answers submitted so far…'
      : state.mode === 'live' ? 'Recording your daily result…' : 'Scoring the practice trial…');
    try {
      const payload = state.mode === 'live' || state.mode === 'tiebreak'
        ? await post(state.mode === 'tiebreak' ? 'tiebreak-submit' : 'submit', {
          attemptToken: state.attemptToken,
          answers: Array.from(state.answers, ([questionId, optionId]) => ({ questionId, optionId })),
        })
        : await post('practice-submit', {
          answers: Array.from(state.answers, ([questionId, optionId]) => ({ questionId, optionId })),
          elapsedMs,
        });
      nodes.form.hidden = true;
      nodes.result.replaceChildren(state.mode === 'live' || state.mode === 'tiebreak' ? liveResultFeedback(payload) : resultFeedback(payload));
      nodes.result.hidden = false;
      setStatus(state.mode === 'live' || state.mode === 'tiebreak'
        ? state.mode === 'tiebreak'
          ? 'Sudden-death result verified and recorded. The resolver will determine whether one leader remains.'
          : 'Daily result verified and recorded. Your score and time are locked for this round; one winner will be selected after the round closes.'
        : 'Practice result verified by the server. It was not recorded as a public entry.', 'success');
      if (state.mode === 'live' || state.mode === 'tiebreak') {
        await refreshPublicSnapshot({ refreshEligibility: true });
      }
    } catch (error) {
      state.running = true;
      setStatus(error instanceof Error ? error.message : 'The practice trial could not be scored.', 'error');
    } finally {
      state.submitting = false;
      nodes.submit.disabled = false;
    }
  }

  nodes.shortcut?.addEventListener('click', () => {
    nodes.practiceTab?.click();
    nodes.card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  nodes.start?.addEventListener('click', startPractice);
  nodes.checkEligibility?.addEventListener('click', () => checkEligibility());
  nodes.startLive?.addEventListener('click', () => {
    const starter = state.publicRound?.state === 'tiebreak' ? startSuddenDeath : startLiveChallenge;
    starter().catch(() => {});
  });
  nodes.claim?.addEventListener('click', () => claimPrize().catch((error) => {
    nodes.claimStatus.textContent = error instanceof Error ? error.message : 'The prize claim could not be completed.';
  }));
  nodes.fundingPresets.forEach((preset) => preset.addEventListener('click', () => {
    const amount = preset.dataset.knowledgeFundingAmount;
    nodes.fundingAmount.value = amount;
    nodes.fundingPresets.forEach((candidate) => candidate.classList.toggle('active', candidate === preset));
    renderFundingAmount();
  }));
  nodes.fundingAmount?.addEventListener('input', () => {
    nodes.fundingPresets.forEach((preset) => preset.classList.toggle('active', preset.dataset.knowledgeFundingAmount === nodes.fundingAmount.value.replace(/,/g, '')));
    renderFundingAmount();
  });
  nodes.fundingSubmit?.addEventListener('click', () => fundChallengePool().catch((error) => {
    nodes.fundingStatus.textContent = error instanceof Error ? error.message : 'The Challenge pool could not be funded.';
  }));
  nodes.previous?.addEventListener('click', () => { if (state.current > 0) { state.current -= 1; renderQuestion(); } });
  nodes.next?.addEventListener('click', () => { if (state.current < state.questions.length - 1) { state.current += 1; renderQuestion(); } });
  nodes.form?.addEventListener('submit', (event) => { event.preventDefault(); submitCurrent(false); });
  window.addEventListener('tree:wallet-changed', () => {
    state.eligibilityResult = null;
    state.eligibilityWallet = '';
    updateWalletState();
    renderActivity();
    if (window.playerAddress && state.publicRound?.roundId) checkEligibility({ automatic: true });
    if (isChallengeFundingWallet(window.playerAddress)) refreshFundingBalances();
  });
  window.addEventListener('tree:qualifying-purchase-submitted', (event) => {
    selectTab(nodes.passTab);
    nodes.eligibility.className = 'knowledge-eligibility checking';
    nodes.eligibility.textContent = 'Purchase finalized. Verifying it independently for Challenge eligibility now.';
    verifySubmittedPurchase(event.detail).catch(() => {});
  });
  window.addEventListener('beforeunload', () => clearInterval(state.timerId));

  updateWalletState();
  renderFundingAmount();
  if (isChallengeFundingWallet(window.playerAddress)) refreshFundingBalances();
  loadTrial();
}
