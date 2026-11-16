import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export async function verifyDelivery(origin, plan, root, assertServedContent) {
  const url = new URL(origin);
  assert(url.protocol === 'https:' && (url.hostname === 'tree-token.xyz' ||
    /^[a-f0-9]{24}--tree-token\.netlify\.app$/.test(url.hostname)), 'Unapproved delivery origin.');
  for (const [pathname, source] of Object.entries(plan.sources)) {
    assert(pathname.startsWith('/play/multichaintest/'), 'Unexpected delivery path.');
    const expected = fs.readFileSync(path.join(root, source));
    assert.equal(crypto.createHash('sha1').update(expected).digest('hex'), plan.files[pathname], 'Local source changed.');
    const response = await fetch(new URL(pathname, origin), { redirect:'error', signal:AbortSignal.timeout(30000) });
    assert(response.ok, 'Test page delivery failed: ' + pathname);
    assertServedContent(path.basename(pathname), Buffer.from(await response.arrayBuffer()), expected);
  }
}
