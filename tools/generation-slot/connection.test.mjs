import test from 'node:test';import assert from 'node:assert/strict';import {connectApproved} from './connection.mjs';import {SENDER} from './core.mjs';
const account={address:SENDER,chains:['sui:mainnet']};
const wallet=(accounts,connect)=>({accounts,features:{'sui:signTransaction':{version:'2.0.0'},'standard:connect':{connect}}});
test('existing authorized account does not reopen connection',async()=>assert.equal(await connectApproved(wallet([account],()=>{throw Error('must not call')})),account));
test('connection return works before accounts getter updates',async()=>assert.equal(await connectApproved(wallet([],async()=>({accounts:[account]}))),account));
test('wrong previously shared account does not hide correct returned account',async()=>assert.equal(await connectApproved(wallet([{address:'0x1'}],async()=>({accounts:[account]}))),account));
test('no account produces explicit shared-address guidance',async()=>assert.rejects(connectApproved(wallet([],async()=>({accounts:[{address:'0x1'}]}))),/Shared accounts: 0x1/));
test('stalled extension has progress then a bounded actionable error',async()=>{const progress=[];await assert.rejects(connectApproved(wallet([],()=>new Promise(()=>{})),{timeoutMs:5,status:s=>progress.push(s)}),/has not answered/);assert.match(progress[0],/Waiting for Slush/);});
test('rejected connection preserves the wallet error',async()=>assert.rejects(connectApproved(wallet([],async()=>{throw Error('User rejected')})),/User rejected/));
