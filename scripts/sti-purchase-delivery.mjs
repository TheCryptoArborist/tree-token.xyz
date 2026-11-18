import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { ARBORETUM_SNIPPET, assertServedContent } from './stats-market-delivery.mjs';

// New sources begin with the exact current production files. Historical
// manifest-pinned dapp files remain untouched.
export const DELIVERY_SOURCES = {
  '/dapp/index.html': 'production/sti-purchase-static/index.html',
  '/dapp/sti-widget.js': 'production/sti-purchase-static/sti-widget.js',
  '/dapp/sti-purchase-core.js': 'production/sti-purchase-static/sti-purchase-core.js',
  '/dapp/sti-purchase.css': 'production/sti-purchase-static/sti-purchase.css',
  '/dapp/sti-wallet-recovery.js': 'production/sti-purchase-static/sti-wallet-recovery.js',
};
export const DELIVERY_PATHS = Object.keys(DELIVERY_SOURCES);
export { ARBORETUM_SNIPPET, assertServedContent };
const sha1 = bytes => crypto.createHash('sha1').update(bytes).digest('hex');

export async function verifyDelivery(origin, plan, root, fetchImpl = globalThis.fetch) {
  const url = new URL(origin);
  assert(url.protocol === 'https:' && (url.hostname === 'tree-token.xyz' ||
    /^[a-f0-9]{24}--tree-token\.netlify\.app$/.test(url.hostname)) &&
    url.pathname === '/' && !url.search && !url.hash, 'Unapproved delivery origin.');
  assert.deepEqual(Object.keys(plan.sources).sort(), [...DELIVERY_PATHS].sort(), 'Unexpected delivery path inventory.');
  let page;
  for (const [pathname, source] of Object.entries(plan.sources)) {
    assert.equal(source, DELIVERY_SOURCES[pathname], 'Unexpected public-source mapping.');
    const expected = fs.readFileSync(path.join(root, source));
    assert.equal(sha1(expected), plan.files[pathname], 'Local upload bytes changed.');
    const response = await fetchImpl(new URL(pathname, origin), { redirect: 'error', signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200, 'Static delivery failed: ' + pathname);
    const type = response.headers.get('content-type') || '';
    assert(pathname.endsWith('.js') ? /javascript|ecmascript/i.test(type)
      : pathname.endsWith('.css') ? /text\/css/i.test(type) : /text\/html/i.test(type),
    'Incorrect content type: ' + pathname);
    assertServedContent(path.basename(pathname), Buffer.from(await response.arrayBuffer()), expected);
    if (pathname === '/dapp/index.html') {
      page = expected;
      const html = expected.toString('utf8');
      assert.equal(html.split(ARBORETUM_SNIPPET).length, 2, 'Preserve exactly one stored baseline site snippet.');
      const references = [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)]
        .map(match => new URL(match[1], 'https://tree-token.xyz/dapp/').pathname);
      for (const dependency of ['/dapp/app.js', '/dapp/stats-market.css', '/dapp/sti-purchase.css', '/dapp/sti-wallet-recovery.js']) {
        assert(references.includes(dependency), 'Missing current Stats dependency: ' + dependency);
        assert(Object.hasOwn(plan.files, dependency), 'Dependency is absent from production inventory: ' + dependency);
      }
      for (const dependency of ['/dapp/sti-widget.js', '/dapp/sti-purchase-core.js']) {
        assert(Object.hasOwn(plan.files, dependency), 'STI module is absent from production inventory: ' + dependency);
      }
    }
  }
  assert(page, 'STI HTML was not checked.');
  const canonical = await fetchImpl(new URL('/dapp/', origin), { redirect: 'error', signal: AbortSignal.timeout(30000) });
  assert.equal(canonical.status, 200, 'The canonical Stats route is unavailable.');
  assert(/text\/html/i.test(canonical.headers.get('content-type') || ''), 'Canonical route did not return HTML.');
  assertServedContent('index.html', Buffer.from(await canonical.arrayBuffer()), page);
}
