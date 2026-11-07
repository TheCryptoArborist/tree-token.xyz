// Uses the existing message-only session through a private closure. No new wallet flow.
export function createArcadeMissions({root, fetchImpl, getSession, now = () => Date.now()}) {
  const status = root.querySelector('#missions-status');
  if (!status) return {sessionChanged(){}, refresh(){}, destroy(){}};
  const forms = [...root.querySelectorAll('[data-mission]')];
  const refreshButton = root.querySelector('#missions-refresh');
  const progress = root.querySelector('#missions-progress');
  let identity = null, data = null, busy = false, serial = 0, disposed = false;
  const listeners = [];
  function on(node, type, fn) { node.addEventListener(type,fn); listeners.push(() => node.removeEventListener(type,fn)); }
  function session() { const s = getSession(); return s && Date.parse(s.expiresAt) > now() ? s : null; }
  function render() {
    const signedIn = Boolean(session());
    refreshButton.disabled = busy || !signedIn;
    progress.textContent = data ? `${data.monthlyStamps} community stamp${data.monthlyStamps === 1 ? '' : 's'} this month · Weekly reset: ${new Date(data.resetsAt).toUTCString()}` : '';
    for (const form of forms) {
      const entry = data?.entries.find(e => e.mission === form.dataset.mission);
      for (const input of form.querySelectorAll('input,select,button')) input.disabled = busy || !signedIn || Boolean(entry);
      form.querySelector('.mission-state').textContent = entry
        ? entry.status === 'completed' ? 'Completed ✓ · Community stamp saved' : entry.status === 'pending' ? 'Pending review · No stamp awarded yet' : 'Not accepted · Try again with a new entry next week.'
        : signedIn ? 'Ready to start' : 'Sign in above to participate.';
      if (entry) form.elements.proof.value = entry.proof;
    }
  }
  function sessionChanged() {
    const s = session(), key = s ? `${s.wallet}:${s.token}` : null;
    if (identity === key) return;
    identity = key; serial++; busy = false; data = null;
    for (const form of forms) form.reset();
    status.textContent = key ? 'Open Community or refresh to load your missions.' : 'Sign in above to load your saved community missions.';
    render();
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
  for (const form of forms) on(form,'submit',event => {event.preventDefault(); if (form.reportValidity()) void request({mission:form.dataset.mission,proof:form.elements.proof.value});});
  render();
  return {sessionChanged,refresh:() => request(),destroy(){disposed=true;serial++;listeners.forEach(remove => remove());}};
}
