import { routeDraft, readDraft } from './review-core.js';
import { SOURCES, SUI, USDC, TREE, amountToRaw } from './options.js';
const $ = id => document.getElementById(id);
const viaBase = () => ['bsc', 'robinhood'].includes($('chain').value);
const destinations = { TREE, SUI, USDC };
let version = 0;
let controller;
let expiryTimer;
function reset() {
  version++;
  controller?.abort();
  clearInterval(expiryTimer);
  $('quote-button').disabled = false;
  $('quote-button').textContent = 'Get live quote ↗';
  $('quote-result').hidden = true;
  $('quote-status').className = '';
  $('quote-status').textContent = 'Choose your route, then request a live route quote.';
}
function destinationChanged() {
  const tree = $('destination').value === 'TREE';
  $('settlement-label').hidden = !tree;
  $('destination-note').textContent = tree ? 'TREE needs an onward swap on Sui. This preview quotes bridging only.' : (viaBase() ? 'Relay to Base USDC, then Mayan into this asset on Sui.' : 'Request a direct Mayan estimate into this asset on Sui.');
  reset();
}
$('chain').addEventListener('change', () => {
  $('asset').replaceChildren(...Object.keys(SOURCES[$('chain').value]).map(name => new Option(name, name)));
  $('via-base-note').hidden = !viaBase();
  $('amount').value = $('chain').value === 'bsc' ? '0.1' : $('chain').value === 'robinhood' ? '0.01' : '100';
  destinationChanged();
});
$('destination').addEventListener('change', destinationChanged);
for (const id of ['asset', 'amount', 'settlement']) $(id).addEventListener('input', reset);
async function requestQuote(event) {
  event.preventDefault(); reset();
  const current = version;
  const chain = $('chain').value;
  const asset = $('asset').value;
  try { amountToRaw($('amount').value.trim(), SOURCES[chain][asset][1]); }
  catch (error) { $('quote-status').textContent = error.message; $('quote-status').className = 'error'; return; }
  controller = new AbortController();
  $('quote-button').disabled = true;
  $('quote-button').textContent = viaBase() ? 'Checking Relay + Mayan…' : 'Checking Mayan…';
  $('quote-status').textContent = 'Finding a live bridge estimate. This can take a few seconds.';
  const query = new URLSearchParams({ chain, asset, amount: $('amount').value.trim(), destination: destinations[$('destination').value], settlement: $('settlement').value });
  try {
    const response = await fetch(`/api/tree-gateway-quote?${query}`, { signal: controller.signal });
    const data = await response.json();
    if (current !== version) return;
    if (!response.ok) throw Error(data.error || 'Quotes are temporarily unavailable.');
    const quote = data.quotes?.[0];
    if (!quote) throw Error('No verified route found. Try a different amount, network, or settlement asset.');
    if (quote.expiresAt <= Date.now()) throw Error('This quote expired before arrival. Please request a fresh quote.');
    const format = value => Number(value).toLocaleString(undefined, { maximumFractionDigits: 6 });
    $('route-stages').hidden = !data.relay;
    $('minimum-label').textContent = data.relay ? 'Second-stage minimum estimate*' : 'Minimum bridge arrival';
    if (data.relay) {
      $('relay-stage').textContent = '1 · Relay → ' + format(Number(data.relay.expectedRaw) / 1e6) + ' USDC on Base. Minimum estimate: ' + format(Number(data.relay.minimumRaw) / 1e6) + ' USDC. Time: ' + data.relay.eta + '.';
      $('mayan-stage').textContent = '2 · Mayan → ' + format(quote.expectedAmountOut) + ' ' + quote.symbol + ' on Sui, using the first-stage minimum. Time: ' + quote.eta + '.';
    }
    $('output-label').textContent = data.requiresTreeSwap ? 'Estimated bridge arrival · Before TREE swap' : 'Estimated arrival on Sui';
    $('output').textContent = `${format(quote.expectedAmountOut)} ${quote.symbol}`;
    $('minimum').textContent = `${format(quote.minAmountOut)} ${quote.symbol}`;
    $('eta').textContent = data.relay ? data.relay.eta + ' + ' + quote.eta : quote.eta;
    $('protocol').textContent = (data.relay ? 'Relay → ' : '') + `Mayan ${quote.protocol}`;
    $('tree-warning').hidden = !data.requiresTreeSwap;
    $('quote-result').hidden = false;
    $('quote-status').textContent = data.relay ? 'Two-stage indicative estimate received. No transfers initiated.' : 'Live estimate received. No transfer has been initiated.';
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((quote.expiresAt - Date.now()) / 1000));
      $('validity').textContent = `${remaining}s`;
      if (!remaining) {
        clearInterval(expiryTimer);
        $('quote-result').hidden = true;
        $('quote-status').textContent = 'Quote expired. Get a fresh quote to see current pricing.';
      }
    };
    tick(); expiryTimer = setInterval(tick, 1000);
  } catch (error) {
    if (current !== version || error.name === 'AbortError') return;
    $('quote-status').textContent = error.message;
    $('quote-status').className = 'error';
  } finally {
    if (current === version) { $('quote-button').disabled = false; $('quote-button').textContent = 'Get live quote ↗'; }
  }
}
$('gateway-form').addEventListener('submit', requestQuote);
$('quote-button').addEventListener('click', requestQuote);
async function catalog() {
  $('catalog-refresh').disabled = true;
  $('catalog-tokens').replaceChildren();
  $('catalog-status').textContent = 'Checking Mayan’s token catalog…';
  try {
    const response = await fetch('/api/tree-gateway-tokens', { signal: AbortSignal.timeout(15_000) });
    const data = await response.json();
    if (!response.ok || data.status !== 'ok' || !data.tokens?.length) throw Error('Live catalog unavailable. Retry in a moment.');
    $('catalog-status').textContent = `${data.tokens.length} assets listed · Checked ${new Date(data.fetchedAt).toLocaleTimeString()} · ${data.treeDirectListed ? 'TREE is listed; direct quoting needs verification.' : 'TREE requires an onward swap.'}`;
    for (const token of data.tokens) {
      const chip = document.createElement('span'); chip.textContent = token.symbol; chip.title = token.contract; $('catalog-tokens').append(chip);
    }
  } catch (error) { $('catalog-status').textContent = error.message; }
  finally { $('catalog-refresh').disabled = false; }
}
$('catalog-refresh').addEventListener('click', catalog);
catalog();

window.addEventListener('gateway-wallet-change', reset);
let walletsLoading = false;
$('wallet-review').addEventListener('toggle', async () => {
  if (!$('wallet-review').open || walletsLoading) return;
  walletsLoading = true;
  try { await import('./wallet-bundle.js'); }
  catch { walletsLoading = false; $('wallet-summary').textContent = 'Wallet controls could not load. Close and reopen this section to retry. Quotes and saved route choices remain available.'; }
});
const savedKey = 'tree-gateway-route-v1';
$('save-route').addEventListener('click', () => {
  try {
    const draft = routeDraft(Object.fromEntries(['chain', 'asset', 'amount', 'destination', 'settlement'].map(id => [id, $(id).value.trim()])));
    localStorage.setItem(savedKey, JSON.stringify(draft));
    $('saved-status').textContent = 'Route setup saved in this browser. No wallet addresses, quotes or transaction progress were saved.';
  } catch (error) { $('saved-status').textContent = 'Could not save: ' + error.message; }
});
$('restore-route').addEventListener('click', () => {
  try {
    const text = localStorage.getItem(savedKey);
    if (!text) throw Error('No saved route setup found.');
    const draft = readDraft(text);
    $('chain').value = draft.chain;
    $('chain').dispatchEvent(new Event('change'));
    for (const id of ['asset', 'amount', 'destination', 'settlement']) $(id).value = draft[id];
    destinationChanged();
    $('saved-status').textContent = 'Route choices restored. Verify connected wallets and request a fresh quote. No transfer is in progress.';
  } catch (error) { $('saved-status').textContent = 'Could not restore: ' + error.message; }
});
$('clear-route').addEventListener('click', () => {
  try { localStorage.removeItem(savedKey); $('saved-status').textContent = 'Saved route setup cleared.'; }
  catch { $('saved-status').textContent = 'Browser storage is unavailable.'; }
});
