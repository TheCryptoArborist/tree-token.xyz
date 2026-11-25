// Cosmetic selection only; never used as authentication or award eligibility.
import {HOLIDAY_START,HOLIDAY_END,holidayAvailable,holidayCountdown,holidayMessage} from './holiday-season.mjs';
export {HOLIDAY_START,HOLIDAY_END,holidayAvailable,holidayCountdown};
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
  for(const [value,text] of [['normal','Normal'],['christmas','Holiday']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
  select.value=policy.selected;
  const note=document.createElement('span');note.setAttribute('role','status');
  const countdown=document.createElement('span');countdown.setAttribute('role','timer');countdown.setAttribute('aria-live','off');countdown.setAttribute('aria-label','Time until the holiday season begins');countdown.style.fontVariantNumeric='tabular-nums';
  const deadline=document.createElement('span');deadline.textContent='';
  label.append(select);panel.append(label,note,countdown,deadline);mount.parentElement.insertBefore(panel,mount);
  const update=()=>{
    const active=!!game.scene.getScene('game')?.sys.isActive();
    const currentTime=policy.now();
    const available=holidayAvailable(currentTime);
    const remaining=holidayCountdown(currentTime);
    countdown.hidden=!remaining;
    deadline.hidden=!remaining;
    const dateLabel=available?'Ends January 1 at 06:00 UTC.':'Arrives November 27 at 06:00 UTC.';
    if(deadline.textContent!==dateLabel)deadline.textContent=dateLabel;
    const timerLabel=available?'Time remaining in the holiday season':'Time until the holiday season begins';
    if(countdown.getAttribute('aria-label')!==timerLabel)countdown.setAttribute('aria-label',timerLabel);
    if(countdown.textContent!==remaining)countdown.textContent=remaining;
    // Keep the full combat viewport and touch coordinates unchanged during play.
    panel.style.display=active?'none':'flex';
    select.disabled=active;
    select.options[1].disabled=!available;
    if(!active&&!available){policy.selected='normal';select.value='normal';}
    const message=holidayMessage(currentTime) || 'The holiday season has ended. Normal play is available.';
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
