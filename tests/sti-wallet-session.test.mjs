import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const source=readFileSync(new URL('../scripts/wallet.js',import.meta.url),'utf8');
const validate=source.match(/function _validateAccountNetwork\(account\) \{[\s\S]*?\n\}/)[0];
const state=source.match(/window.getWalletConnectionState = \(\) => \{[\s\S]*?\n\};/)[0];
function session(chains,change={}) {
  const context={CHAIN:'sui:mainnet',_wallet:{name:'Test'},_account:{address:'0x1',chains},_address:'0x1',window:{playerAddress:'0x1'},getSuiSignFeature:()=>true,...change};
  vm.runInNewContext(validate+'\n'+state,context);
  return context.window.getWalletConnectionState();
}
test('session readiness accepts every network representation permitted by connection validation',()=>{
  for(const chains of [undefined,[],['sui'],['sui:mainnet'],['sui','sui:mainnet']])assert.equal(session(chains).connected,true,JSON.stringify(chains));
});
test('session readiness rejects explicit non-mainnet networks',()=>{
  for(const chains of [['sui:testnet'],['sui:devnet'],['sui','sui:testnet']])assert.equal(session(chains).connected,false);
});
test('network compatibility does not replace signer and address checks',()=>{
  for(const change of [{_wallet:null},{_account:null},{_address:null},{window:{playerAddress:'0x2'}},{getSuiSignFeature:()=>null}])assert.equal(session(['sui'],change).connected,false);
});
