import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {C,validateState,registration,verifyRegistration} from './registration-review.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('../../../docs/multichain/generation-milestone/path-review/registration-simulation.json',import.meta.url)));
const fresh=()=>{const s=structuredClone(fixture.state);s.checkpoint.timestamp=new Date().toISOString();return s;};
test('checked mainnet simulation creates only its own channel and registry entry',()=>{assert.equal(verifyRegistration(fixture.result,fixture.state).gasMist,'4668124');});
test('registration intent only registers the new package and empty vault',()=>{const tx=registration(fresh()).getData();assert.equal(tx.commands.length,1);assert.equal(tx.commands[0].MoveCall.package,C.package);assert.equal(tx.commands[0].MoveCall.function,'register');assert.equal(BigInt(tx.gasData.budget),20000000n);});
for(const [label,mutate] of [
 ['wrong owner',s=>s.admin.owner.address.address='0x'+'1'.repeat(64)],
 ['retired vault',s=>s.vault.address='0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c'],
 ['already registered',s=>s.registration.dynamicField={value:{json:{messaging_channel:'existing'}}}],
 ['bound vault',s=>s.vault.asMoveObject.contents.json.bound=true],
 ['funded vault',s=>s.vault.asMoveObject.contents.json.nft={id:C.nft}],
 ['wrong endpoint',s=>s.endpoint.asMoveObject.contents.json.eid=30102],
 ['stale state',s=>s.checkpoint.timestamp='2020-01-01T00:00:00Z'],
])test('preflight rejects '+label,()=>{const s=fresh();mutate(s);assert.throws(()=>validateState(s));});
for(const [label,mutate]of [
 ['sender',r=>r.Transaction.transaction.sender='0x'+'1'.repeat(64)],
 ['extra command',r=>r.Transaction.transaction.commands.push(r.Transaction.transaction.commands[0])],
 ['wrong package',r=>r.Transaction.transaction.commands[0].MoveCall.package='0x'+'1'.repeat(64)],
 ['over-budget',r=>r.Transaction.transaction.gasData.budget='20000001'],
 ['metadata injection',r=>r.Transaction.transaction.inputs[3].Pure.bytes='AQE='],
 ['NFT mutation',r=>r.Transaction.effects.changedObjects.push({objectId:C.nft})],
 ['cap transfer',r=>{const cap=r.Transaction.effects.changedObjects.find(x=>x.objectId===C.admin);cap.outputOwner={AddressOwner:'0x'+'1'.repeat(64)};}],
 ['wrong registration identity',r=>r.Transaction.events[0].json.oapp=C.oapp],
])test('simulation proof rejects '+label,()=>{const r=structuredClone(fixture.result);mutate(r);assert.throws(()=>verifyRegistration(r,fixture.state));});
