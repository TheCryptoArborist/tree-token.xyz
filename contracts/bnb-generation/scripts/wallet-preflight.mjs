// Offline intent checks only. No RPC, signer, deployment or binding is performed.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getAddress} from 'ethers';
import selected from '../../../docs/multichain/generation-milestone/selected-wallets.json' with {type:'json'};
export function verifyWalletIntent({address,chainId,treasury}) {
 assert.equal(BigInt(chainId),56n,'BNB mainnet required');
 const admin=getAddress('0xF2Ab1eEBbEcb4E315FE95D8b532D1aB00F1A8789');
 const fee=getAddress('0xC440F06BBC7e58b0d055815f915447e4ae0E3720');
 assert.equal(getAddress(address),admin,'Selected admin must deploy directly');
 assert.equal(getAddress(treasury),fee,'Treasury must remain unchanged');
 assert.equal(selected.chainId,56);
 for(const role of ['deployer','adapterBinder','passController','initialBuyer','initialEndpointDelegate'])assert.equal(getAddress(selected.bnb[role]),admin);
 assert.equal(getAddress(selected.bnb.treasury),fee);
 const policy=readFileSync(new URL('../src/Policy.sol',import.meta.url),'utf8');
 assert(policy.includes('TREASURY = '+fee+';'),'Source treasury differs from approved selection');
 return {admin,treasury:fee,chainId:56,deploymentReady:false,
  remaining:'New Sui publication and canonical Vault are recorded. Refresh the BNB deployment review, nonce and exact bytes before separately approved MetaMask/Ledger signing. Simulation BNB addresses remain conditional predictions.'};
}
