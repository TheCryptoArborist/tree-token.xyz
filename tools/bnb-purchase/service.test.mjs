import test from 'node:test';import assert from 'node:assert/strict';import handler from '../../netlify/preview-functions/generation-purchase-custody.mjs';
test('fixed custody service refuses writes',async()=>assert.equal((await handler(new Request('https://tree-token.xyz/api/generation-purchase-custody',{method:'POST',body:'signature'}))).status,405));
test('fixed custody service refuses input overrides',async()=>assert.equal((await handler(new Request('https://tree-token.xyz/api/generation-purchase-custody?digest=other'))).status,502));
