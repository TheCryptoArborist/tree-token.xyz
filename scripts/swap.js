import { Transaction } from 'https://esm.run/@mysten/sui@1.43.0/transactions';
import { SuiClient } from 'https://esm.run/@mysten/sui@1.43.0/client';

/*
  TREE direct swap module for browser use.
  Requires:
  - window.playerAddress
  - window.currentWallet
  - window.signAndExecuteTransactionBlock(tx)

  Loaded with:
  <script type="module" src="scripts/swap.js"></script>
*/

// ─────────────────────────────────────────────────────────────────────────────
// SuiDex constants from your swap page
// ─────────────────────────────────────────────────────────────────────────────
const PACKAGE_ID =
  '0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a';
const ROUTER =
  '0x9cdbbd092634efdc0e7033dc1c49d9ea5fc9bc5969ba708f55e05b6fcac12177';
const FACTORY =
  '0x81c286135713b4bf2e78c548f5643766b5913dcd27a8e76469f146ab811e922d';
const CLOCK =
  '0x0000000000000000000000000000000000000000000000000000000000000006';

// ─────────────────────────────────────────────────────────────────────────────
// Token types for this site
// ─────────────────────────────────────────────────────────────────────────────
const SUI_TYPE = '0x2::sui::SUI';
const TREE_TYPE =
  '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';

// TREE/SUI SuiDex pool object id (from on-chain router tx)
const TREE_SUI_POOL_ID =
  '0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc';

// Your site and wallet.js are built for mainnet usage
const RPC_URL = 'https://fullnode.mainnet.sui.io:443';
const DEFAULT_SLIPPAGE_BPS = 100; // 1%

const client = new SuiClient({ url: RPC_URL });

// Assumption for this direct pair on SuiDex:
// token0 = SUI, token1 = TREE
// If the real pool is reversed, flip the function names in build*Tx below.
const POOL = {
  id: TREE_SUI_POOL_ID,
  t0: SUI_TYPE,
  t1: TREE_TYPE,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function normalizeType(type) {
  return String(type || '').trim().toLowerCase();
}

function isValidAddress(addr) {
  return typeof addr === 'string' && addr.startsWith('0x') && addr.length > 10;
}

function ensureWalletReady() {
  if (!isValidAddress(window.playerAddress)) {
    throw new Error('Wallet not connected');
  }
  if (typeof window.signAndExecuteTransactionBlock !== 'function') {
    throw new Error('Wallet executor not ready');
  }
  // Only treat as missing if unset or left on a placeholder value
  if (
    !TREE_SUI_POOL_ID ||
    TREE_SUI_POOL_ID === 'PASTE_TREE_SUI_POOL_ID_HERE'
  ) {
    throw new Error('TREE_SUI_POOL_ID is still missing in scripts/swap.js');
  }
}

function parseAmountToBaseUnits(value, decimals = 9) {
  const s = String(value ?? '').trim();
  if (!s) throw new Error('Amount is required');

  if (!/^\d+(\.\d+)?$/.test(s)) {
    throw new Error('Invalid amount');
  }

  const [whole, frac = ''] = s.split('.');
  const padded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  const raw = `${whole}${padded}`.replace(/^0+/, '') || '0';
  const out = BigInt(raw);

  if (out <= 0n) throw new Error('Amount must be greater than zero');
  return out;
}

function formatBaseUnits(value, decimals = 9, maxFraction = 4) {
  const n = BigInt(value);
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;

  if (frac === 0n) return `${neg ? '-' : ''}${whole.toString()}`;

  let fracStr = frac.toString().padStart(decimals, '0').slice(0, maxFraction);
  fracStr = fracStr.replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole.toString()}${
    fracStr ? '.' + fracStr : ''
  }`;
}

function minOutFromExpected(expectedOut, slippageBps = DEFAULT_SLIPPAGE_BPS) {
  const expected = BigInt(expectedOut);
  if (expected <= 0n) {
    throw new Error('Expected output must be greater than zero');
  }
  return expected - (expected * BigInt(slippageBps)) / 10000n;
}

async function getAllCoins(owner, coinType) {
  const out = [];
  let cursor = null;

  do {
    const page = await client.getCoins({
      owner,
      coinType,
      cursor,
      limit: 50,
    });

    out.push(...(page.data || []));
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);

  return out;
}

async function getBalance(owner, coinType) {
  const bal = await client.getBalance({ owner, coinType });
  return BigInt(bal?.totalBalance || '0');
}

async function getOwnedCoinInput(tx, owner, coinType, amountNeeded) {
  const coins = await getAllCoins(owner, coinType);

  if (!coins.length) {
    throw new Error(
      `No ${coinType.split('::').pop()} coins found in wallet`,
    );
  }

  const total = coins.reduce(
    (sum, coin) => sum + BigInt(coin.balance || '0'),
    0n,
  );
  if (total < amountNeeded) {
    throw new Error(
      `Insufficient ${coinType.split('::').pop()} balance: have ${total.toString()}, need ${amountNeeded.toString()}`,
    );
  }

  const primary = tx.object(coins[0].coinObjectId);

  if (coins.length > 1) {
    tx.mergeCoins(
      primary,
      coins.slice(1).map((c) => tx.object(c.coinObjectId)),
    );
  }

  const [inputCoin] = tx.splitCoins(primary, [tx.pure.u64(amountNeeded)]);
  return inputCoin;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quote helpers
// ─────────────────────────────────────────────────────────────────────────────
// Your page already calculates UI estimates from DexScreener priceNative/priceUsd.
// This module accepts a human-readable decimal token amount from the page.
// BigInt inputs remain supported for internal callers that already use base units.
function coerceExpectedOutBaseUnits(expectedOut, decimals = 9) {
  if (typeof expectedOut === 'bigint') return expectedOut;
  if (typeof expectedOut === 'number') {
    if (!Number.isFinite(expectedOut) || expectedOut <= 0) {
      throw new Error('Invalid expectedOut');
    }
    return parseAmountToBaseUnits(String(expectedOut), decimals);
  }
  if (typeof expectedOut === 'string') {
    // Values supplied by the page are always human-readable token amounts.
    // A whole-number quote such as "10000" therefore means 10,000 TREE,
    // not 10,000 base units.
    return parseAmountToBaseUnits(expectedOut, decimals);
  }
  throw new Error('expectedOut is required');
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction builders
// ─────────────────────────────────────────────────────────────────────────────
async function buildSuiToTreeTx({ owner, amountInMist, minTreeOut }) {
  const tx = new Transaction();
  tx.setSender(owner);

  const [inputCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountInMist)]);

  const [outCoin] = tx.moveCall({
    target: `${PACKAGE_ID}::router::swap_exact_tokens0_for_tokens1_composable`,
    typeArguments: [POOL.t0, POOL.t1],
    arguments: [
      tx.object(ROUTER),
      tx.object(FACTORY),
      tx.object(POOL.id),
      inputCoin,
      tx.pure.u256(minTreeOut),
      tx.object(CLOCK),
    ],
  });

  tx.transferObjects([outCoin], tx.pure.address(owner));
  return tx;
}

async function buildTreeToSuiTx({ owner, amountInBase, minSuiOut }) {
  const tx = new Transaction();
  tx.setSender(owner);

  const inputCoin = await getOwnedCoinInput(tx, owner, TREE_TYPE, amountInBase);

  const [outCoin] = tx.moveCall({
    target: `${PACKAGE_ID}::router::swap_exact_tokens1_for_tokens0_composable`,
    typeArguments: [POOL.t0, POOL.t1],
    arguments: [
      tx.object(ROUTER),
      tx.object(FACTORY),
      tx.object(POOL.id),
      inputCoin,
      tx.pure.u256(minSuiOut),
      tx.object(CLOCK),
    ],
  });

  tx.transferObjects([outCoin], tx.pure.address(owner));
  return tx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public execute helpers
// ─────────────────────────────────────────────────────────────────────────────
async function swapSuiToTree({
  amount,
  expectedOut,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
}) {
  ensureWalletReady();

  const owner = window.playerAddress;
  const amountInMist = parseAmountToBaseUnits(amount, 9);
  const suiBal = await getBalance(owner, SUI_TYPE);

  if (suiBal < amountInMist) {
    throw new Error('Insufficient SUI balance');
  }

  const expectedTreeOut = coerceExpectedOutBaseUnits(expectedOut, 9);
  const minTreeOut = minOutFromExpected(expectedTreeOut, slippageBps);

  const tx = await buildSuiToTreeTx({
    owner,
    amountInMist,
    minTreeOut,
  });

  return await window.signAndExecuteTransactionBlock(tx);
}

async function swapTreeToSui({
  amount,
  expectedOut,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
}) {
  ensureWalletReady();

  const owner = window.playerAddress;
  const amountInTreeBase = parseAmountToBaseUnits(amount, 9);
  const treeBal = await getBalance(owner, TREE_TYPE);

  if (treeBal < amountInTreeBase) {
    throw new Error('Insufficient TREE balance');
  }

  const expectedSuiOut = coerceExpectedOutBaseUnits(expectedOut, 9);
  const minSuiOut = minOutFromExpected(expectedSuiOut, slippageBps);

  const tx = await buildTreeToSuiTx({
    owner,
    amountInBase: amountInTreeBase,
    minSuiOut,
  });

  return await window.signAndExecuteTransactionBlock(tx);
}

async function executeSwap({
  direction,
  amount,
  expectedOut,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
}) {
  const dir = String(direction || '').toUpperCase();

  if (dir === 'SUI_TO_TREE') {
    return await swapSuiToTree({ amount, expectedOut, slippageBps });
  }

  if (dir === 'TREE_TO_SUI') {
    return await swapTreeToSui({ amount, expectedOut, slippageBps });
  }

  throw new Error('Unsupported direction. Use SUI_TO_TREE or TREE_TO_SUI');
}

// ─────────────────────────────────────────────────────────────────────────────
// Optional UI helpers for your current page
// ─────────────────────────────────────────────────────────────────────────────
function estimateMinOutFromUiValue(
  uiValue,
  decimals = 9,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
) {
  const expected = parseAmountToBaseUnits(uiValue, decimals);
  return minOutFromExpected(expected, slippageBps);
}

function getConfig() {
  return {
    PACKAGE_ID,
    ROUTER,
    FACTORY,
    CLOCK,
    SUI_TYPE,
    TREE_TYPE,
    TREE_SUI_POOL_ID,
    RPC_URL,
    DEFAULT_SLIPPAGE_BPS,
  };
}

// Expose for inline page script
window.TREESwap = {
  executeSwap,
  swapSuiToTree,
  swapTreeToSui,
  buildSuiToTreeTx,
  buildTreeToSuiTx,
  parseAmountToBaseUnits,
  formatBaseUnits,
  minOutFromExpected,
  estimateMinOutFromUiValue,
  getBalance: async (coinType) => {
    ensureWalletReady();
    return await getBalance(window.playerAddress, coinType);
  },
  getConfig,
};

console.log('[TREESwap] loaded', {
  pool: TREE_SUI_POOL_ID,
  token0: POOL.t0,
  token1: POOL.t1,
});