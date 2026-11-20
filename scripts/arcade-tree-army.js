// An isolated preview in one existing reserved cabinet. No Arcade access hooks.
export function mountTreeArmyPreview(doc = document) {
  const title = doc.getElementById('reserved-2-title');
  const card = title?.closest('article.poster--reserved');
  if (!card || doc.getElementById('tree-army-preview')) return;
  const sheet = doc.createElement('link');
  sheet.rel = 'stylesheet';
  sheet.href = '/styles/arcade-tree-army.css';
  doc.head.append(sheet);
  card.classList.add('poster--tree-army');
  title.textContent = 'Tree Army';
  const artwork = card.querySelector('.poster-artwork');
  artwork.classList.remove('reserved-artwork');
  artwork.querySelector('.poster-number').textContent = 'ACTION / DEFENSE';
  artwork.querySelector('.status-tag').textContent = 'Coming Soon · In Development';
  const image = artwork.querySelector('img');
  image.className = 'poster-art art--wide';
  image.src = '/play/tree-army/preview-gameplay.jpg';
  image.alt = 'Tree Hero and woodland allies defending the illustrated grove — actual prototype gameplay';
  image.width = 1100; image.height = 470;
  artwork.querySelector('.reserved-screen')?.remove();
  artwork.querySelector('.poster-genre').textContent = 'DEFEND THE GROVE';
  card.querySelector('.poster-description').textContent = 'Defend the Grove. Lead the TREE Hero, summon woodland allies and hold back the logging machines.';
  const oldCTA = card.querySelector('.poster-cta');
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'poster-cta tree-army-watch';
  button.textContent = 'Watch Preview';
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', 'tree-army-preview');
  oldCTA.replaceWith(button);
  const dialog = doc.createElement('dialog');
  dialog.id = 'tree-army-preview';
  dialog.setAttribute('aria-labelledby', 'tree-army-preview-title');
  dialog.innerHTML = `<div class="tree-army-preview-heading"><div><h2 id="tree-army-preview-title">Tree Army</h2><p>Defend the Grove · 10-second gameplay preview</p></div><button type="button" aria-label="Close Tree Army preview" autofocus>Close ×</button></div><video controls playsinline preload="none" poster="/play/tree-army/preview-gameplay.jpg" aria-label="Tree Army prototype gameplay: hero firing, allies summoned and enemies attacking"><source src="/play/tree-army/preview-gameplay.webm" type="video/webm"><source src="/play/tree-army/preview-gameplay.mp4" type="video/mp4"></video><p class="tree-army-preview-note">Actual prototype gameplay · In development · No audio</p>`;
  doc.body.append(dialog);
  const video = dialog.querySelector('video');
  button.addEventListener('click', () => {
    dialog.showModal();
    video.currentTime = 0;
    video.play().catch(() => { /* Native controls remain available. */ });
  });
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => { video.pause(); button.focus({ preventScroll: true }); });
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) video.pause(); });
}
