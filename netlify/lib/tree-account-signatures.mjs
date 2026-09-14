import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import { createPublicClient, getAddress, http, verifyMessage } from 'viem';
import { createSiweMessage } from 'viem/siwe';
export function makeEvmMessage({ wallet, nonce, issuedAt, expiresAt, origin }) {
  return createSiweMessage({ address: getAddress(wallet.address), chainId: wallet.chainId, domain: new URL(origin).host,
    uri: `${origin}/play/account/`, version: '1', nonce, issuedAt: new Date(issuedAt), expirationTime: new Date(expiresAt),
    statement: 'Sign in to TREE Arcade preview. No transaction, approval, NFT entitlement or credit purchase.' });
}
export async function verifyWalletProof(proof, signature, clientFactory = createPublicClient) {
  const { wallet, message } = proof;
  if (wallet.family === 'sui') {
    try { await verifyPersonalMessageSignature(new TextEncoder().encode(message), signature, { address: wallet.address }); return 'sui'; } catch { return null; }
  }
  try { if (await verifyMessage({ address: getAddress(wallet.address), message, signature })) return 'eoa'; } catch {}
  const rpc = wallet.chainId === 97 ? 'https://bsc-testnet-dataseed.bnbchain.org' : wallet.chainId === 46630 ? 'https://rpc.testnet.chain.robinhood.com' : null;
  if (!rpc) return null;
  const client = clientFactory({ transport: http(rpc, { timeout: 8000, retryCount: 0 }) });
  const valid = await client.verifySiweMessage({ address: getAddress(wallet.address), message, signature, domain: new URL(proof.origin).host, nonce: proof.nonce });
  return valid ? 'contract' : null;
}
