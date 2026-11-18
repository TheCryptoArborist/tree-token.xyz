// Loaded synchronously only by the deploy-preview build, before Arcade modules.
// Production sources and wallet adapters remain byte-for-byte unchanged.
(() => {
  if (document.documentElement.dataset.arcadeReviewPreview !== 'readonly') return;

  const message = 'Review preview: wallet connections, saved progress and payments are disabled. Open the live Arcade to participate.';
  const nativeFetch = window.fetch.bind(window);
  const blockedResponse = () => new Response(JSON.stringify({
    status: 'error', error: 'preview-read-only', message,
  }), { status: 403, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  const sensitiveStorage = new Set([
    'tree-arcade:daily-growth:session:v1',
    'tree-arcade:recovery:pending:v1',
    'tree-arcade:nftree-mint:pending:v1',
  ]);

  // A reused preview origin must not restore an old session or payment record.
  // Do not erase those records: hide them from this review page only.
  for (const method of ['getItem', 'setItem', 'removeItem']) {
    const original = Storage.prototype[method];
    Storage.prototype[method] = function (key, ...args) {
      if (sensitiveStorage.has(String(key))) return method === 'getItem' ? null : undefined;
      return original.call(this, key, ...args);
    };
  }

  function readAllowed(method, url, headers, credentials) {
    if (!['GET', 'HEAD'].includes(method) || credentials === 'include') return false;
    if (headers.has('authorization') || headers.has('cookie') || headers.has('x-api-key')) return false;
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
    if (url.pathname.startsWith('/api/arcade-')) {
      const action = url.searchParams.get('action');
      if (action && action !== 'status') return false;
    }
    return true;
  }

  window.fetch = (input, options = {}) => {
    const request = input instanceof Request ? input : null;
    const method = String(options.method || request?.method || 'GET').toUpperCase();
    const url = new URL(request ? request.url : String(input), location.href);
    const headers = new Headers(options.headers ?? request?.headers);
    const credentials = options.credentials ?? request?.credentials;
    if (!readAllowed(method, url, headers, credentials)) return Promise.resolve(blockedResponse());

    // This is the real, anonymous public configuration captured for this review.
    // It contains no wallet, check-ins, scores, badges earned or sample progress.
    if (url.origin === location.origin && url.pathname === '/api/arcade-growth' &&
        (url.searchParams.get('action') || 'status') === 'status' &&
        [...url.searchParams.keys()].every(key => key === 'action')) {
      return nativeFetch('/arcade-preview-data/arcade-growth-status.json', {
        method: 'GET', credentials: 'omit', cache: 'no-store', signal: options.signal ?? request?.signal,
      });
    }
    return nativeFetch(input, { ...options, credentials: 'omit' });
  };

  // No alternate browser transport can submit a payment or progress request.
  const xhrState = new WeakMap();
  const xhrOpen = XMLHttpRequest.prototype.open;
  const xhrHeader = XMLHttpRequest.prototype.setRequestHeader;
  const xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    xhrState.set(this, { method: String(method).toUpperCase(), url: new URL(String(url), location.href), headers: new Headers() });
    return xhrOpen.call(this, method, url, ...args);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    xhrState.get(this)?.headers.append(name, value);
    return xhrHeader.call(this, name, value);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    const state = xhrState.get(this);
    if (!state || !readAllowed(state.method, state.url, state.headers, this.withCredentials ? 'include' : 'omit')) {
      throw new DOMException(message, 'InvalidAccessError');
    }
    return xhrSend.apply(this, args);
  };
  if (navigator.sendBeacon) navigator.sendBeacon = () => false;

  const blockedControls = [
    '#growth-connect', '#growth-sign-in', '#growth-check-in', '#growth-sign-out',
    '#growth-check-in-row', '#growth-task-auth', '#growth-wallet-options button',
    '#nftree-wallet-options button', '#nftree-review-button', '#nftree-purchase-button',
    '#nftree-check-button', '#nftree-disconnect-button', '#nftree-purchase-ack',
    '#monthly-pay', '#monthly-retry', '#monthly-cancel', '#monthly-digest-form button',
    '#campaign-start', '#guided-start-bonus', '#campaign-check', '#campaign-game', '#campaign-claim',
    '#campaign-share-submit', '#campaign-quiz-submit', 'form[data-mission] button[type="submit"]',
  ].join(',');
  const blockedForms = '#monthly-digest-form, #campaign-share-form, #campaign-quiz-form, form[data-mission]';

  function notice() {
    const status = document.getElementById('arcade-review-status');
    if (status && status.textContent !== message) status.textContent = message;
  }

  function disableControls() {
    for (const control of document.querySelectorAll(blockedControls)) {
      if (!control.disabled) control.disabled = true;
      if (control.getAttribute('aria-disabled') !== 'true') control.setAttribute('aria-disabled', 'true');
      if (control.title !== message) control.title = message;
    }
  }

  window.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (target?.closest(blockedControls)) {
      event.preventDefault(); event.stopImmediatePropagation(); notice(); return;
    }
    // Game and Profile Studio destinations leave this visual review for the
    // real canonical page. Tabs, fragments and the Arcade itself stay here.
    const link = target?.closest('a[href]');
    if (link) {
      const url = new URL(link.getAttribute('href'), location.href);
      if (url.origin === location.origin && url.pathname.startsWith('/play/') &&
          !['/play/', '/play/index.html'].includes(url.pathname)) {
        link.href = 'https://tree-token.xyz' + url.pathname + url.search + url.hash;
      }
    }
  }, true);
  window.addEventListener('submit', event => {
    if (event.target instanceof Element && event.target.matches(blockedForms)) {
      event.preventDefault(); event.stopImmediatePropagation(); notice();
    }
  }, true);
  document.addEventListener('DOMContentLoaded', () => {
    disableControls();
    new MutationObserver(disableControls).observe(document.body, {
      subtree: true, childList: true, attributes: true, attributeFilter: ['disabled'],
    });
  }, { once: true });
})();
