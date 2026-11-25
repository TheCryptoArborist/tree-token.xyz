// Fill only the final reserved cabinet. Existing games and wallet hooks are untouched.
export function mountGroveChess(doc = document) {
  const title = doc.getElementById('reserved-3-title');
  const card = title?.closest('article.poster--reserved');
  if (!card || doc.querySelector('.poster--grove-chess')) return;
  card.classList.remove('poster--reserved');
  card.classList.add('poster--grove-chess');
  card.setAttribute('aria-labelledby', 'reserved-3-title');
  card.innerHTML = `<a class="poster-link" href="/play/grove-chess/" aria-labelledby="reserved-3-title" aria-describedby="grove-chess-description">
    <div class="poster-artwork" style="background:radial-gradient(ellipse at center,#304c2b,#071a13)">
      <div class="poster-topline"><span class="poster-number">WOODLAND CHESS</span><span class="status-tag status-tag--live">LIVE</span></div>
      <img class="poster-art" src="/play/grove-chess/assets/tree-hero.webp" alt="Tree Hero, king of the Grove Chess woodland court" width="512" height="512" loading="lazy" decoding="async" style="object-fit:contain;padding:24px">
      <p class="poster-genre">PROTECT YOUR HERO. DEFEND THE CANOPY.</p>
    </div>
    <div class="poster-details"><h4 class="poster-title" id="grove-chess-title">GROVE CHESS</h4>
      <p class="poster-description" id="grove-chess-description">Lead Tree Hero and an illustrated woodland court. Learn each piece as you play the computer or share a board with a friend.</p>
      <p class="poster-facts">2 free games · NFTree holder access · Local two-player</p>
      <span class="poster-cta"><span>PLAY GROVE CHESS</span><span aria-hidden="true">→</span></span>
    </div></a>`;
  title.textContent = 'GROVE CHESS';
  card.querySelector('#grove-chess-title').replaceWith(title);
}
