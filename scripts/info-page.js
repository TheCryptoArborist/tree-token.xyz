const DASHBOARD_URL = '/api/tree-dashboard';
const TREE_COIN_TYPE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
const compactMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 });
const amount = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });

function valueAt(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

function formatPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Unavailable';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: number < 0.0001 ? 10 : 6 }).format(number);
}

function formatMarket(field, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Unavailable';
  if (field === 'price') return formatPrice(number);
  if (field === 'priceChange24h') return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
  if (field === 'holderCount') return new Intl.NumberFormat('en-US').format(number);
  return compactMoney.format(number);
}

function formatSnapshot(path, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Unavailable';
  if (path === 'nftree.mintPriceSui') return `${number.toLocaleString()} SUI`;
  return amount.format(number);
}

function setupNavigation() {
  const menu = document.querySelector('.info-menu');
  const nav = document.querySelector('.info-nav');
  menu?.addEventListener('click', () => {
    const open = nav?.classList.toggle('open') || false;
    menu.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    nav.classList.remove('open');
    menu?.setAttribute('aria-expanded', 'false');
  }));
  const section = location.pathname.split('/').filter(Boolean)[0] || 'home';
  nav?.querySelectorAll('a').forEach((link) => {
    const target = link.getAttribute('href')?.split('/').filter(Boolean)[0] || 'home';
    link.classList.toggle('active', target === section);
  });
}

async function loadDashboard() {
  try {
    const response = await fetch(DASHBOARD_URL, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Dashboard returned ${response.status}`);
    const payload = await response.json();
    const market = payload?.live?.data || {};
    const snapshot = payload?.snapshot || {};
    document.querySelectorAll('[data-market]').forEach((element) => {
      const field = element.dataset.market;
      element.textContent = formatMarket(field, market[field]);
      if (field === 'priceChange24h' && Number.isFinite(Number(market[field]))) {
        element.classList.toggle('positive', Number(market[field]) >= 0);
        element.classList.toggle('negative', Number(market[field]) < 0);
      }
    });
    document.querySelectorAll('[data-snapshot]').forEach((element) => {
      const path = element.dataset.snapshot;
      element.textContent = formatSnapshot(path, valueAt(snapshot, path));
    });
  } catch (error) {
    document.querySelectorAll('[data-market],[data-snapshot]').forEach((element) => { element.textContent = 'Unavailable'; });
    console.error('TREE information-page data unavailable:', error);
  }
}

function setupCoinCopy() {
  document.querySelectorAll('[data-copy-coin]').forEach((button) => button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(TREE_COIN_TYPE);
      button.textContent = 'Coin Type Copied';
      setTimeout(() => { button.textContent = 'Copy Coin Type'; }, 1800);
    } catch {
      button.textContent = 'Copy Unavailable';
    }
  }));
}

setupNavigation();
setupCoinCopy();
loadDashboard();