import assert from 'node:assert/strict';
import crypto from 'node:crypto';
// Existing Netlify site-wide body snippet, observed on the preserved live site.
// It only acts on /play/ and exits on /rootcaster/. No other mutations allowed.
export const ARBORETUM_SNIPPET = "<script id=\"tree-arcade-arboretum-link\">(()=>{if(!/^\\/play(?:\\/|\\/index\\.html)?$/.test(location.pathname))return;const old=document.querySelector(\".arboretum-card .game-action\");if(!old||old.tagName===\"A\")return;const link=document.createElement(\"a\");link.className=\"game-action play-action\";link.href=\"https://treegrow.xyz/\";link.target=\"_blank\";link.rel=\"noopener noreferrer\";link.append(\"OPEN ARBORETUM \");const arrow=document.createElement(\"span\");arrow.setAttribute(\"aria-hidden\",\"true\");arrow.textContent=\"→\";link.append(arrow);old.replaceWith(link);})();</script>";
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export function assertServedContent(name, actual, expected) {
  if(digest(actual)===digest(expected)) return;
  assert.equal(name,'index.html','Candidate static asset bytes differ');
  const html=actual.toString('utf8');
  assert.equal(html.split(ARBORETUM_SNIPPET).length,2,'Unexpected served HTML mutation');
  assert(html.endsWith(ARBORETUM_SNIPPET+'</body></html>\n') || html.endsWith(ARBORETUM_SNIPPET+'</body></html>'),'Snippet is not in its expected body-end position');
  assert.equal(digest(Buffer.from(html.replace(ARBORETUM_SNIPPET,''))),digest(expected),'Candidate HTML differs beyond the exact existing snippet');
}
