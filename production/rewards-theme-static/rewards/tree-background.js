// Decorative media only. Reward and wallet bundles are intentionally untouched.
const backdrop = document.querySelector('.tree-rewards-backdrop');
const video = backdrop?.querySelector('video');
const control = document.querySelector('.tree-background-control');
if (video && control) {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reflect = () => {
    control.textContent = video.paused ? '▶ Play background' : 'Ⅱ Pause background';
    control.setAttribute('aria-label', video.paused ? 'Play background video' : 'Pause background video');
    backdrop.dataset.motion = video.paused ? 'paused' : 'playing';
  };
  control.hidden = false;
  video.addEventListener('play', reflect);
  video.addEventListener('pause', reflect);
  control.addEventListener('click', () => {
    if (video.paused) video.play().catch(reflect);
    else video.pause();
  });
  const respectPreference = () => {
    if (preference.matches) video.pause();
    else video.play().catch(reflect);
    reflect();
  };
  preference.addEventListener('change', respectPreference);
  respectPreference();
}
