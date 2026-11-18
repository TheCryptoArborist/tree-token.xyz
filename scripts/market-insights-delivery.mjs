import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export const DELIVERY_PATHS = ['/market-insights/index.html', '/market-insights/insights.js', '/market-insights/sentiment.js', '/scripts/homepage-refresh.js'];
// This exact, existing site snippet only acts on the Arcade lobby. Preserve its
// configuration; tolerate its known delivery insertion without changing any stored bytes.
export const ARBORETUM_SNIPPET = "<script id=\"tree-arcade-arboretum-link\">(()=>{if(!/^\\/play(?:\\/|\\/index\\.html)?$/.test(location.pathname))return;const old=document.querySelector(\".arboretum-card .game-action\");if(!old||old.tagName===\"A\")return;const link=document.createElement(\"a\");link.className=\"game-action play-action\";link.href=\"https://treegrow.xyz/\";link.target=\"_blank\";link.rel=\"noopener noreferrer\";link.append(\"OPEN ARBORETUM \");const arrow=document.createElement(\"span\");arrow.setAttribute(\"aria-hidden\",\"true\");arrow.textContent=\"→\";link.append(arrow);old.replaceWith(link);})();</script>";
const sha = (bytes, algorithm='sha256') => crypto.createHash(algorithm).update(bytes).digest('hex');

export function assertServedContent(name, actual, expected) {
  if (sha(actual)===sha(expected)) return;
  assert.equal(name,'index.html','Static asset bytes differ.');
  const parts=actual.toString('utf8').split(ARBORETUM_SNIPPET);
  assert.equal(parts.length,2,'Unexpected served HTML mutation.');
  // Keep the source's whitespace. Only one exact known snippet immediately
  // before the closing body/html tags may be removed for this delivery check.
  assert(/^\s*<\/body>\s*<\/html>\s*$/i.test(parts[1]),'Site snippet is not at the body end.');
  assert.equal(sha(Buffer.from(parts.join(''))),sha(expected),'HTML differs beyond the exact existing site snippet.');
}

export function assertResourcesLink(source) {
  const resources=[...source.matchAll(/<details\s+class=["']home-resources["']\s*>([\s\S]*?)<\/details>/g)];
  assert.equal(resources.length,1,'Expected one homepage Resources menu.');
  assert(/<summary>\s*Resources\s*<\/summary>/.test(resources[0][1]),'Homepage Resources label missing.');
  assert(/<a\s+href=["']\/market-insights\/["']\s*>\s*Market Insights\s*<\/a>/.test(resources[0][1]),'Market Insights link is missing from Resources.');
}

export async function verifyDelivery(origin, plan, root, servedCheck=assertServedContent, fetchImpl=globalThis.fetch) {
  const url=new URL(origin);
  assert(url.protocol==='https:' && (url.hostname==='tree-token.xyz' ||
    /^[a-f0-9]{24}--tree-token\.netlify\.app$/.test(url.hostname)) &&
    url.pathname==='/' && !url.search && !url.hash,'Unapproved delivery origin.');
  assert.deepEqual(Object.keys(plan.sources).sort(),[...DELIVERY_PATHS].sort(),'Unexpected delivery path inventory.');
  let page;
  for (const [pathname,source] of Object.entries(plan.sources)) {
    assert.equal(source,pathname.slice(1),'Unexpected public-source mapping.');
    const expected=fs.readFileSync(path.join(root,source));
    assert.equal(sha(expected,'sha1'),plan.files[pathname],'Local upload bytes changed.');
    const response=await fetchImpl(new URL(pathname,origin),{redirect:'error',signal:AbortSignal.timeout(30000)});
    assert.equal(response.status,200,'Static delivery failed: '+pathname);
    const contentType=response.headers.get('content-type')||'';
    assert(pathname.endsWith('.js')?/javascript|ecmascript/i.test(contentType):/text\/html/i.test(contentType),'Incorrect content type: '+pathname);
    servedCheck(path.basename(pathname),Buffer.from(await response.arrayBuffer()),expected);
    if(pathname==='/scripts/homepage-refresh.js')assertResourcesLink(expected.toString('utf8'));
    if(pathname==='/market-insights/index.html'){
      page=expected;
      const html=expected.toString('utf8');
      for(const dependency of ['/market-insights/insights.js','/market-insights/sentiment.js']){
        assert(html.includes('src="'+dependency+'"')||html.includes("src='"+dependency+"'"),'Missing canonical script dependency: '+dependency);
        assert(Object.hasOwn(plan.files,dependency),'Script dependency is absent from production inventory.');
      }
    }
  }
  assert(page,'Market Insights HTML was not checked.');
  const canonical=await fetchImpl(new URL('/market-insights/',origin),{redirect:'error',signal:AbortSignal.timeout(30000)});
  assert.equal(canonical.status,200,'The canonical Market Insights route is unavailable.');
  assert(/text\/html/i.test(canonical.headers.get('content-type')||''),'Canonical route did not return HTML.');
  servedCheck('index.html',Buffer.from(await canonical.arrayBuffer()),page);
}

