// One native rewards destination, including the homepage rendered by its bundle.
(() => {
  function connectRewardsEntry() {
    document.querySelectorAll('a[href]').forEach((link) => {
      try {
        const url = new URL(link.getAttribute('href'), location.origin);
        if (url.hostname === 'treedrop.xyz' || url.hostname === 'www.treedrop.xyz') {
          link.href = '/rewards/';
          link.removeAttribute('target');
          link.removeAttribute('rel');
        }
      } catch { /* Ignore unrelated malformed links. */ }
    });
    const nav = document.getElementById('simple-site-nav');
    if (!nav || nav.querySelector('a[href="/rewards/"]')) return;
    const link = document.createElement('a');
    link.href = '/rewards/';
    link.textContent = 'NFTree Rewards';
    const play = [...nav.querySelectorAll('a')].find((item) => new URL(item.href).pathname.replace(/\/$/, '') === '/play');
    if (play) play.after(link); else nav.append(link);
  }
  connectRewardsEntry();
  const observer = new MutationObserver(connectRewardsEntry);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  // The homepage enhancement initializes asynchronously; this also covers its
  // fallback without adding polling or intercepting wallet behavior.
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
})();
