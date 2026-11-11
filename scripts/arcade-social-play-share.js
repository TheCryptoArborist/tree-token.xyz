import {mountShareBuilder,shareGames} from './arcade-result-share-builder.js';
// Uses the existing message-only session through a private closure. No new wallet flow.
export function createArcadeMissions({root, fetchImpl, getSession, now = () => Date.now()}) {
  const status = root.querySelector('#missions-status');
  if (!status) return {sessionChanged(){}, refresh(){}, destroy(){}};
  const forms = [...root.querySelectorAll('[data-mission]')];
  const refreshButton = root.querySelector('#missions-refresh');
  const progress = root.querySelector('#missions-progress');
  let identity = null, data = null, busy = false, serial = 0, disposed = false;
  const listeners = [];
  let gameplay = null, completed = [], runSignature='';
  const controls = root.querySelector('#result-share-controls');
  const shareState = root.querySelector('#result-share-state');
  const shareHost = root.querySelector('#guided-share-score');
  const freshToday = () => gameplay?.dateKey === new Date(now()).toISOString().slice(0,10);
  function gameplayChanged(event) {
    gameplay = event.detail;
    const next = completedResultGames(gameplay, new Date(now()).toISOString().slice(0,10));
    const signature=JSON.stringify(gameplay?.runs||[]);
    if(signature!==runSignature){runSignature=signature;
      shareHost.replaceChildren(); delete shareHost.dataset.shareMounted;
      if(next.length) mountShareBuilder(shareHost,{games:next,initialGame:next[0].id,result:true,runs:gameplay.runs});
    }
    completed = next; render();
  }
  on(root,'arcade-completed-runs',gameplayChanged);

  function on(node, type, fn) { node.addEventListener(type,fn); listeners.push(() => node.removeEventListener(type,fn)); }
  function session() { const s = getSession(); return s && Date.parse(s.expiresAt) > now() ? s : null; }
  function render() {
    const signedIn = Boolean(session());
    const unlocked = signedIn && completed.length > 0 && freshToday() && !gameplay?.stale && gameplay?.wallet === session()?.wallet;
    controls.hidden = !unlocked; controls.disabled = !unlocked;
    shareState.textContent = unlocked ? 'Unlocked ✓ · Choose today’s completed game and share your result.' : 'Locked · Complete and save a run in Tree Force ’89, Canopy Breaker, Garden Bot, or PvP, then refresh saved runs.';
    refreshButton.disabled = busy || !signedIn;
    progress.textContent = data ? `${data.monthlyStamps} community stamp${data.monthlyStamps === 1 ? '' : 's'} this month · Weekly reset: ${new Date(data.resetsAt).toUTCString()}` : '';
    for (const form of forms) {
      const entry = data?.entries.find(e => e.mission === form.dataset.mission);
      for (const input of form.querySelectorAll('input,select,button')) input.disabled = input.tagName==='SELECT' ? busy : busy || !signedIn || Boolean(entry) || (form.dataset.mission === 'share-score' && !unlocked);
      form.querySelector('.mission-state').textContent = entry
        ? entry.status === 'completed' ? 'Completed ✓ · Community stamp saved' : entry.status === 'pending' ? 'Pending review · No stamp awarded yet' : 'Not accepted · Try again with a new entry next week.'
        : signedIn ? 'Ready to start' : 'Sign in above to participate.';
      if (entry) form.elements.proof.value = entry.proof;
      if(form.dataset.mission==='community-vote')form.querySelector('.mission-state').textContent=entry?entry.status==='completed'?'Your vote is saved ✓ · '+entry.proof:'Vote status: '+entry.status:busy?'Loading your saved vote…':signedIn?'Choose a game, then Save my vote.':'Browse the choices now. Sign in above to save your vote.';
    }
  }
  function sessionChanged() {
    const s = session(), key = s ? `${s.wallet}:${s.token}` : null;
    if (identity === key) return;
    identity = key; serial++; busy = false; data = null; gameplay = null; completed = []; runSignature='';
    shareHost.replaceChildren(); delete shareHost.dataset.shareMounted;
    for (const form of forms) form.reset();
    status.textContent = key ? 'Refresh to load your saved post reviews and vote.' : 'Sign in above to load your saved community missions.';
    render();
    if(key)queueMicrotask(()=>{if(!disposed&&identity===key)void request();});
  }
  async function request(submission) {
    sessionChanged(); const s = session(); if (!s || busy || disposed) return;
    const ticket = ++serial; busy = true; status.textContent = submission ? 'Saving your submission…' : 'Loading community missions…'; render();
    try {
      const response = await fetchImpl('/api/arcade-social', {method:submission ? 'POST' : 'GET',cache:'no-store',credentials:'omit',
        headers:{Authorization:`Bearer ${s.token}`,...(submission ? {'Content-Type':'application/json'} : {})},
        ...(submission ? {body:JSON.stringify(submission)} : {}),signal:AbortSignal.timeout(12000)});
      const value = await response.json();
      if (ticket !== serial || disposed || session()?.token !== s.token) return;
      if (!response.ok) throw new Error(value.message || 'Sign in again or refresh missions to try again.');
      if (value.wallet !== s.wallet || !Array.isArray(value.entries) || !Number.isInteger(value.monthlyStamps) || value.monthlyStamps < 0 || !Number.isFinite(Date.parse(value.resetsAt)) || value.entries.some(e => !['share-score','friend-challenge','community-vote'].includes(e.mission) || !['pending','completed','rejected'].includes(e.status) || typeof e.proof !== 'string')) throw new Error('Saved mission progress could not be verified.');
      data = value; status.textContent = submission ? 'Saved. Post submissions need review before earning a stamp.' : 'Your saved community missions are up to date.';
    } catch (error) {
      if (ticket === serial && !disposed) { data = null; status.textContent = error.message || 'Community missions are unavailable. Try again.'; }
    } finally { if (ticket === serial && !disposed) {busy = false; render();} }
  }
  on(refreshButton,'click',() => void request());
  for (const form of forms) on(form,'submit',event => {event.preventDefault(); if (form.dataset.mission === 'share-score' && (!completed.length || !freshToday() || gameplay?.stale)) { render(); return; } if (form.reportValidity()) void request({mission:form.dataset.mission,proof:form.elements.proof.value});});
  const freshnessTimer = setInterval(render, 30000);
  render();
  return {sessionChanged,refresh:() => request(),destroy(){disposed=true;clearInterval(freshnessTimer);serial++;listeners.forEach(remove => remove());}};
}

// Only the completion endpoint can unlock result sharing. Legacy first-wave
// events and client-side gameplay messages are never completion evidence.
export function completedResultGames(detail,dateKey) {
 if(!detail?.sessionActive||detail.stale||detail.loading||detail.dateKey!==dateKey||!Array.isArray(detail.runs))return [];
 return shareGames.filter(game=>detail.runs.some(run=>run.gameId===game.id));
}
