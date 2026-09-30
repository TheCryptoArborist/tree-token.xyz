// Generates ONLY #[test_only] Move fixtures. Never publishes or connects to a network.
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { vectors, fixture, golden } from './fixture.mjs';
import { Purchase } from '../codec.mjs';
const v=vectors();
assert.equal(v.base.bytes,golden.quoteHex,'Independent Python BCS golden vector mismatch');
assert.equal(v.base.signature,golden.signatureHex,'Independent Ed25519 golden vector mismatch');
let source='// Generated PUBLIC test vectors. NOT a wallet or production authority.\n#[test_only]\nmodule canopy_checkout::vectors;\n';
source+=`public fun key(): vector<u8> { x"${golden.publicKey}" }\n`;
source+=`public fun checkout_id(): address { @${golden.checkoutId} }\n`;
for(const [name,p] of Object.entries(v)){
 source+=`public fun ${name}(): (vector<u8>, vector<u8>) { (x"${p.bytes}",x"${p.signature}") }\n`;
}
source+=`public fun purchase_bytes(): vector<u8> { x"${Buffer.from(Purchase.serialize(fixture().purchase).toBytes()).toString('hex')}" }\n`;
writeFileSync(new URL('../../../contract/tests/vectors.move',import.meta.url),source);
console.log('Generated test-only Move vectors; independent BCS/signature goldens match.');
