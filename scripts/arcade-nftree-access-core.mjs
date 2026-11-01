// NFTree acquisition logic. No DOM, wallet connection, or automatic purchase retries.
// Contract identities are pinned to nftree_landing f8f014c2869dbaed04735c43f94d01a1a818abaa.
export const NFTREE_SALE_API_URL = 'https://nftree.net/api/nftree-sale-pools';
export const NFTREE_NETWORK = 'sui:mainnet';
export const NFTREE_COLLECTION_PACKAGE = '0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705';
export const NFTREE_COLLECTION_TYPE = `${NFTREE_COLLECTION_PACKAGE}::collection::NFT`;
export const NFTREE_PURCHASE_PACKAGE = '0x79459345a7abde29c4763c97c65f8f48b9e9878dc077ea7ab57c0ad7d585c736';
export const NFTREE_MINT_CONFIG = '0xe83616020f61f73b30c40fd3f888ed397626afd071bd4666374c306d8e98b06b';
export const NFTREE_POOL_IDS = Object.freeze([
  '0x8cb91464eec7ada1af801a439207647d78de66bc0d4f124d6437091745a0163a',
  '0xedd6b2d96968197bc121ad7bed064a43b5ad7d84cbb8b7c00d8fd78bea3e2e4d',
  '0xed43f2ffb52ef542ea2cfccd0358431923460fec8ef659febda111614e20457a',
  '0xfa7b71037b2a8a6bbe36b6cfbccca629f698c767aeb9dad603a0c655adf4de2a',
]);
export const NFTREE_GAS_BUDGET_MIST = '120000000';
export const INVENTORY_MAX_AGE_MS = 90_000;
const U64_MAX = (1n << 64n) - 1n;
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export class MintAccessError extends Error {
  constructor(code, message) { super(message); this.name = 'MintAccessError'; this.code = code; }
}
const fail = (code, message) => { throw new MintAccessError(code, message); };
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const clock = (now) => typeof now === 'function' ? now() : now;
const address = (value) => typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value) ? value.toLowerCase() : '';

function positiveMist(value) {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value) || value.length > 20) {
    fail('INVALID_PRICE', 'The live NFTree price could not be verified.');
  }
  const amount = BigInt(value);
  if (amount > U64_MAX) fail('INVALID_PRICE', 'The live NFTree price is outside the supported range.');
  return value;
}

export function formatMist(value) {
  const text = String(value);
  if (!/^[0-9]+$/.test(text)) fail('INVALID_AMOUNT', 'Invalid SUI amount.');
  const amount = BigInt(text);
  const fraction = (amount % 1_000_000_000n).toString().padStart(9, '0').replace(/0+$/, '');
  return `${amount / 1_000_000_000n}${fraction ? `.${fraction}` : ''} SUI`;
}

export function isValidTransactionDigest(value) {
  if (typeof value !== 'string' || value.length < 32 || value.length > 44) return false;
  let number = 0n;
  for (const char of value) {
    const index = BASE58.indexOf(char);
    if (index < 0) return false;
    number = number * 58n + BigInt(index);
  }
  let bytes = 0;
  while (number > 0n) { bytes++; number >>= 8n; }
  const leading = value.match(/^1*/)[0].length;
  return bytes + leading === 32;
}

export function validateSaleInventory(payload, { now = Date.now(), maxAgeMs = INVENTORY_MAX_AGE_MS } = {}) {
  const currentTime = clock(now);
  if (!plain(payload) || payload.error || payload.source !== 'sui-grpc') {
    fail('INVENTORY_UNVERIFIED', 'Live sales-pool inventory is unavailable. Refresh before purchasing.');
  }
  if (payload.collectionPackageId !== NFTREE_COLLECTION_PACKAGE ||
      payload.latestPackageId !== NFTREE_PURCHASE_PACKAGE || payload.mintConfigId !== NFTREE_MINT_CONFIG) {
    fail('CONTRACT_MISMATCH', 'The sales-pool contract configuration could not be verified.');
  }
  const fetched = typeof payload.fetchedAt === 'string' ? Date.parse(payload.fetchedAt) : NaN;
  if (!Number.isFinite(currentTime) || !Number.isFinite(fetched) || currentTime - fetched > maxAgeMs || fetched - currentTime > 10_000) {
    fail('INVENTORY_STALE', 'Sales-pool inventory is out of date. Refresh before purchasing.');
  }
  const price = positiveMist(payload.mintPriceMist);
  if (!Array.isArray(payload.pools) || payload.pools.length !== NFTREE_POOL_IDS.length) {
    fail('INVALID_POOLS', 'The complete NFTree sales inventory could not be verified.');
  }
  const pools = NFTREE_POOL_IDS.map((poolId, index) => {
    const matches = payload.pools.filter((pool) => plain(pool) && pool.poolId === poolId);
    const pool = matches[0];
    if (matches.length !== 1 || !Number.isSafeInteger(pool.count) || pool.count < 0) {
      fail('INVALID_POOLS', 'A sales-pool identity or inventory count is invalid.');
    }
    return Object.freeze({ poolId, label: `Pool ${index + 1}`, count: pool.count });
  });
  const totalAvailable = pools.reduce((total, pool) => total + pool.count, 0);
  const active = pools.find((pool) => pool.count > 0);
  if (!Number.isSafeInteger(totalAvailable) || payload.totalAvailable !== totalAvailable ||
      payload.activePoolId !== (active?.poolId || '')) {
    fail('INVALID_POOLS', 'The active sales pool or inventory total is inconsistent.');
  }
  return Object.freeze({
    collectionPackageId: NFTREE_COLLECTION_PACKAGE, latestPackageId: NFTREE_PURCHASE_PACKAGE,
    mintConfigId: NFTREE_MINT_CONFIG, mintPriceMist: price, totalAvailable,
    activePoolId: active?.poolId || '', activePoolLabel: active?.label || '',
    pools: Object.freeze(pools), fetchedAt: new Date(fetched).toISOString(), source: 'sui-grpc',
  });
}

export async function loadSaleInventory({ fetchImpl = globalThis.fetch, signal, now = Date.now } = {}) {
  const aborter = new AbortController();
  const abort = () => aborter.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => aborter.abort(), 15_000);
  try {
    const response = await fetchImpl(`${NFTREE_SALE_API_URL}?t=${clock(now)}`, {
      method: 'GET', credentials: 'omit', cache: 'no-store',
      headers: { Accept: 'application/json' }, signal: aborter.signal,
    });
    if (!response.ok || !String(response.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
      fail('INVENTORY_UNAVAILABLE', 'Live sales-pool inventory could not be loaded. Try refreshing.');
    }
    const body = await response.text();
    if (body.length > 100_000) fail('INVENTORY_UNVERIFIED', 'The inventory response could not be verified.');
    let payload;
    try { payload = JSON.parse(body); } catch { fail('INVENTORY_UNVERIFIED', 'The inventory response was not valid JSON.'); }
    return validateSaleInventory(payload, { now: clock(now) });
  } catch (error) {
    if (error instanceof MintAccessError) throw error;
    fail('INVENTORY_UNAVAILABLE', 'Live sales-pool inventory is unavailable. Refresh before purchasing.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export function validatePendingRecord(value) {
  if (value === null || value === undefined) return null;
  if (!plain(value) || value.version !== 1 || value.network !== NFTREE_NETWORK ||
      !address(value.accountAddress) || typeof value.walletName !== 'string' || !value.walletName.trim() ||
      !NFTREE_POOL_IDS.includes(value.poolId) || !Number.isFinite(value.createdAt) || value.createdAt <= 0 ||
      !['awaiting-wallet', 'submitted'].includes(value.status) ||
      (value.digest !== null && !isValidTransactionDigest(value.digest)) ||
      (value.digest === null && value.digestSource !== undefined && value.digestSource !== null) ||
      (value.digest !== null && value.digestSource !== undefined && !['wallet', 'manual'].includes(value.digestSource)) ||
      (value.status === 'submitted' && !value.digest)) {
    fail('PENDING_RECORD_INVALID', 'A previous purchase record could not be read safely. Purchasing is paused.');
  }
  return Object.freeze({ version: 1, network: NFTREE_NETWORK, digest: value.digest,
    digestSource: value.digest === null ? null : (value.digestSource ?? 'wallet'),
    accountAddress: address(value.accountAddress), walletName: value.walletName,
    poolId: value.poolId, mintPriceMist: positiveMist(value.mintPriceMist),
    createdAt: value.createdAt, status: value.status });
}

function connectionSnapshot(getConnection) {
  const connection = getConnection();
  if (!plain(connection) || !address(connection.accountAddress) ||
      typeof connection.walletName !== 'string' || !connection.walletName.trim() || connection.canSign === false) {
    fail('NOT_CONNECTED', 'Connect a Sui mainnet wallet before reviewing a purchase.');
  }
  return { walletName: connection.walletName, accountAddress: address(connection.accountAddress) };
}
const sameConnection = (a, b) => a.walletName === b.walletName && a.accountAddress === b.accountAddress;
const isCancellation = (error) => error?.code === 4001 || error?.code === 'ACTION_REJECTED' ||
  error?.name === 'UserRejectedRequestError' || /user (?:rejected|denied|cancelled|canceled)|(?:rejected|cancelled) by (?:the )?user/i.test(String(error?.message || ''));
const PRE_SIGN_CODES = new Set(['NFTREE_ACCOUNT_CHANGED', 'NFTREE_REVIEW_CHANGED', 'NFTREE_INSUFFICIENT_SUI', 'NFTREE_NOT_CONNECTED', 'NFTREE_UNSUPPORTED_SIGNING']);

/**
 * Persistence callbacks are mandatory and must reject on storage failure.
 * The controller owns wallet connection and user acknowledgement of each quote.
 * submit() signs at most once; checkStatus() only reads an existing transaction.
 */
export function createMintCoordinator({ wallet, loadInventory = loadSaleInventory, getConnection,
  persistPending, readPending, clearPending, onState = () => {}, now = Date.now } = {}) {
  if (!wallet || !['mintWithConnectedWallet', 'confirmMintReceipt', 'getSuiBalance'].every((name) => typeof wallet[name] === 'function') ||
      ![getConnection, persistPending, readPending, clearPending].every((fn) => typeof fn === 'function')) {
    fail('INVALID_CONFIGURATION', 'The purchase panel could not initialize safely.');
  }
  // Deliberately propagate unavailable/malformed storage instead of forgetting a purchase.
  let pending = validatePendingRecord(readPending());
  let quote = null;
  let busy = false;
  let epoch = 0;
  let quoteSerial = 0;
  let state = Object.freeze({ status: pending ? 'pending' : 'idle', code: '',
    message: pending ? 'A previous purchase needs a status check. Do not submit another purchase.' : '',
    quote, pending, receipt: null });
  const emit = (status, message = '', code = '', receipt = null) => {
    state = Object.freeze({ status, message, code, quote, pending, receipt });
    // A view failure must never interrupt recording or checking a signed transaction.
    try { onState(state); } catch { /* the controller can recover through getState() */ }
    return state;
  };
  const live = async () => validateSaleInventory(await loadInventory(), { now: clock(now) });
  const assertConnection = (expected, expectedEpoch) => {
    let actual;
    try { actual = connectionSnapshot(getConnection); } catch {
      fail('NFTREE_ACCOUNT_CHANGED', 'The wallet disconnected. Review again before purchasing.');
    }
    if (expectedEpoch !== epoch) fail('NFTREE_REVIEW_CHANGED', 'The purchase review changed. Review again before purchasing.');
    if (!sameConnection(expected, actual)) fail('NFTREE_ACCOUNT_CHANGED', 'The wallet account changed. Review again before purchasing.');
  };
  const makeQuote = (inventory, connection) => Object.freeze({
    id: `${clock(now)}-${++quoteSerial}`, walletName: connection.walletName,
    accountAddress: connection.accountAddress, network: NFTREE_NETWORK,
    poolId: inventory.activePoolId, poolLabel: inventory.activePoolLabel,
    mintPriceMist: inventory.mintPriceMist, priceLabel: formatMist(inventory.mintPriceMist),
    gasBudgetMist: NFTREE_GAS_BUDGET_MIST,
    maxTotalMist: (BigInt(inventory.mintPriceMist) + BigInt(NFTREE_GAS_BUDGET_MIST)).toString(),
    totalAvailable: inventory.totalAvailable, createdAt: clock(now), inventoryFetchedAt: inventory.fetchedAt,
  });
  const assertBalance = async (expected, price) => {
    let balance;
    try { balance = await wallet.getSuiBalance({ accountAddress: expected.accountAddress }); }
    catch { fail('BALANCE_UNAVAILABLE', 'The wallet balance could not be checked. Refresh before purchasing.'); }
    if (address(balance?.accountAddress) !== expected.accountAddress || !/^[0-9]+$/.test(String(balance?.balanceMist || ''))) {
      fail('BALANCE_UNAVAILABLE', 'The wallet balance could not be verified.');
    }
    if (BigInt(balance.balanceMist) < BigInt(price) + BigInt(NFTREE_GAS_BUDGET_MIST)) {
      fail('NFTREE_INSUFFICIENT_SUI', `This purchase needs ${formatMist(price)} plus up to ${formatMist(NFTREE_GAS_BUDGET_MIST)} for gas.`);
    }
  };
  const persist = async (record) => {
    pending = validatePendingRecord(record);
    await persistPending(pending);
  };
  const clear = async () => { await clearPending(); pending = null; };
  async function confirm() {
    if (!pending?.digest) return emit('pending', 'The wallet response is unresolved. Check your wallet history and enter its transaction digest. Do not purchase again.', 'DIGEST_REQUIRED');
    emit('pending', 'Checking the submitted transaction and NFT ownership.');
    let receipt;
    try { receipt = await wallet.confirmMintReceipt({ ...pending }); }
    catch { return emit('pending', 'Confirmation is unavailable. Use Check status; do not submit another purchase.', 'CONFIRMATION_UNAVAILABLE'); }
    if (!plain(receipt) || receipt.digest !== pending.digest || address(receipt.accountAddress) !== pending.accountAddress ||
        receipt.poolId !== pending.poolId || !['confirmed', 'failed', 'pending'].includes(receipt.status) ||
        (receipt.status === 'confirmed' && (!address(receipt.nftObjectId) || receipt.nftType !== NFTREE_COLLECTION_TYPE))) {
      return emit('pending', 'The transaction result could not be verified. Use Check status; do not purchase again.', 'RECEIPT_UNVERIFIED');
    }
    if (receipt.status === 'pending') return emit('pending', 'The purchase is not yet verified. Check status before taking any further action.', receipt.reason || 'CONFIRMATION_PENDING', receipt);
    try { await clear(); } catch {
      return emit('pending', 'The transaction was checked, but its saved record could not be updated. Check status again before another purchase.', 'PERSISTENCE_FAILED', receipt);
    }
    quote = null;
    return receipt.status === 'confirmed'
      ? emit('confirmed', 'Your NFTree is ready in the purchasing wallet.', '', receipt)
      : emit('failed', 'The transaction was confirmed unsuccessful. Network gas may have been charged. Review the receipt before starting a new purchase.', 'TRANSACTION_FAILED', receipt);
  }

  async function prepare() {
    if (busy || pending) fail('PURCHASE_UNRESOLVED', 'Finish checking the existing purchase before reviewing another.');
    busy = true;
    quote = null;
    const expectedEpoch = epoch;
    emit('reviewing', 'Loading a fresh sales-pool quote.');
    try {
      const connection = connectionSnapshot(getConnection);
      const inventory = await live();
      assertConnection(connection, expectedEpoch);
      if (!inventory.activePoolId) fail('SOLD_OUT', 'The NFTree sales pools are currently sold out.');
      await assertBalance(connection, inventory.mintPriceMist);
      assertConnection(connection, expectedEpoch);
      quote = makeQuote(inventory, connection);
      emit('ready', 'Review the price and purchasing wallet before continuing.');
      return quote;
    } catch (error) {
      quote = null;
      emit('error', error?.message || 'The purchase could not be reviewed.', error?.code || 'REVIEW_FAILED');
      throw error;
    } finally { busy = false; }
  }

  async function submit(quoteId) {
    if (busy || pending) return state;
    if (!quote || quote.id !== quoteId) return emit('review-required', 'Review a fresh quote before purchasing.', 'QUOTE_REQUIRED');
    busy = true;
    const reviewed = quote;
    const expectedEpoch = epoch;
    let signingStarted = false;
    emit('checking', 'Rechecking price, inventory and wallet before approval.');
    try {
      assertConnection(reviewed, expectedEpoch);
      const inventory = await live();
      assertConnection(reviewed, expectedEpoch);
      if (!inventory.activePoolId) fail('SOLD_OUT', 'The NFTree sales pools are currently sold out.');
      if (inventory.mintPriceMist !== reviewed.mintPriceMist || inventory.activePoolId !== reviewed.poolId) {
        quote = makeQuote(inventory, reviewed);
        return emit('review-required', 'The price or active pool changed. Review the updated quote and acknowledge it again.', 'QUOTE_CHANGED');
      }
      await assertBalance(reviewed, inventory.mintPriceMist);
      assertConnection(reviewed, expectedEpoch);
      // A durable marker also protects reloads while the wallet has not yet returned a digest.
      await persist({ version: 1, network: NFTREE_NETWORK, digest: null, digestSource: null, walletName: reviewed.walletName,
        accountAddress: reviewed.accountAddress, poolId: reviewed.poolId, mintPriceMist: reviewed.mintPriceMist,
        createdAt: clock(now), status: 'awaiting-wallet' });
      assertConnection(reviewed, expectedEpoch);
      emit('signing', 'Review this purchase in your wallet.');
      signingStarted = true;
      let result;
      try {
        result = await wallet.mintWithConnectedWallet({ walletName: reviewed.walletName, accountAddress: reviewed.accountAddress,
          salePoolStatus: inventory, assertBeforeSign: () => {
            assertConnection(reviewed, expectedEpoch);
            try { validateSaleInventory(inventory, { now: clock(now) }); }
            catch { fail('NFTREE_REVIEW_CHANGED', 'The inventory review expired. Refresh and review the purchase again.'); }
          } });
      } catch (error) {
        if (isValidTransactionDigest(error?.digest)) result = { digest: error.digest };
        else throw error;
      }
      if (!isValidTransactionDigest(result?.digest)) {
        return emit('pending', 'The wallet did not return a verifiable transaction digest. Check wallet history before doing anything else.', 'DIGEST_REQUIRED');
      }
      await persist({ ...pending, digest: result.digest, digestSource: 'wallet', status: 'submitted' });
      return await confirm();
    } catch (error) {
      if (pending && (!signingStarted || isCancellation(error) || PRE_SIGN_CODES.has(error?.code))) {
        try { await clear(); } catch {
          return emit('pending', 'The saved purchase state could not be updated. Purchasing is paused.', 'PERSISTENCE_FAILED');
        }
      }
      quote = null;
      if (pending) return emit('pending', 'The wallet response is unresolved. Check status or wallet history before purchasing again.', error?.code || 'SUBMISSION_UNKNOWN');
      if (isCancellation(error)) return emit('cancelled', 'You declined the wallet request. No purchase was resubmitted.', 'USER_CANCELLED');
      return emit('error', error?.message || 'The purchase could not start.', error?.code || 'PURCHASE_BLOCKED');
    } finally { busy = false; }
  }

  async function checkStatus({ digest } = {}) {
    if (busy || !pending) return state;
    busy = true;
    try {
      if (digest !== undefined) {
        if (!isValidTransactionDigest(digest) || (pending.digestSource === 'wallet' && pending.digest !== digest)) {
          return emit('pending', 'Enter the exact Sui transaction digest for this purchase.', 'INVALID_DIGEST');
        }
        // A corrected manual lookup still belongs to the same unresolved purchase.
        // Re-entering a wallet digest must never downgrade it to an editable one.
        await persist({ ...pending, digest,
          digestSource: pending.digestSource === 'wallet' ? 'wallet' : 'manual', status: 'submitted' });
      } else if (pending.digest) {
        // Retry a previously failed digest write before doing the receipt read.
        await persist(pending);
      }
      return await confirm();
    } catch {
      return emit('pending', 'The purchase record could not be saved. Do not submit another purchase.', 'PERSISTENCE_FAILED');
    } finally { busy = false; }
  }

  return Object.freeze({ prepare, submit, checkStatus, getState: () => state,
    resetReview() {
      epoch++;
      quote = null;
      if (!pending) emit('idle');
      return state;
    },
  });
}
