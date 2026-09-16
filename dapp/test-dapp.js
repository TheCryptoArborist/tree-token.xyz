const TEST_DAPP_HOSTS = new Set([
  'tree-token-test-dapp.netlify.app',
  'test.tree-token.xyz',
]);
const TEST_DAPP_DRAFT_HOST_PATTERN = /^(?:deploy-preview-\d+|[a-z0-9-]+)--tree-token-test-dapp\.netlify\.app$/;

const isTestDappHost = TEST_DAPP_HOSTS.has(location.hostname) || TEST_DAPP_DRAFT_HOST_PATTERN.test(location.hostname);
const isPublicLayoutPreview = isTestDappHost && new URLSearchParams(location.search).get('view') === 'public';
const isTestDapp = isTestDappHost && !isPublicLayoutPreview;

if (isTestDappHost) {
  const robots = document.createElement('meta');
  robots.name = 'robots';
  robots.content = 'noindex,nofollow,noarchive';
  document.head.append(robots);
}

if (isPublicLayoutPreview) {
  document.documentElement.classList.add('tree-public-layout-preview');
  document.title = `PUBLIC LAYOUT PREVIEW · ${document.title}`;
}

if (isTestDapp) {
  document.documentElement.classList.add('tree-test-dapp');
  document.title = `TEST DAPP · ${document.title}`;

  const banner = document.createElement('aside');
  banner.className = 'test-dapp-banner';
  banner.setAttribute('role', 'status');
  banner.innerHTML = '<strong>TEST DAPP</strong><span>SUI Mainnet transactions</span><span>Experimental features</span><b>V3 rebalance beta</b>';
  document.body.prepend(banner);

  if (location.pathname.replace(/\/+$/, '') === '/dapp' && !location.hash) {
    history.replaceState(history.state, '', `${location.pathname}${location.search}#v3`);
  }
}

export { TEST_DAPP_HOSTS, isTestDapp, isPublicLayoutPreview };
