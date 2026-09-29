import { routeDraft, readDraft, commandCenterHost, mayanReviewAmount } from './review-core.js';
import { SOURCES, SUI, USDC, TREE, amountToRaw } from './options.js';
const $ = id => document.getElementById(id);
const viaBase = () => ['bsc', 'robinhood'].includes($('chain').value);
const rocketxRoute = () => viaBase() && $('destination').value === 'SUI';
const caveat = document.querySelector('.quote-caveat');
const originalCaveat = caveat.textContent;
const legacySections = ['.fees', '.powered', '#route-guide', '.catalog', '#wallet-review'].map(selector => document.querySelector(selector));
const slippageRow = $('protocol').parentElement.nextElementSibling;
const destinations = { TREE, SUI, USDC };
let version = 0;
let controller;
let expiryTimer;
function reset() {
  version++;
  window.dispatchEvent(new CustomEvent('gateway-quote-review', { detail: null }));
  controller?.abort();
  clearInterval(expiryTimer);
  $('quote-button').disabled = false;
  $('quote-button').textContent = 'Get live quote ↗';
  $('quote-result').hidden = true;
  $('quote-status').className = '';
  $('quote-status').textContent = 'Choose your route, then request a live route quote.';
  $('rocketx-refund-rule').textContent = 'Refund-address requirements will appear with a live quote.';
}
function destinationChanged() {
  const tree = $('destination').value === 'TREE';
  const rocketx = rocketxRoute();
  $('rocketx-flow').hidden = !rocketx;
  for (const section of legacySections) section.hidden = rocketx;
  slippageRow.hidden = rocketx;
  caveat.textContent = rocketx ? 'Market-rate estimate · Final output is not guaranteed.' : originalCaveat;
  $('via-base-note').hidden = !viaBase() || rocketx;
  $('settlement-label').hidden = !tree;
  $('destination-note').textContent = rocketx ? 'RocketX estimate into native SUI. After arrival, optionally swap SUI for TREE in the Swap tab.' : tree ? 'SUI settlement includes a TREE estimate. Refresh quotes at each stage.' : (viaBase() ? 'Relay to Base USDC, then Mayan into this asset on Sui.' : 'Request a direct Mayan estimate into this asset on Sui.');
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
  const rocketx = rocketxRoute();
  $('quote-button').textContent = rocketx ? 'Checking RocketX…' : viaBase() ? 'Checking Relay + Mayan…' : 'Checking Mayan…';
  $('quote-status').textContent = 'Finding a live bridge estimate. This can take a few seconds.';
  const query = new URLSearchParams({ chain, asset, amount: $('amount').value.trim(), destination: destinations[$('destination').value], settlement: $('settlement').value });
  try {
    const response = await fetch(`/api/${rocketx ? 'tree-gateway-rocketx' : 'tree-gateway-quote'}?${query}`, { signal: controller.signal });
    const data = await response.json();
    if (current !== version) return;
    if (!response.ok) throw Error(data.error || 'Quotes are temporarily unavailable.');
    if (rocketx) {
      const quote = data.quotes?.filter(q => q.exchangeType === 'CEX' && q.walletless && !q.fixedRate).sort((a, b) => Number(b.expectedAmountOut) - Number(a.expectedAmountOut))[0];
      if (!quote) throw Error('No verified RocketX exchange route is available for this amount. Try another amount.');
      const format = value => Number(value).toLocaleString(undefined, { maximumFractionDigits: 6 });
      const money = value => value === null ? 'not supplied' : '$' + Number(value).toFixed(4);
      $('route-stages').hidden = true;
      $('output-label').textContent = 'Estimated arrival · Native SUI';
      $('output').textContent = format(quote.expectedAmountOut) + ' SUI';
      $('minimum-label').textContent = 'Guaranteed minimum';
      $('minimum').textContent = 'None · Market rate';
      $('eta').textContent = quote.estimatedSeconds === null ? 'Not supplied' : 'About ' + Math.ceil(quote.estimatedSeconds / 60) + ' min';
      $('protocol').textContent = 'RocketX · ' + (quote.provider || 'Partner exchange') + ' · CEX';
      caveat.textContent = 'Quoted platform fee: ' + (quote.platformFeePercent === null ? 'not supplied' : format(quote.platformFeePercent) + '%') + ' (' + money(quote.platformFeeUsd) + '). Provider-reported gas: ' + money(quote.gasFeeUsd) + '. Source wallet gas may be additional. No extra TREE Gateway fee is added by this preview.';
      $('tree-warning').hidden = false;
      $('rocketx-refund-rule').textContent = quote.refundAddressRequired === true ? 'This provider requires a refund address when creating the order. It must be verified on the source network before any payment.' : quote.refundAddressRequired === false ? 'This quote does not require a separate refund-address field. That does not guarantee an automatic refund.' : 'The quote does not specify whether a refund address is required. This must be confirmed before creating an order.';
      $('tree-warning').textContent = 'Exchange-mediated, market-rate route. The quote does not require a manual Base funding step; execution and recovery are not yet verified. Provider checks, delays or refund conditions may apply. TREE does not pay gas. No deposit address or order has been created. After SUI arrives, use Swap to buy TREE separately and leave SUI for gas.';
      $('quote-result').hidden = false;
      $('quote-status').textContent = 'Live RocketX estimate received. Transfers remain disabled.';
      const expiresAt = Date.parse(data.fetchedAt) + 30_000;
      const tick = () => {
        const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
        $('validity').textContent = 'Refresh in ' + seconds + 's';
        if (!seconds) { clearInterval(expiryTimer); $('quote-result').hidden = true; $('quote-status').textContent = 'Estimate expired. Request a fresh quote.'; }
      };
      tick(); expiryTimer = setInterval(tick, 1000);
      return;
    }
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
    if (data.requiresTreeSwap) {
      const swap = data.treeSwap;
      if (swap?.status === 'ok') {
        $('output-label').textContent = 'Indicative final TREE output · Before Gateway fee and gas';
        $('output').textContent = format(swap.expectedAmountOut) + ' TREE';
        $('minimum-label').textContent = 'Final swap minimum estimate*';
        $('minimum').textContent = format(swap.minAmountOut) + ' TREE';
        $('protocol').textContent += ' → ' + swap.provider;
        $('tree-warning').textContent = 'Bridge arrival: ' + format(quote.expectedAmountOut) + ' SUI. The TREE quote uses its minimum of ' + swap.inputAmount + ' SUI. Swap venue: ' + swap.provider + '; pool fee ' + swap.feePercent + '%; price impact ' + format(swap.priceImpactPercent) + '%. This is not a guaranteed end-to-end minimum. Quotes must be refreshed after each arrival. Sui gas must be funded separately; no gas reserve or 0.25% Gateway fee has been deducted.';
      } else {
        $('tree-warning').textContent = swap?.message || 'Final TREE quote unavailable. Only the bridge arrival is estimated.';
      }
    }
    $('quote-result').hidden = false;
    window.dispatchEvent(new CustomEvent('gateway-quote-review', { detail: { inputAmount: data.treeSwap?.status === 'ok' ? data.treeSwap.inputAmount : null, mayanAmountRaw: mayanReviewAmount(chain, asset, query.get('amount'), data), expiresAt: quote.expiresAt } }));
    $('quote-status').textContent = data.treeSwap?.status === 'ok' ? 'Bridge and final TREE estimates received. No transfers initiated.' : data.relay ? 'Two-stage indicative estimate received. No transfers initiated.' : 'Live estimate received. No transfer has been initiated.';
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((quote.expiresAt - Date.now()) / 1000));
      $('validity').textContent = `${remaining}s`;
      if (!remaining) {
        clearInterval(expiryTimer);
        $('quote-result').hidden = true;
        window.dispatchEvent(new CustomEvent('gateway-quote-review', { detail: null }));
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
const host = commandCenterHost(window);
if (host) {
  host.addEventListener('tree:wallet-changed', reset);
  host.addEventListener('tree:wallet-manager-ready', reset);
  window.addEventListener('pagehide', () => {
    host.removeEventListener('tree:wallet-changed', reset);
    host.removeEventListener('tree:wallet-manager-ready', reset);
  }, { once: true });
}
let walletsLoading = false;
async function loadWallets() {
  if (!$('wallet-review').open || walletsLoading) return;
  walletsLoading = true;
  try { await import('./wallet-bundle.js'); }
  catch { walletsLoading = false; $('wallet-summary').textContent = 'Wallet controls could not load. Close and reopen this section to retry. Quotes and saved route choices remain available.'; }
}
$('wallet-review').addEventListener('toggle', loadWallets);
void loadWallets();
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

// Reconcile choices made while the module was still loading.
if (!Object.hasOwn(SOURCES[$('chain').value], $('asset').value)) $('chain').dispatchEvent(new Event('change'));
else destinationChanged();
