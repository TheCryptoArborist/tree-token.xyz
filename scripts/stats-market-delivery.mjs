import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Public paths map to new, explicit overlay sources. Historical manifest files
// and all other currently deployed paths remain unchanged.
export const DELIVERY_SOURCES = {
  '/dapp/index.html': 'production/stats-market-static/index.html',
  '/dapp/app.js': 'production/stats-market-static/app.js',
  '/dapp/stats-market.css': 'production/stats-market-static/stats-market.css',
};
export const DELIVERY_PATHS = Object.keys(DELIVERY_SOURCES);
// The stored current dapp HTML already contains one copy. Netlify adds exactly
// one more at delivery. Preserve the stored bytes and existing site configuration.
export const ARBORETUM_SNIPPET = "<script id=\"tree-arcade-arboretum-link\">(()=>{if(!/^\\/play(?:\\/|\\/index\\.html)?$/.test(location.pathname))return;const old=document.querySelector(\".arboretum-card .game-action\");if(!old||old.tagName===\"A\")return;const link=document.createElement(\"a\");link.className=\"game-action play-action\";link.href=\"https://treegrow.xyz/\";link.target=\"_blank\";link.rel=\"noopener noreferrer\";link.append(\"OPEN ARBORETUM \");const arrow=document.createElement(\"span\");arrow.setAttribute(\"aria-hidden\",\"true\");arrow.textContent=\"→\";link.append(arrow);old.replaceWith(link);})();</script>";
const sha = (bytes, algorithm='sha256') => crypto.createHash(algorithm).update(bytes).digest('hex');

export function assertServedContent(name, actual, expected) {
  if (sha(actual) === sha(expected)) return;
  assert.equal(name, 'index.html', 'Static asset bytes differ.');
  const html = actual.toString('utf8');
  const insertion = html.lastIndexOf(ARBORETUM_SNIPPET);
  assert(insertion >= 0, 'Unexpected served HTML mutation.');
  const suffix = html.slice(insertion + ARBORETUM_SNIPPET.length);
  assert(/^\s*<\/body>\s*<\/html>\s*$/i.test(suffix), 'Site snippet is not at the body end.');
  // Remove only the final delivery insertion, leaving the exact existing stored
  // copy and source whitespace untouched. Extra/moved/changed scripts still fail.
  const normalized = Buffer.from(html.slice(0, insertion) + suffix);
  assert.equal(sha(normalized), sha(expected), 'HTML differs beyond the exact existing site snippet.');
}

export async function verifyDelivery(origin, plan, root, servedCheck=assertServedContent, fetchImpl=globalThis.fetch) {
  const url = new URL(origin);
  assert(url.protocol === 'https:' && (url.hostname === 'tree-token.xyz' ||
    /^[a-f0-9]{24}--tree-token\.netlify\.app$/.test(url.hostname)) &&
    url.pathname === '/' && !url.search && !url.hash, 'Unapproved delivery origin.');
  assert.deepEqual(Object.keys(plan.sources).sort(), [...DELIVERY_PATHS].sort(), 'Unexpected delivery path inventory.');
  let page;
  for (const [pathname, source] of Object.entries(plan.sources)) {
    assert.equal(source, DELIVERY_SOURCES[pathname], 'Unexpected public-source mapping.');
    const expected = fs.readFileSync(path.join(root, source));
    assert.equal(sha(expected, 'sha1'), plan.files[pathname], 'Local upload bytes changed.');
    const response = await fetchImpl(new URL(pathname, origin), {redirect:'error', signal:AbortSignal.timeout(30000)});
    assert.equal(response.status, 200, 'Static delivery failed: ' + pathname);
    const contentType = response.headers.get('content-type') || '';
    const correctType = pathname.endsWith('.js') ? /javascript|ecmascript/i.test(contentType)
      : pathname.endsWith('.css') ? /text\/css/i.test(contentType) : /text\/html/i.test(contentType);
    assert(correctType, 'Incorrect content type: ' + pathname);
    servedCheck(path.basename(pathname), Buffer.from(await response.arrayBuffer()), expected);
    if (pathname === '/dapp/index.html') {
      page = expected;
      const html = expected.toString('utf8');
      assert.equal(html.split(ARBORETUM_SNIPPET).length, 2, 'Preserve exactly one stored baseline site snippet.');
      const references = [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)]
        .map(match => new URL(match[1], 'https://tree-token.xyz/dapp/').pathname);
      for (const dependency of ['/dapp/app.js', '/dapp/stats-market.css']) {
        assert(references.includes(dependency), 'Missing Stats dependency: ' + dependency);
        assert(Object.hasOwn(plan.files, dependency), 'Dependency is absent from production inventory: ' + dependency);
      }
    }
  }
  assert(page, 'Stats HTML was not checked.');
  const canonical = await fetchImpl(new URL('/dapp/', origin), {redirect:'error', signal:AbortSignal.timeout(30000)});
  assert.equal(canonical.status, 200, 'The canonical Stats route is unavailable.');
  assert(/text\/html/i.test(canonical.headers.get('content-type') || ''), 'Canonical route did not return HTML.');
  servedCheck('index.html', Buffer.from(await canonical.arrayBuffer()), page);
}
