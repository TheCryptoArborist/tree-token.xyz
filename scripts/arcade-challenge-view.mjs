// Presentation only: card choices and status always come from the pilot service.
const safeText = value => typeof value === 'string' ? value : '';
const shortWallet = value => typeof value === 'string' && value.length > 16 ? `${value.slice(0,8)}…${value.slice(-6)}` : safeText(value);
const finite = value => Number.isFinite(value) ? value : 0;
const labelCase = value => safeText(value) ? safeText(value).slice(0,1).toUpperCase() + safeText(value).slice(1) : '';
const effectLabels = status => {
  if (!status) return 'No active effects';
  const labels = [];
  if (status.blockTurns > 0) labels.push(`Block ×${status.blockTurns}`);
  if (status.poisonTicks > 0) labels.push(`Blight: ${status.poisonTicks} turns`);
  if (status.delayedGrowthLoss > 0) labels.push(`Pending Growth loss: ${status.delayedGrowthLoss}`);
  if (status.reflectedGrowth > 0) labels.push(`Reflect ${status.reflectedGrowth}`);
  if (status.armorHalvesNextHit) labels.push('Next hit halved');
  if (status.nextAttackCap > 0) labels.push(`Next hit capped at ${status.nextAttackCap}`);
  return labels.join(' · ') || 'No active effects';
};
export function formatChallengeTime(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const total = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(total / 60).toString().padStart(2,'0')}:${(total % 60).toString().padStart(2,'0')}`;
}
function utcLabel(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'UTC'}).format(date) + ' UTC' : '';
}

export function mountChallengeView(root, {onStart,onMove,onRetry,onRefresh,onSignIn,onWalletSelect} = {}) {
  if (!root?.querySelector) throw new TypeError('A challenge root is required.');
  const doc = root.ownerDocument;
  const el = name => root.querySelector('#challenge-' + name);
  const handlers = [];
  const cards = new Map();
  const walletButtons = new Map();
  let previousLog = '';
  let actionFocus = null;
  let disposed = false;
  function listen(node, type, handler) {
    if (!node) return;
    node.addEventListener(type,handler);
    handlers.push(() => node.removeEventListener(type,handler));
  }
  function write(name, value) {
    const node = el(name);
    const text = String(value ?? '');
    if (node && node.textContent !== text) node.textContent = text;
  }
  function show(name, visible) { const node = el(name); if (node) node.hidden = !visible; }
  listen(el('start'),'click',() => { actionFocus = 'start'; onStart?.(); });
  listen(el('sign-in'),'click',() => onSignIn?.());
  listen(el('retry'),'click',() => { actionFocus = 'retry'; onRetry?.(); });
  listen(el('refresh'),'click',() => onRefresh?.());
  listen(el('hand'),'click',event => {
    const button = event.target.closest('button[data-move-id]');
    if (button && !button.disabled && el('hand').contains(button)) { actionFocus = button.dataset.moveId; onMove?.(Number(button.dataset.moveId)); }
  });
  listen(el('wallet-options'),'click',event => {
    const button = event.target.closest('button[data-wallet-id]');
    if (button && !button.disabled && el('wallet-options').contains(button)) onWalletSelect?.(button.dataset.walletId);
  });
  function updateCards(view, model) {
    const hand = el('hand');
    const visibleCards = Array.isArray(view.cards) ? view.cards.slice(0,4) : [];
    const currentIds = new Set(visibleCards.map(card => String(card.id)));
    for (const [id, card] of cards) if (!currentIds.has(id)) { card.button.remove(); cards.delete(id); }
    visibleCards.forEach((card,index) => {
      const id = String(card.id);
      let ui = cards.get(id);
      if (!ui) {
        const button = doc.createElement('button'); button.type = 'button'; button.className = 'challenge-card'; button.dataset.moveId = id;
        const top = doc.createElement('span'); top.className = 'challenge-card-top';
        const type = doc.createElement('span'); type.className = 'challenge-card-type';
        const symbol = doc.createElement('span'); symbol.className = 'challenge-card-symbol'; symbol.setAttribute('aria-hidden','true');
        const name = doc.createElement('span'); name.className = 'challenge-card-name';
        const description = doc.createElement('span'); description.className = 'challenge-card-description';
        const action = doc.createElement('span'); action.className = 'challenge-card-action';
        const actionText = doc.createElement('span');
        const arrow = doc.createElement('span'); arrow.textContent = '→'; arrow.setAttribute('aria-hidden','true');
        top.append(type,symbol); action.append(actionText,arrow); button.append(top,name,description,action); hand.append(button);
        ui = {button,type,symbol,name,description,actionText,arrow}; cards.set(id,ui);
      }
      if (hand.children[index] !== ui.button) hand.insertBefore(ui.button,hand.children[index] || null);
      const legal = card.playable === true && Array.isArray(view.legalMoveIds) && view.legalMoveIds.includes(card.id);
      const playable = legal && model.phase === 'playing' && !model.busy && !model.retryable;
      const cardType = ['attack','growth','hybrid'].includes(card.type) ? card.type : 'growth';
      ui.button.dataset.type = cardType;
      ui.button.disabled = !playable;
      ui.type.textContent = cardType;
      ui.symbol.textContent = {growth:'↗',attack:'↘',hybrid:'◇'}[cardType];
      ui.name.textContent = safeText(card.name);
      ui.description.textContent = safeText(card.description);
      ui.actionText.textContent = ['finished','expired'].includes(model.phase) ? 'Match ended'
        : model.phase === 'closed' ? 'Pilot closed'
        : model.phase === 'session-changed' ? 'Session changed'
        : model.phase === 'signed-out' ? 'Sign in to play'
        : model.phase === 'error' ? 'Refresh match'
        : model.busy || model.phase === 'pending' || model.retryable ? 'Waiting'
        : legal ? 'Play card' : 'Unavailable';
      ui.arrow.textContent = playable ? '→' : '—';
      ui.button.setAttribute('aria-label',`${safeText(card.name)}. ${labelCase(cardType)}. ${safeText(card.description)} ${ui.actionText.textContent}.`);
    });
  }
  function updateLog(view) {
    const entries = Array.isArray(view.lastRound) ? view.lastRound : [];
    const key = JSON.stringify(entries);
    if (key === previousLog) return;
    previousLog = key;
    const nodes = entries.map(entry => {
      const li = doc.createElement('li');
      const actor = ['you','player','player1'].includes(entry.actor) ? 'You' : entry.actor === 'round' ? 'Round effect' : 'Garden Bot';
      li.dataset.actor = actor === 'You' ? 'player' : actor === 'Garden Bot' ? 'bot' : 'round';
      const title = doc.createElement('strong');
      const moveName = safeText(entry.label) || (actor === 'You' ? safeText(view.cards?.find(card => card.id === entry.moveId)?.name) : '');
      title.textContent = `${actor}${moveName ? ' · ' + moveName : ''}`;
      const content = doc.createElement('p');
      content.textContent = Array.isArray(entry.details) ? entry.details.filter(value => typeof value === 'string').join(' ') : '';
      li.append(title,content);
      return li;
    });
    if (!nodes.length) { const li = doc.createElement('li'); li.className = 'challenge-log-empty'; li.textContent = 'Your moves and Garden Bot’s responses will appear here.'; nodes.push(li); }
    el('round-log').replaceChildren(...nodes);
  }
  function updateWallets(model) {
    const list = Array.isArray(model.wallets) ? model.wallets : [];
    const ids = new Set();
    list.forEach(wallet => {
      const id = safeText(wallet.id || wallet.walletId); if (!id) return;
      ids.add(id);
      let button = walletButtons.get(id);
      if (!button) { button = doc.createElement('button'); button.type = 'button'; button.className = 'challenge-button challenge-button--secondary'; button.dataset.walletId = id; el('wallet-options').append(button); walletButtons.set(id,button); }
      button.textContent = safeText(wallet.name || wallet.walletName) || 'Sui wallet';
      button.disabled = Boolean(model.busy);
    });
    for (const [id,button] of walletButtons) if (!ids.has(id)) {button.remove();walletButtons.delete(id);}
    show('wallet-picker',Boolean(model.pickerOpen));
    write('wallet-hint',model.walletHint || (list.length ? 'Connect and approve one free pilot sign-in message. No NFTree, purchase or gas fee is required.' : 'No compatible Sui wallet was detected. Open this page in a browser with your Sui wallet, then refresh.'));
  }
  function restoreActionFocus(model) {
    if (!actionFocus || model.busy) return;
    let target;
    if (model.phase === 'playing') {
      const choices = Array.from(el('hand').querySelectorAll('button'));
      const previous = choices.findIndex(button => button.dataset.moveId === actionFocus);
      target = [...choices.slice(previous + 1),...choices.slice(0,previous + 1)].find(button => !button.disabled);
    } else if (['finished','expired'].includes(model.phase)) target = el('result');
    else if (model.retryable && model.session) target = el('retry');
    else if (model.canStart) target = el('start');
    else if (!model.session) target = el('sign-in');
    else target = el('refresh');
    if (target && !target.hidden && !target.disabled) target.focus({preventScroll:true});
    actionFocus = null;
  }
  function render(model = {}) {
    if (disposed) return;
    const phase = model.phase || 'loading';
    const attempt = model.attempt;
    const view = attempt?.view;
    const rules = model.configuration?.rules;
    const challenge = model.challenge;
    const busy = Boolean(model.busy);
    const session = model.session;
    const ended = ['finished','expired'].includes(phase);
    root.dataset.phase = phase;
    root.setAttribute('aria-busy',String(busy));
    write('environment',model.environmentLabel || '');
    show('environment',Boolean(model.environmentLabel));
    write('session-heading',session ? `${session.walletName || 'Sui wallet'} · ${shortWallet(session.wallet)}` : phase === 'loading' ? 'Loading your free pilot sign-in…' : 'Sign in to the free pilot');
    write('session-note',session ? session.sessionScope === 'challenge-pilot' ? 'Free pilot sign-in active · No NFTree or transaction needed.' : 'Existing Arcade sign-in reused · Free pilot play.' : 'One free sign-in message · No NFTree required.');
    el('session-heading').title = session?.wallet || '';
    el('session-dot').dataset.connected = String(Boolean(session));
    show('sign-in',!session && phase !== 'loading');
    write('sign-in',model.signInLabel || (busy ? 'Connecting…' : 'Sign in to play'));
    el('sign-in').disabled = busy;
    updateWallets(model);
    write('notice',model.notice || '');
    el('notice').dataset.kind = model.noticeKind || '';
    const canStart = typeof model.canStart === 'boolean' ? model.canStart && !busy
      : Boolean(session && model.configuration?.pilotOpen && model.storageAvailable !== false && !busy && !model.retryable && (phase === 'ready' || ended || phase === 'session-changed'));
    show('launch',!view || ended || phase === 'session-changed' || canStart);
    el('start').disabled = !canStart;
    show('start',phase !== 'signed-out' && Boolean(session || phase === 'loading'));
    write('start',model.startLabel || (phase === 'loading' ? 'Loading challenge…' : busy ? 'Please wait…' : phase === 'session-changed' ? 'Start a new match' : ended ? 'Start another match' : phase === 'closed' ? 'Pilot is closed' : 'Start free test match'));
    write('start-note',model.storageAvailable === false ? 'Allow browser storage to save and resume a match.' : session ? 'Four standard cards. No paid advantages.' : 'Sign in above to begin a free test match.');
    write('objective-note',challenge?.description || 'Reach the target Growth before Garden Bot. Your hand is dealt when the match starts.');
    if (rules?.maxAttemptSeconds) write('time-rule',`Each match allows up to ${Math.ceil(rules.maxAttemptSeconds / 60)} minutes and 100 moves. It ends sooner if the pilot closes or your original sign-in session expires.`);
    const start = utcLabel(rules?.window?.startsAt); const end = utcLabel(rules?.window?.endsAt);
    write('window',start && end ? `Pilot window: ${start} to ${end}.` : '');
    show('window',Boolean(start && end));
    write('special-rule',challenge?.ruleDescription ? `This match: ${challenge.ruleDescription}` : '');
    show('special-rule',Boolean(challenge?.ruleDescription));
    show('board',Boolean(view));
    show('retry',Boolean(model.retryable && session));
    el('retry').disabled = busy;
    write('retry',busy ? 'Checking your move…' : 'Retry the same move');
    show('refresh',Boolean(view || phase === 'error' || phase === 'closed'));
    el('refresh').disabled = busy || Boolean(model.retryable);
    write('refresh',view ? 'Refresh match' : 'Check availability');
    if (!view) { restoreActionFocus(model); return; }
    write('match-title',challenge?.title || 'Arborist Trials');
    write('match-subtitle',challenge?.subtitle || 'Four standard cards · First to the target Growth wins');
    write('round',ended ? `Played ${view.moveCount} ${view.moveCount === 1 ? 'move' : 'moves'}` : `Round ${view.round}`);
    write('time',formatChallengeTime(model.remainingSeconds));
    el('timer').dataset.urgent = String(Number.isFinite(model.remainingSeconds) && model.remainingSeconds <= 60);
    const target = Math.max(1,finite(view.targetGrowth));
    for (const who of ['player','bot']) {
      const growth = finite(view[who + 'Growth']);
      write(who+'-growth',growth); write(who+'-target',target);
      const meter = el(who+'-meter');
      meter.setAttribute('aria-valuemax',String(target));
      meter.setAttribute('aria-valuenow',String(Math.max(0,Math.min(target,growth))));
      meter.setAttribute('aria-valuetext',`${growth} of ${target} Growth`);
      meter.firstElementChild.style.width = `${Math.max(0,Math.min(100,growth / target * 100))}%`;
      write(who+'-effects',effectLabels(view[who+'Status']));
    }
    write('forecast',view.forecast ? `Diagnosis forecast: Garden Bot’s next card is ${labelCase(view.forecast)}.` : '');
    show('forecast',Boolean(view.forecast) && !ended);
    write('moves',`${view.moveCount} / ${view.maxMoves || 100} moves`);
    write('hand-title',ended ? 'Your four-card hand' : model.retryable ? 'Confirm your last move' : busy ? 'Resolving the round…' : 'Choose your card');
    write('hand-note',ended ? 'This match has ended. Your final hand is shown below.' : model.retryable ? 'Retry the same move below before making another choice.' : 'The server resolves your move and Garden Bot’s response.');
    updateCards(view,model);
    updateLog(view);
    write('log-round',view.moveCount ? `After move ${view.moveCount}` : 'Waiting for your first move');
    show('result',ended);
    if (ended) {
      const outcome = phase === 'expired' ? 'expired' : view.phase;
      el('result').dataset.outcome = outcome;
      const win = outcome === 'won';
      write('result-eyebrow',outcome === 'expired' ? 'ATTEMPT CLOSED' : 'MATCH COMPLETE');
      write('result-title',win ? 'Canopy claimed!' : outcome === 'expired' ? 'This match has expired' : outcome === 'move-limit' ? 'Move limit reached' : 'Garden Bot takes this round');
      write('result-copy',win ? 'You reached the Growth target. The server has confirmed your test result.' : outcome === 'expired' ? 'The time limit, pilot window, or original sign-in has ended. This attempt can no longer accept moves.' : outcome === 'move-limit' ? 'The match ended after 100 moves without a completed win.' : 'Your result is saved. Try a fresh hand and adjust your strategy.');
      const score = attempt.result?.score;
      write('result-score',Number.isSafeInteger(score) && phase !== 'expired' ? `Practice score: ${score.toLocaleString('en-US')}` : '');
      show('result-score',Number.isSafeInteger(score) && phase !== 'expired');
    }
    restoreActionFocus(model);
  }
  return {render,destroy() { if (disposed) return; disposed = true; handlers.splice(0).forEach(off => off()); cards.clear(); walletButtons.clear(); }};
}
