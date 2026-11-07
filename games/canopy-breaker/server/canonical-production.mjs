// Wallet challenges and cookies use the public arcade origin through the proxy.
export const PRODUCTION_PREFIX = '/play/canopy-breaker/';
export function canonicalProductionRequest(request) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(PRODUCTION_PREFIX)) return null;
  const target = new URL('https://tree-token.xyz' + url.pathname);
  target.search = url.search;
  return new Request(target, request);
}
