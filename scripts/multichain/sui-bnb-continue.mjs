// Source-only mixed-chain payment boundary. No route or live game mutation.
import {createHash, randomBytes} from 'node:crypto';
import {verifyPersonalMessageSignature} from '@mysten/sui/verify';
import {encodeFunctionData, decodeEventLog, keccak256, parseAbi, verifyMessage} from 'viem';
export const CONTINUE_POLICY = Object.freeze({
  origin: 'https://tree-token.xyz', chainId: 56, product:'treeforce89.continue.v1', restoreLives:3,
  token: '0x55d398326f99059ff775485246999027b3197955',
  treasury: '0xc440f06bbc7e58b0d055815f915447e4ae0e3720',
  amount: '1000000000000000000', // Exactly one 18-decimal BNB USDT; not an oracle quote.
});
const ABI = parseAbi(['function transfer(address to,uint256 amount) returns (bool)', 'event Transfer(address indexed from,address indexed to,uint256 value)']);
const sha = s => createHash('sha256').update(s).digest('hex');
const check = (v, reason) => { if (!v) throw new Error(reason); };
const hex32 = s => typeof s === 'string' && /^0x[0-9a-f]{64}$/.test(s);
const uuid = s => typeof s === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(s);
const evm = s => typeof s === 'string' && /^0x[0-9a-f]{40}$/.test(s) && !/^0x0{40}$/.test(s);
export const continueTransferData = () => encodeFunctionData({abi: ABI, functionName: 'transfer', args: [CONTINUE_POLICY.treasury, BigInt(CONTINUE_POLICY.amount)]});
export function continueLinkMessage(row) {
  return ['TREE Arcade BNB Continue Wallet Link', 'Version: 1', 'Origin: '+CONTINUE_POLICY.origin,
    'Sui wallet: '+row.suiWallet, 'BNB wallet: '+row.payer, 'Chain ID: 56',
    'Account: '+row.accountId, 'Delivery protocol: '+row.deliveryProtocol,
    'Session binding: '+row.sessionHash, 'Run: '+row.runId, 'Continue number: '+row.sequence,
    'Nonce: '+row.id, 'Expires: '+new Date(row.expiresAt).toISOString(),
    'Purpose: Link these wallets for one 1 USDT continue checkout. This signature does not transfer funds or approve tokens.'].join('\n');
}
export async function verifyContinueLink(row, suiSignature, bnbSignature) {
  const message = continueLinkMessage(row);
  await verifyPersonalMessageSignature(new TextEncoder().encode(message), suiSignature, {address: row.suiWallet});
  return verifyMessage({address: row.payer, message, signature: bnbSignature});
}

// Call only with a trusted server-created public client. No browser receipt JSON.
export function createContinuePaymentReader(client, expectedTokenCodeHash) {
  check(hex32(expectedTokenCodeHash) && !/^0x0{64}$/.test(expectedTokenCodeHash), 'unreviewed-token');
  return async txHash => {
    check(hex32(txHash), 'invalid-transaction');
    check(await client.getChainId() === 56, 'wrong-chain');
    const receipt = await client.getTransactionReceipt({hash: txHash});
    const [transaction, block, finalized, code] = await Promise.all([
      client.getTransaction({hash: txHash}), client.getBlock({blockNumber: receipt.blockNumber}),
      client.getBlock({blockTag: 'finalized'}), client.getCode({address: CONTINUE_POLICY.token, blockNumber: receipt.blockNumber}),
    ]);
    check(typeof code === 'string' && keccak256(code) === expectedTokenCodeHash, 'changed-token');
    // Re-read the receipt's canonical block after other RPC calls.
    const canonical = await client.getBlock({blockNumber: receipt.blockNumber});
    check(canonical.hash === block.hash && block.hash === receipt.blockHash && finalized.number >= receipt.blockNumber, 'unfinalized-payment');
    return {transaction, receipt, block, finalized, chainId: 56};
  };
}
export function verifyContinuePayment(proof, offer, txHash) {
  const {transaction: tx, receipt: r, block, finalized} = proof ?? {};
  check(proof?.chainId === 56 && tx?.hash === txHash && r?.transactionHash === txHash &&
    r.status === 'success' && tx.blockHash === r.blockHash && block?.hash === r.blockHash &&
    tx.blockNumber === r.blockNumber && block.number === r.blockNumber && finalized?.number >= r.blockNumber, 'unconfirmed-payment');
  check(tx.from?.toLowerCase() === offer.payer && tx.to?.toLowerCase() === CONTINUE_POLICY.token &&
    tx.value === 0n && tx.input?.toLowerCase() === continueTransferData().toLowerCase(), 'wrong-payment');
  const paidAt = Number(block.timestamp) * 1000;
  check(Number.isSafeInteger(paidAt) && paidAt >= offer.issuedAt && paidAt < offer.expiresAt, 'outside-payment-window');
  const transfers = (r.logs ?? []).filter(l => l.address?.toLowerCase() === CONTINUE_POLICY.token).flatMap(l => {
    try { return [{log: l, decoded: decodeEventLog({abi: ABI, data: l.data, topics: l.topics, strict: true})}]; } catch { return []; }
  });
  check(transfers.length === 1, 'ambiguous-transfer');
  const {log, decoded: event} = transfers[0];
  check(log.removed === false && log.transactionHash === txHash && log.blockHash === r.blockHash &&
    Number.isSafeInteger(log.logIndex) && log.logIndex >= 0 &&
    event.eventName === 'Transfer' && event.args.from.toLowerCase() === offer.payer &&
    event.args.to.toLowerCase() === CONTINUE_POLICY.treasury && event.args.value === BigInt(CONTINUE_POLICY.amount), 'wrong-transfer');
  return {paymentKey: `56:${txHash}:${log.logIndex}`, txHash, blockHash: block.hash, paidAt};
}

export function createSuiBnbContinue({readSuiRun, store, readPayment, clock = Date.now, entropy = randomBytes}) {
  check(typeof readSuiRun === 'function' && typeof readPayment === 'function' &&
    ['insertChallenge','read','open','recordPayment'].every(k => typeof store?.[k] === 'function'), 'unavailable');
  async function session(input, requireAccess = true) {
    check(input.origin === CONTINUE_POLICY.origin && typeof input.sessionToken === 'string' && /^[a-f0-9]{64}$/.test(input.sessionToken), 'invalid-session');
    const started = clock(), s = await readSuiRun(input.sessionToken), at = Date.parse(s?.checkedAt), now = clock();
    check(s?.authenticated === true && s.revoked === false && s.sessionHash === sha(input.sessionToken) &&
      hex32(s.suiWallet) && uuid(s.accountId) && uuid(s.runId) && s.deliveryProtocol === 'tree-paid-delivery.v1' &&
      Number.isSafeInteger(s.sequence) && s.sequence > 0 && s.expiresAt > now &&
      at >= started && at <= now && now - started <= 10000, 'invalid-session');
    if (requireAccess) check(s.entitled === true && s.lives === 0 && s.continueAllowed === true && Number.isSafeInteger(s.continuesUsed) && s.continuesUsed >= 0 && s.continuesUsed < 2147483647 && s.sequence === s.continuesUsed + 1 && s.finished === false && s.ruleset === 'treeforce89.v1', 'continue-denied');
    return s;
  }
  const same = (r, s) => r.accountId === s.accountId && r.deliveryProtocol === s.deliveryProtocol && r.sessionHash === s.sessionHash && r.suiWallet === s.suiWallet && r.runId === s.runId && r.sequence === s.sequence;
  return Object.freeze({
    async challenge(input) {
      check(evm(input.payer), 'invalid-payer');const s = await session(input), now = clock();
      const row = {id: entropy(32).toString('hex'), sessionHash: s.sessionHash, suiWallet: s.suiWallet,
        accountId: s.accountId, deliveryProtocol: s.deliveryProtocol, runId: s.runId, sequence: s.sequence, payer: input.payer, issuedAt: now,
        expiresAt: Math.min(now + 300000, s.expiresAt), status: 'challenge'};
      check(/^[a-f0-9]{64}$/.test(row.id), 'invalid-entropy');
      check(await store.insertChallenge(row) === true, 'checkout-conflict');
      return {id: row.id, message: continueLinkMessage(row), expiresAt: row.expiresAt, paymentEnabled: false};
    },
    async open(input) {
      check(/^[a-f0-9]{64}$/.test(input.id || ''), 'invalid-checkout');
      const s = await session(input), row = await store.read(input.id);
      check(row?.status === 'challenge' && same(row,s) && row.expiresAt > clock(), 'invalid-checkout');
      check(await verifyContinueLink(row,input.suiSignature,input.bnbSignature) === true, 'signature-mismatch');
      const fresh = await session(input);check(same(row,fresh), 'run-changed');
      // Atomic nonce consume + one active checkout per payer AND per run/sequence.
      check(await store.open({...row, now: clock()}) === true, 'checkout-conflict');
      return {id: row.id, product:CONTINUE_POLICY.product, restoreLives:CONTINUE_POLICY.restoreLives, chainId:56, token:CONTINUE_POLICY.token, recipient:CONTINUE_POLICY.treasury,
        amount:CONTINUE_POLICY.amount, notBefore:Math.ceil(row.issuedAt/1000)*1000, data:continueTransferData(), expiresAt:row.expiresAt,
        paymentEnabled:false, reviewOnly:true};
    },
    async reconcile(input) {
      check(/^[a-f0-9]{64}$/.test(input.id || '') && hex32(input.txHash), 'invalid-payment');
      // An access loss must not erase a payment: reconcile into review, never
      // silently discard funds or tell the player to send another payment.
      const s = await session(input,false), row = await store.read(input.id);
      check(row && ['open','paid-review'].includes(row.status) && same(row,s), 'invalid-checkout');
      const started = clock(), proof = await readPayment(input.txHash);
      check(clock() >= started && clock() - started <= 10000, 'stale-payment-read');
      const payment = verifyContinuePayment(proof,row,input.txHash);
      const fresh = await session(input,false);check(same(row,fresh), 'run-changed');
      // Durable insert has globally unique paymentKey AND txHash, immutable
      // offer binding, and returns true for exact replay of the same receipt.
      check(await store.recordPayment({id:row.id,sessionHash:row.sessionHash,...payment}) === true, 'payment-conflict');
      return {id:row.id, paymentVerified:true, requiresReview:true, continueAuthorized:false, gameplayAuthorized:false};
    },
  });
}
