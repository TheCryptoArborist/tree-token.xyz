// Cosmetic selection only; never used as authentication or award eligibility.
export const HOLIDAY_START = Date.parse('2026-11-27T00:00:00-06:00');
export const HOLIDAY_END = Date.parse('2027-01-01T00:00:00-06:00');
export function holidayAvailable(now = Date.now()) {
  return Number.isFinite(now) && now >= HOLIDAY_START && now < HOLIDAY_END;
}
export function holidayCountdown(now = Date.now()) {
  if (!Number.isFinite(now) || now >= HOLIDAY_END) return '';
  const target = now < HOLIDAY_START ? HOLIDAY_START : HOLIDAY_END;
  const seconds = Math.ceil((target - now) / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds % 86400 / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  return `${days}d ${String(hours).padStart(2,'0')}h ${String(minutes).padStart(2,'0')}m ${String(seconds % 60).padStart(2,'0')}s`;
}
export function beginHolidayScene(scene) {
  if (scene.sys.settings.key !== 'game') return;
  const policy = scene.game.registry.get('holidayPolicy');
  // A scene restart for an existing run retains its presentation, including continues.
  const resume = !!scene.resumeRun;
  if (!resume || !scene.game.registry.has('holidayRunTheme')) {
    scene.game.registry.set('holidayRunTheme', policy?.selected === 'christmas' && holidayAvailable(policy.now()) ? 'christmas' : 'normal');
  }
  scene.holidayTheme = scene.game.registry.get('holidayRunTheme');
  if (policy?.mount) policy.mount.dataset.holidayRunTheme = scene.holidayTheme;
}
export function holidayMusicEnabled(game) {
  const scene = game?.scene.getScene('game');
  return !!scene?.sys.isActive() && scene.holidayTheme === 'christmas';
}
export function installHolidaySelector(game, mount, options = {}) {
  const localPreview = ['localhost','127.0.0.1'].includes(location.hostname) && location.pathname === '/__local/christmas.html';
  const now = localPreview && Number.isFinite(options.holidayPreviewNow) ? () => options.holidayPreviewNow : () => Date.now();
  const policy = {now, mount, selected: holidayAvailable(now()) && mount.dataset.holidaySelection === 'christmas' ? 'christmas' : 'normal'};
  if(options.resumeRun && mount.dataset.holidayRunTheme) game.registry.set('holidayRunTheme',mount.dataset.holidayRunTheme);
  game.registry.set('holidayPolicy',policy);
  const panel = document.createElement('div');
  panel.className = 'holiday-mode-selector';
  panel.style.cssText='padding:10px;background:#102d29;color:#fff7df;font:14px/1.4 system-ui;display:flex;gap:10px;align-items:center;flex-wrap:wrap';
  const label = document.createElement('label');label.textContent='Game theme ';
  const select = document.createElement('select');select.setAttribute('aria-label','Game theme');
  select.style.cssText='font:inherit;min-height:44px;background:#173e36;color:#fff7df;border:1px solid #9ecf9b;border-radius:6px;padding:6px';
  for(const [value,text] of [['normal','Normal'],['christmas','Christmas']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
  select.value=policy.selected;
  const note=document.createElement('span');note.setAttribute('role','status');
  const countdown=document.createElement('span');countdown.setAttribute('role','timer');countdown.setAttribute('aria-live','off');countdown.setAttribute('aria-label','Time until Christmas mode unlocks');countdown.style.fontVariantNumeric='tabular-nums';
  label.append(select);panel.append(label,note,countdown);mount.parentElement.insertBefore(panel,mount);
  const update=()=>{
    const active=!!game.scene.getScene('game')?.sys.isActive();
    const currentTime=policy.now();
    const available=holidayAvailable(currentTime);
    const remaining=holidayCountdown(currentTime);
    countdown.hidden=!remaining;
    const timerLabel=available?'Time remaining in Christmas mode':'Time until Christmas mode unlocks';
    if(countdown.getAttribute('aria-label')!==timerLabel)countdown.setAttribute('aria-label',timerLabel);
    if(countdown.textContent!==remaining)countdown.textContent=remaining;
    // Keep the full combat viewport and touch coordinates unchanged during play.
    panel.style.display=active?'none':'flex';
    select.disabled=active;
    select.options[1].disabled=!available;
    if(!active&&!available){policy.selected='normal';select.value='normal';}
    const message=currentTime < HOLIDAY_START
      ? 'Christmas mode unlocks November 27 · midnight Central.'
      : available ? 'Christmas mode is available for…'
      : active ? 'Christmas season has ended. This run keeps its selected theme.'
      : 'Christmas season has ended. Normal mode is available.';
    if(note.textContent!==message)note.textContent=message;
  };
  select.addEventListener('change',()=>{
    if(game.scene.getScene('game')?.sys.isActive()){select.value=policy.selected;return;}
    policy.selected=select.value==='christmas'&&holidayAvailable(policy.now())?'christmas':'normal';select.value=policy.selected;mount.dataset.holidaySelection=policy.selected;
  });
  game.events.on('poststep',update);
  // Recheck wall time on return instead of replaying missed countdown ticks.
  document.addEventListener('visibilitychange',update);
  window.addEventListener('focus',update);
  game.events.once('destroy',()=>{game.events.off('poststep',update);document.removeEventListener('visibilitychange',update);window.removeEventListener('focus',update);panel.remove();});
  update();
}
