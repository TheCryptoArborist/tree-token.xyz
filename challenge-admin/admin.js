const API = '/api/tree-knowledge-trial-admin';
const dailyRoot = document.getElementById('dailyQuestions');
const tiebreakRoot = document.getElementById('tiebreakQuestions');
const form = document.getElementById('draftForm');
const statusNode = document.getElementById('adminStatus');
const secretNode = document.getElementById('adminSecret');
const dateNode = document.getElementById('roundDate');
const prepareButton = document.getElementById('prepareDraft');
const checkButton = document.getElementById('checkDraft');
const addButton = document.getElementById('addTiebreak');
const reviewConfirmedNode = document.getElementById('reviewConfirmed');
const scheduleButton = document.getElementById('scheduleRound');
let currentSetup = null;

function setStatus(message, kind = '') {
  statusNode.textContent = message;
  statusNode.className = `status${kind ? ` ${kind}` : ''}`;
}

function tomorrowUtc() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function questionCard(kind, index) {
  const article = document.createElement('article');
  article.className = 'question-card';
  article.dataset.kind = kind;
  article.innerHTML = `
    <div class="question-title"><strong>${kind === 'daily' ? 'Daily' : 'Tie-break'} Question ${index + 1}</strong>${kind === 'tiebreak' && index >= 3 ? '<button class="remove" type="button">Remove</button>' : ''}</div>
    <div class="question-grid">
      <label class="wide">Question prompt<textarea data-field="prompt" maxlength="500" required></textarea></label>
      <div class="options wide">
        ${['A', 'B', 'C', 'D'].map((label, optionIndex) => `<label>Answer ${label}<input data-option="${optionIndex}" maxlength="300" required></label>`).join('')}
      </div>
      <label>Correct answer<select data-field="correct"><option value="a">A</option><option value="b">B</option><option value="c">C</option><option value="d">D</option></select></label>
      <label>Private explanation<input data-field="explanation" maxlength="1000" required></label>
    </div>`;
  article.querySelector('.remove')?.addEventListener('click', () => {
    article.remove();
    relabel(tiebreakRoot, 'tiebreak');
  });
  return article;
}

function relabel(root, kind) {
  [...root.children].forEach((card, index) => {
    card.querySelector('.question-title strong').textContent = `${kind === 'daily' ? 'Daily' : 'Tie-break'} Question ${index + 1}`;
  });
}

function addQuestion(root, kind) {
  root.append(questionCard(kind, root.children.length));
}

function readQuestions(root, prefix) {
  return [...root.children].map((card, index) => ({
    id: `${prefix}-${index + 1}`,
    prompt: card.querySelector('[data-field="prompt"]').value.trim(),
    options: [...card.querySelectorAll('[data-option]')].map((input, optionIndex) => ({
      id: ['a', 'b', 'c', 'd'][optionIndex],
      label: input.value.trim(),
    })),
    correctOptionId: card.querySelector('[data-field="correct"]').value,
    explanation: card.querySelector('[data-field="explanation"]').value.trim(),
  }));
}

function credentials() {
  const secret = secretNode.value.trim();
  const roundDate = dateNode.value;
  if (secret.length < 32) throw new Error('Enter the configured admin secret (at least 32 characters).');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(roundDate)) throw new Error('Choose a valid UTC round date.');
  return { secret, roundDate };
}

function renderSetup(setup) {
  currentSetup = setup;
  const ready = Boolean(setup?.readyForReview && setup?.state === 'draft');
  reviewConfirmedNode.disabled = !ready;
  if (!ready) reviewConfirmedNode.checked = false;
  scheduleButton.disabled = !ready || !reviewConfirmedNode.checked;
}

async function responsePayload(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.status !== 'ok') throw new Error(payload.message || (response.status === 401 ? 'The admin secret was not accepted.' : 'The draft request failed.'));
  return payload;
}

async function checkDraft() {
  const { secret, roundDate } = credentials();
  checkButton.disabled = true;
  setStatus('Checking the private draft ledger…');
  try {
    const response = await fetch(`${API}?roundDate=${encodeURIComponent(roundDate)}`, {
      headers: { Accept: 'application/json', 'x-tree-knowledge-admin-secret': secret },
      cache: 'no-store',
    });
    const payload = await responsePayload(response);
    renderSetup(payload.setup);
    if (!payload.setup) setStatus(`No draft exists for ${roundDate}.`, 'success');
    else setStatus(`${payload.setup.roundId} is ${payload.setup.state}: ${payload.setup.dailyQuestionCount} daily + ${payload.setup.tiebreakQuestionCount} tie-break questions.`, payload.setup.readyForReview || payload.setup.state === 'open' ? 'success' : '');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'The draft could not be checked.', 'error');
  } finally {
    checkButton.disabled = false;
  }
}

async function prepareDraft(event) {
  event.preventDefault();
  if (!form.reportValidity()) return;
  let credentialsValue;
  try { credentialsValue = credentials(); } catch (error) { setStatus(error.message, 'error'); return; }
  const body = {
    roundDate: credentialsValue.roundDate,
    questions: readQuestions(dailyRoot, 'daily'),
    tiebreakQuestions: readQuestions(tiebreakRoot, 'tie'),
  };
  prepareButton.disabled = true;
  setStatus('Validating questions and preparing the private draft…');
  try {
    const response = await fetch(API, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-tree-knowledge-admin-secret': credentialsValue.secret,
      },
      body: JSON.stringify(body),
    });
    const payload = await responsePayload(response);
    renderSetup(payload.setup);
    setStatus(`${payload.setup.roundId} is prepared as a draft with ${payload.setup.dailyQuestionCount} daily and ${payload.setup.tiebreakQuestionCount} tie-break questions. It is not open to the public.`, 'success');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'The draft could not be prepared.', 'error');
  } finally {
    prepareButton.disabled = false;
  }
}

async function scheduleRound() {
  let credentialsValue;
  try { credentialsValue = credentials(); } catch (error) { setStatus(error.message, 'error'); return; }
  if (!currentSetup?.readyForReview || currentSetup.state !== 'draft' || !reviewConfirmedNode.checked) {
    setStatus('Check the draft and confirm the review before scheduling.', 'error');
    return;
  }
  scheduleButton.disabled = true;
  setStatus('Scheduling the reviewed private round…');
  try {
    const response = await fetch(API, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-tree-knowledge-admin-secret': credentialsValue.secret,
      },
      body: JSON.stringify({ action: 'schedule', roundDate: credentialsValue.roundDate, reviewConfirmed: true }),
    });
    const payload = await responsePayload(response);
    renderSetup(payload.setup);
    setStatus(`${payload.setup.roundId} is scheduled for ${payload.setup.challengeOpensAt}. Public attempts and prize movement remain separately gated.`, 'success');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'The reviewed round could not be scheduled.', 'error');
    scheduleButton.disabled = false;
  }
}

dateNode.value = tomorrowUtc();
for (let index = 0; index < 5; index += 1) addQuestion(dailyRoot, 'daily');
for (let index = 0; index < 3; index += 1) addQuestion(tiebreakRoot, 'tiebreak');
addButton.addEventListener('click', () => {
  if (tiebreakRoot.children.length >= 10) return setStatus('A draft can contain at most ten sudden-death questions.', 'error');
  addQuestion(tiebreakRoot, 'tiebreak');
});
checkButton.addEventListener('click', checkDraft);
form.addEventListener('submit', prepareDraft);
reviewConfirmedNode.addEventListener('change', () => renderSetup(currentSetup));
scheduleButton.addEventListener('click', scheduleRound);
