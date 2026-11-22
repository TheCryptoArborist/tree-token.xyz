import { ADVENT_MONTH, mountAdventGrove } from './arcade-advent-grove.js';

// This static preview intentionally has no wallet, storage, API or payment dependency.
export const PREVIEW_DATE = '2026-12-25';
const PREVIEW_WALLET = '0x' + '7'.repeat(64);
const keyOf = day => ADVENT_MONTH + '-' + String(day).padStart(2, '0');

export function createAdventPreviewSnapshot({ revealed = false, recovered = false } = {}) {
  const checkedDates = [1, 10, ...(recovered ? [3] : []), ...(revealed ? [25] : [])].sort((a, b) => a - b).map(keyOf);
  const checked = new Set(checkedDates);
  return {
    wallet: PREVIEW_WALLET,
    monthKey: ADVENT_MONTH,
    dateKey: PREVIEW_DATE,
    checkedDates,
    recoveredDates: recovered ? [keyOf(3)] : [],
    missedDates: Array.from({ length: 24 }, (_, index) => keyOf(index + 1)).filter(date => !checked.has(date)),
    checkedInDays: checkedDates.length,
    streak: revealed ? 1 : 0,
    todayChecked: revealed,
  };
}

export function mountAdventPreview({ doc = globalThis.document } = {}) {
  const card = doc?.querySelector('[data-preview-grove]');
  if (!card) return null;
  const reveal = doc.querySelector('[data-preview-reveal]');
  const recover = doc.querySelector('[data-preview-recover]');
  const reset = doc.querySelector('[data-preview-reset]');
  const status = doc.querySelector('[data-preview-status]');
  const widget = mountAdventGrove({ card, doc });
  let state = { revealed: false, recovered: false };
  let celebrationTimer = null;
  const win = doc.defaultView;
  function render(message) {
    const snapshot = createAdventPreviewSnapshot(state);
    widget.update(snapshot, { wallet: snapshot.wallet, fresh: true });
    const tools = doc.querySelector('[data-preview-tools]');
    const overview = card.querySelector('.advent-overview');
    if (tools && overview && tools.parentElement !== overview) overview.prepend(tools);
    doc.querySelector('[data-preview-count]').textContent = snapshot.checkedInDays + ' / 31';
    doc.querySelector('[data-preview-streak]').textContent = snapshot.streak + (snapshot.streak === 1 ? ' day' : ' days');
    doc.querySelector('[data-preview-deadline]').textContent = state.revealed ? 'Dec 27 · 00:00 UTC' : 'Start a streak today';
    reveal.disabled = state.revealed;
    reveal.textContent = state.revealed ? 'Christmas tree revealed ✓' : 'Preview today’s reveal';
    recover.disabled = state.recovered;
    recover.textContent = state.recovered ? 'December 3 restored ✓' : 'Preview recovery';
    if (message) status.textContent = message;
  }
  function celebrate() {
    if (celebrationTimer !== null) win.clearTimeout(celebrationTimer);
    card.removeAttribute('data-preview-celebrate');
    if (win.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    // Restart the short presentation animation when switching between the two sample actions.
    void card.offsetWidth;
    card.dataset.previewCelebrate = 'true';
    celebrationTimer = win.setTimeout(() => {
      card.removeAttribute('data-preview-celebrate');
      celebrationTimer = null;
    }, 750);
  }
  const onReveal = () => {
    if (state.revealed) return;
    state = { ...state, revealed: true };
    render('Sample reveal complete: December 25’s Tree Hero Christmas Tree is now in this preview grove.');
    celebrate();
  };
  const onRecover = () => {
    if (state.recovered) return;
    state = { ...state, recovered: true };
    render('Sample recovery complete: December 3’s Gingerbread Grove is restored. Your current sample streak stays ' + (state.revealed ? '1 day.' : 'at 0 days.'));
    celebrate();
  };
  const onReset = () => {
    if (celebrationTimer !== null) win.clearTimeout(celebrationTimer);
    celebrationTimer = null;
    card.removeAttribute('data-preview-celebrate');
    state = { revealed: false, recovered: false };
    // Clear selected art, then return to the same initial sample without retaining a prior selection.
    widget.update(null, { wallet: null, fresh: false });
    render('Preview reset to December 25 sample progress. Reveal today’s tree or restore December 3.');
  };
  reveal.addEventListener('click', onReveal);
  recover.addEventListener('click', onRecover);
  reset.addEventListener('click', onReset);
  render();
  return {
    destroy() {
      reveal.removeEventListener('click', onReveal);
      recover.removeEventListener('click', onRecover);
      reset.removeEventListener('click', onReset);
      if (celebrationTimer !== null) win.clearTimeout(celebrationTimer);
      widget.destroy();
    },
  };
}

if (typeof document !== 'undefined') mountAdventPreview({ doc: document });
