import { buildTreeRaffleBrowserClaim } from '../dapp/raffle-transaction-core.js';
import { confirmTransaction } from '../dapp/transaction-review.js';

const root = document.getElementById('canopy-draw');

if (root) {
  const API = '/api/tree-knowledge-trial';
  const nodes = {
    meta: root.querySelector('#knowledgeTrialMeta'),
    state: root.querySelector('#knowledgeTrialState'),
    practiceTab: root.querySelector('#raffleWeeklyTab'),
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
    previous: root.querySelector('#knowledgeTrialPrevious'),
    next: root.querySelector('#knowledgeTrialNext'),
    submit: root.querySelector('#knowledgeTrialSubmit'),
    result: root.querySelector('#knowledgeTrialResult'),
    status: root.querySelector('#knowledgeTrialStatus'),
    passState: root.querySelector('#knowledgeTrialPassState'),
    passCopy: root.querySelector('#knowledgeTrialPassCopy'),
    startLive: root.querySelector('#knowledgeTrialStartLive'),
    activation: root.querySelector('#knowledgeTrialActivation'),
    claim: root.querySelector('#knowledgeTrialClaimPrize'),
    claimStatus: root.querySelector('#knowledgeTrialClaimStatus'),
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
  };

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
    nodes.startLive.textContent = suddenDeathReady ? 'Start Sudden Death' : 'Start Daily Challenge';
    nodes.startLive.hidden = !liveReady;
    if (suddenDeathReady) nodes.startLive.hidden = false;
    nodes.startLive.disabled = !wallet;
    nodes.claim.hidden = !canClaim;
    nodes.claim.disabled = state.claiming;
    if (isWinner && award?.claimed) {
      nodes.passState.textContent = 'Prize claimed';
      nodes.passCopy.textContent = 'Your 50,000 TREE Knowledge Trial prize has been claimed and reconciled on Sui.';
    } else if (canClaim) {
      nodes.passState.textContent = 'You won';
      nodes.passCopy.textContent = 'Your 50,000 TREE prize is reserved in the on-chain prize pool. Claim it with the winning wallet.';
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
      nodes.passState.textContent = 'Framework ready';
      nodes.passCopy.textContent = `Connected wallet ${wallet.slice(0, 6)}…${wallet.slice(-4)}. Public purchase verification and Challenge Pass issuance remain disabled.`;
    } else {
      nodes.passState.textContent = 'Not active';
      nodes.passCopy.textContent = 'Connect a wallet to prepare for eligibility checks. Production passes are not being issued yet.';
    }
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

  async function loadTrial() {
    try {
      const response = await fetch(`${API}?action=status`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || payload.status !== 'ok' || !Array.isArray(payload.practice?.questions)) throw new Error('Trial framework unavailable.');
      state.config = payload.trial;
      state.publicRound = payload.publicRound;
      state.contracts = payload.contracts;
      state.practiceQuestions = payload.practice.questions;
      state.questions = state.practiceQuestions;
      nodes.meta.textContent = `Framework ${payload.trial.version} · ${payload.trial.questionCount} questions · $${(payload.trial.minimumQualifyingUsdCents / 100).toFixed(2)} qualifying purchase planned`;
      const publicTiming = roundWindowState(payload.publicRound);
      const publicActive = payload.trial.publicAttemptsEnabled && publicTiming === 'active';
      nodes.state.textContent = publicActive ? 'Active' : payload.trial.publicAttemptsEnabled && publicTiming === 'scheduled' ? 'Scheduled' : 'Building';
      nodes.state.className = `data-state ${publicActive ? 'live' : 'staged'}`;
      nodes.timer.textContent = formatTime(payload.trial.durationSeconds * 1_000);
      nodes.start.disabled = false;
      renderActivation(payload.trial);
      updateWalletState();
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
    nodes.progress.textContent = `Question ${state.current + 1} of ${state.questions.length}`;
    nodes.answered.textContent = `${state.answers.size} answered`;
    nodes.progressBar.style.width = `${((state.current + 1) / state.questions.length) * 100}%`;
    nodes.previous.disabled = state.current === 0;
    nodes.next.hidden = state.current === state.questions.length - 1;
    nodes.submit.hidden = state.current !== state.questions.length - 1;
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
      : 'Your verified daily result is recorded. The one daily winner is determined after the round closes; exact leaders advance to sudden death.';
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
    const status = value?.effects?.status?.status ?? value?.effects?.status ?? value?.transaction?.effects?.status?.status;
    return String(status || '').toLowerCase() === 'success';
  }

  async function claimPrize() {
    const wallet = String(window.playerAddress || '').toLowerCase();
    const award = state.publicRound?.award;
    const roundId = state.publicRound?.roundId;
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
      nodes.claimStatus.textContent = 'Checking the prize claim before wallet approval…';
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
      const simulation = await client.core.simulateTransaction({
        transaction,
        checksEnabled: true,
        include: { effects: true, events: true, balanceChanges: true },
      });
      if (!transactionSucceeded(simulation)) throw new Error('The 50,000 TREE claim did not pass the Sui Mainnet safety check.');
      if (!(await confirmTransaction('Claim your 50,000 TREE Knowledge Trial prize?', { title: 'Claim Knowledge Trial Prize' }))) return;
      if (typeof window.signAndExecuteTransactionBlock !== 'function') throw new Error('The connected wallet cannot sign this transaction.');
      nodes.claimStatus.textContent = 'Review and approve the prize claim in your wallet.';
      const submitted = await window.signAndExecuteTransactionBlock(transaction);
      const digest = transactionDigest(submitted);
      if (!digest) throw new Error('The wallet returned no transaction digest.');
      nodes.claimStatus.textContent = 'Waiting for the TREE prize claim to finalize…';
      const finalized = await client.core.waitForTransaction({
        digest,
        timeout: 60_000,
        include: { effects: true, events: true, balanceChanges: true },
      });
      if (!transactionSucceeded(finalized)) throw new Error('The TREE prize claim did not finalize successfully.');
      const response = await fetch('/api/tree-knowledge-trial-claim', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ digest, wallet, roundId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.status !== 'ok') {
        throw new Error('The claim finalized, but its Knowledge Trial record has not reconciled yet. Keep the transaction digest and refresh shortly.');
      }
      nodes.claimStatus.textContent = `50,000 TREE claimed successfully · ${digest.slice(0, 8)}…${digest.slice(-6)}`;
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
          : 'Daily result verified and recorded. One winner will be selected after the round closes.'
        : 'Practice result verified by the server. It was not recorded as a public entry.', 'success');
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
  nodes.startLive?.addEventListener('click', () => {
    const starter = state.publicRound?.state === 'tiebreak' ? startSuddenDeath : startLiveChallenge;
    starter().catch(() => {});
  });
  nodes.claim?.addEventListener('click', () => claimPrize().catch((error) => {
    nodes.claimStatus.textContent = error instanceof Error ? error.message : 'The prize claim could not be completed.';
  }));
  nodes.previous?.addEventListener('click', () => { if (state.current > 0) { state.current -= 1; renderQuestion(); } });
  nodes.next?.addEventListener('click', () => { if (state.current < state.questions.length - 1) { state.current += 1; renderQuestion(); } });
  nodes.form?.addEventListener('submit', (event) => { event.preventDefault(); submitCurrent(false); });
  window.addEventListener('tree:wallet-changed', updateWalletState);
  window.addEventListener('beforeunload', () => clearInterval(state.timerId));

  updateWalletState();
  loadTrial();
}
