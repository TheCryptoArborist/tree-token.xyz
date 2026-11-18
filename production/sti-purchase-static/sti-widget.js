import {STI,SUI,POOL,FEED,GAS_RESERVE,QUOTE_TTL,parseSui,units,validatePool,makeQuote,validateQuote,requiresImpactAcceptance,requireImpactAcceptance,requireBalance,buildPurchase,checkSimulation,parseFeed} from './sti-purchase-core.js?v=20261118-wallet1';
import {PRICE_ENDPOINT,PRICE_QUERY,DATA_TTL,parsePoolPrice,parseNav,parseBasket} from './sti-stats-core.js?v=20261118-wallet1';

const el = Object.fromEntries(['Membership','Share','Basket','Price','Nav','PriceStatus','Held','Since','MintNote','Holders','DataStatus','OpenBuy','CloseBuy','Purchase','WalletButton','WalletStatus','Amount','Balance','QuoteButton','QuoteDetails','Estimated','Minimum','Fee','Impact','ImpactWarning','ImpactExplanation','ImpactAccept','ImpactAcceptanceText','Expiry','BuyButton','PurchaseStatus','Receipt'].map(key=>[key,document.getElementById('sti'+key)]));
let runtimePromise, quote = null, busy = false, quoting = false, generation = 0, balance = null, balanceOwner = null, pendingDigest = null;
let prepared = null, connecting = false, signing = false, acceptedQuote = null, walletUnavailable = false;
const connection = () => window.getWalletConnectionState?.() || {connected:false};
const owner = () => {const state=connection();return state.connected ? state.address : null;};
const status = (message,error=false) => {el.PurchaseStatus.textContent=message;el.PurchaseStatus.dataset.error=String(error);};
const hostAllowed = () => /^(tree-token\.xyz|www\.tree-token\.xyz|[a-f0-9]+--tree-token\.netlify\.app|deploy-preview-\d+--tree-token\.netlify\.app|localhost|127\.0\.0\.1)$/.test(location.hostname);
async function runtime() {
  if (!runtimePromise) runtimePromise = (async()=>{
    const [{Transaction},{SuiGrpcClient},{CetusClmmSDK}] = await Promise.all([
      import('https://esm.run/@mysten/sui@2.23.1/transactions'),
      import('https://esm.run/@mysten/sui@2.23.1/grpc'),
      import('https://esm.run/@cetusprotocol/sui-clmm-sdk@1.4.7'),
    ]);
    const client=new SuiGrpcClient({network:'mainnet',baseUrl:'https://fullnode.mainnet.sui.io:443'});
    const chain=await client.core.getChainIdentifier();
    if(chain.chainIdentifier!=='4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S')throw Error('Sui Mainnet could not be verified.');
    const {coinMetadata}=await client.core.getCoinMetadata({coinType:STI});
    if(coinMetadata?.decimals!==9 || coinMetadata?.symbol!=='STI')throw Error('STI token metadata could not be verified.');
    return {Transaction,client,sdk:CetusClmmSDK.createSDK({env:'mainnet',sui_client:client})};
  })().catch(error=>{runtimePromise=null;throw error;});
  return runtimePromise;
}
function invalidate() {generation++;quote=null;prepared=null;acceptedQuote=null;el.ImpactAccept.checked=false;el.ImpactWarning.hidden=true;el.QuoteDetails.hidden=true;render();}
function render() {
  window.treeStiRecovery?.setPurchasePending(busy || Boolean(pendingDigest));
  const fresh=quote && Date.now()>=quote.at && Date.now()-quote.at<QUOTE_TTL;
  if(!fresh){acceptedQuote=null;prepared=null;el.ImpactAccept.checked=false;}
  const needsAcceptance=fresh && requiresImpactAcceptance(quote) && acceptedQuote!==quote;
  const state=connection();
  el.WalletButton.textContent=connecting?'Opening wallet…':state.connected?'Manage / reconnect wallet':walletUnavailable?'Retry wallet connection':'Connect wallet';
  el.WalletButton.disabled=busy||connecting||Boolean(pendingDigest);
  el.WalletStatus.textContent=state.connected?`${state.name || 'Sui wallet'} · ${state.address.slice(0,8)}…${state.address.slice(-6)}`:'No signing wallet connected. Connect a wallet to continue.';
  el.WalletStatus.title=state.connected?state.address:'';
  el.QuoteButton.disabled=busy||connecting||quoting||Boolean(pendingDigest);
  el.Amount.disabled=busy||connecting||Boolean(pendingDigest);
  el.CloseBuy.disabled=busy||connecting;
  el.BuyButton.textContent=pendingDigest?'Check confirmation':connecting?'Opening wallet…':busy?(signing?'Waiting for wallet…':'Checking purchase…'):!owner()?'Connect wallet':prepared&&fresh?'Approve purchase in wallet':'Review purchase';
  el.BuyButton.disabled=busy||connecting||(!pendingDigest&&Boolean(owner())&&(!fresh||quoting||needsAcceptance));
  el.ImpactAccept.disabled=busy||connecting||quoting||!fresh||Boolean(pendingDigest);
  if(quote)el.Expiry.textContent=fresh?`${Math.ceil((QUOTE_TTL-(Date.now()-quote.at))/1000)} seconds`:'Expired — get a new quote';
}
async function connectPurchaseWallet() {
  if(busy||connecting||pendingDigest)return;
  invalidate();connecting=true;walletUnavailable=false;render();
  status(typeof window.openWalletManager==='function'?'Choose or reconnect your wallet in the wallet manager.':'Loading wallet connection tools...');
  try {
    if(typeof window.openWalletManager!=='function'){
      if(!window.treeStiRecovery)throw Error('Wallet connection tools are unavailable. Use Reload wallet tools to try again.');
      await window.treeStiRecovery.waitForWalletManager();
    }
    window.treeStiRecovery?.hideWalletRecovery();
    status('Choose or reconnect your wallet in the wallet manager.');
    const result=await window.openWalletManager({mode:owner()?'manage':'picker'});
    if(result?.action==='cancel')status('Wallet selection closed. Use Connect wallet or Manage / reconnect wallet to try again.');
    else if(owner())status('Wallet connected. Get a fresh quote, then review the purchase.');
    else status('No signing wallet connected. Choose a wallet before approving a purchase.',true);
  } catch(error){
    walletUnavailable=typeof window.openWalletManager!=='function';
    if(walletUnavailable)window.treeStiRecovery?.showWalletRecovery();
    status(error?.message || 'Wallet connection failed. Use Connect wallet to try again.',true);
  }
  finally {connecting=false;render();await loadBalance();}
}
async function loadBalance() {
  const address=owner();balance=null;balanceOwner=null;
  if(!address){el.Balance.textContent='Connect your wallet to check your balance.';return;}
  el.Balance.textContent='Checking SUI balance…';
  try {
    const {client}=await runtime();const result=await client.core.getBalance({owner:address,coinType:SUI});
    if(owner()!==address)return;
    balance=BigInt(result.balance.balance);balanceOwner=address;
    el.Balance.textContent=`Balance: ${units(balance)} SUI · ${units(balance>GAS_RESERVE?balance-GAS_RESERVE:0n)} available after gas reserve`;
  } catch {if(owner()===address)el.Balance.textContent='Balance unavailable. A fresh balance check is required before approval.';}
}
async function getQuote() {
  if(busy||quoting||pendingDigest)return;
  invalidate();const request=generation;const address=owner();let amount;
  try {amount=parseSui(el.Amount.value);}catch(error){status(error.message,true);return;}
  quoting=true;render();status('Getting a live STI/SUI pool quote…');
  try {
    const {sdk}=await runtime();const startedAt=Date.now();
    const pool=validatePool(await sdk.Pool.getPool(POOL,true));
    const response=await sdk.Swap.preSwap({pool,current_sqrt_price:pool.current_sqrt_price,coin_type_a:STI,coin_type_b:SUI,decimals_a:9,decimals_b:9,a2b:false,by_amount_in:true,amount:amount.toString()});
    const next=makeQuote(pool,response,amount,startedAt);validateQuote(next,amount);
    if(request!==generation || owner()!==address || parseSui(el.Amount.value)!==amount)return;
    quote=next;el.Estimated.textContent=units(next.out);el.Minimum.textContent=units(next.minOut);el.Fee.textContent=`0.25% · ${units(next.fee)} SUI`;el.Impact.textContent=(Number(next.impactBps)/100).toFixed(2)+'%';el.QuoteDetails.hidden=false;
    if(requiresImpactAcceptance(next)){
      const impact=(Number(next.impactBps)/100).toFixed(2);
      el.ImpactExplanation.textContent=`This quote returns ${impact}% less STI than the current pool rate, including the 0.25% pool fee. You can reduce the SUI amount or accept this quote. Slippage remains 1%.`;
      el.ImpactAcceptanceText.textContent=`I accept ${impact}% price impact for this quote.`;
      el.ImpactWarning.hidden=false;
      status('Review the price impact and minimum STI received. Accept this quote to continue, or enter a smaller SUI amount.');
    }else status('Review the amount and minimum STI received. The quote expires after 30 seconds.');
  } catch(error) {if(request===generation)status(error.message || 'Quote unavailable. Try again.',true);}
  finally {quoting=false;render();}
}
async function confirmPending(client) {
  const digest=pendingDigest;
  const final=await client.core.waitForTransaction({digest,timeout:60_000,include:{effects:true,balanceChanges:true}});
  if(final.Transaction?.effects?.status?.success!==true){pendingDigest=null;throw Error('The transaction failed on-chain. Check your wallet for details.');}
  pendingDigest=null;el.Amount.value='';invalidate();
  el.Receipt.hidden=false;el.Receipt.textContent=`Purchase confirmed on Sui Mainnet. Transaction: ${digest}`;
  status('Your STI purchase is confirmed.');await loadBalance();
}
async function purchase() {
  if(busy||connecting)return;
  if(!hostAllowed()){status('Purchases are available only on the official TREE site and its review previews.',true);return;}
  if(!pendingDigest&&!owner()){await connectPurchaseWallet();return;}
  const address=owner(), request=generation;
  busy=true;render();
  try {
    // Final approval uses a separate user gesture, with no network awaits before
    // calling the wallet. The exact bytes and session checked below were prepared
    // by the preceding Review purchase action; never re-quote or auto-retry here.
    if(prepared&&!pendingDigest){
      const ready=prepared;
      validateQuote(ready.reviewed,parseSui(el.Amount.value));
      requireImpactAcceptance(ready.reviewed,acceptedQuote);
      if(requiresImpactAcceptance(ready.reviewed)&&!el.ImpactAccept.checked)throw Error('Accept the price impact for this quote before approval.');
      if(ready.address!==address||ready.request!==request||ready.wallet!==window.currentWallet||ready.account!==window.currentAccount||el.Purchase.hidden)throw Error('Wallet or purchase details changed. Get a new quote.');
      if(typeof window.signAndExecuteTransactionBlock!=='function')throw Error('Wallet signing is unavailable. Reconnect your wallet.');
      prepared=null;signing=true;render();
      status(`Approve ${units(ready.reviewed.amount)} SUI for at least ${units(ready.reviewed.minOut)} STI in your wallet. Network gas is extra.`);
      const waiting=setTimeout(()=>status('Still waiting for the wallet. If its window closed, return to the wallet and check activity. Do not submit another purchase while this request is pending.',true),20_000);
      let signed;
      try {signed=await window.signAndExecuteTransactionBlock(ready.Transaction.from(ready.bytes));}
      finally {clearTimeout(waiting);}
      const digest=signed?.digest||signed?.Transaction?.digest||signed?.effects?.transactionDigest||signed?.transactionBlockDigest;
      if(!digest)throw Error('No transaction ID was returned. Check your wallet activity before trying again.');
      pendingDigest=digest;invalidate();el.Receipt.hidden=false;el.Receipt.textContent=`Submitted transaction: ${digest}`;
      status('Purchase submitted. Waiting for confirmation…');await confirmPending(ready.client);return;
    }
    const {client,Transaction}=await runtime();
    if(pendingDigest){status('Checking your submitted purchase…');await confirmPending(client);return;}
    const amount=parseSui(el.Amount.value), reviewed=validateQuote(quote,amount);
    requireImpactAcceptance(reviewed,acceptedQuote);
    if(requiresImpactAcceptance(reviewed)&&!el.ImpactAccept.checked)throw Error('Accept the price impact for this quote before review.');
    const {balance:available}=await client.core.getBalance({owner:address,coinType:SUI});requireBalance(available.balance,amount);
    if(owner()!==address||request!==generation)throw Error('Wallet or amount changed. Get a new quote.');
    status('Checking the purchase on Sui Mainnet before wallet approval…');
    const tx=buildPurchase(Transaction,address,reviewed,Date.now(),acceptedQuote);
    const bytes=await tx.build({client});
    const result=await client.core.simulateTransaction({transaction:bytes,include:{effects:true,balanceChanges:true}});
    checkSimulation(result,address,reviewed);
    validateQuote(reviewed,parseSui(el.Amount.value));
    requireImpactAcceptance(reviewed,acceptedQuote);
    if(requiresImpactAcceptance(reviewed)&&!el.ImpactAccept.checked)throw Error('Price-impact acceptance changed. Review the quote again.');
    if(owner()!==address||request!==generation||el.Purchase.hidden)throw Error('Wallet or purchase details changed. Get a new quote.');
    if(typeof window.signAndExecuteTransactionBlock!=='function')throw Error('Wallet signing is unavailable.');
    prepared={bytes,Transaction,client,reviewed,address,request,wallet:window.currentWallet,account:window.currentAccount};
    status('Purchase checks passed. Tap Approve purchase in wallet to open your wallet. The original quote expiry still applies.');
  } catch(error) {
    if(pendingDigest)status('Your purchase was submitted; confirmation is pending. Use Check confirmation before making another purchase.',true);
    else {invalidate();status(/reject|cancel/i.test(error?.message)?'Purchase cancelled in your wallet. No automatic retry will occur. Use Manage / reconnect wallet if no approval screen appeared.':error?.message||'Purchase unavailable. Check your wallet activity before trying again.',true);}
  } finally {busy=false;signing=false;render();}
}
let feedLoading=false, priceLoading=false, feedAt=null, priceAt=null;
const statsVisible = () => !document.hidden && !document.getElementById('stats').hidden;
const readOptions = () => ({credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12_000)});
function clearBasket() {el.Basket.replaceChildren();el.Basket.hidden=true;el.Basket.setAttribute('aria-label','Basket composition unavailable');}
function clearFeed() {
  feedAt=null;el.Membership.textContent='Index data temporarily unavailable';el.Share.textContent=el.Held.textContent=el.Holders.textContent=el.Since.textContent=el.Nav.textContent='—';
  clearBasket();el.MintNote.hidden=true;el.DataStatus.textContent='STI data could not be verified. Purchase quotes are checked separately against the live pool.';
}
function clearPrice() {priceAt=null;el.Price.textContent='—';el.PriceStatus.textContent='Pool price temporarily unavailable. Get a fresh purchase quote below.';}
function clearExpired() {
  if(feedAt!==null && Date.now()-feedAt>DATA_TTL)clearFeed();
  if(priceAt!==null && Date.now()-priceAt>DATA_TTL)clearPrice();
}
async function loadPrice() {
  if(priceLoading||!statsVisible())return;
  priceLoading=true;
  try {
    const response=await fetch(PRICE_ENDPOINT,{...readOptions(),method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:PRICE_QUERY})});
    if(!response.ok)throw Error('Pool price unavailable');
    const data=parsePoolPrice(await response.json());priceAt=data.at;
    el.Price.textContent=units(data.priceMist);
    el.PriceStatus.textContent=`Source: Cetus STI/SUI · Updated ${new Date(data.at).toLocaleTimeString()} · Refreshes every minute`;
  } catch {clearPrice();}
  finally {priceLoading=false;}
}
async function loadFeed() {
  if(feedLoading||!statsVisible())return;
  feedLoading=true;
  try {
    const response=await fetch(FEED,readOptions());
    if(!response.ok)throw Error('Feed unavailable');const raw=await response.json(),data=parseFeed(raw);feedAt=data.at;
    el.Membership.textContent=data.member?'is in the Sui Trenches Index':'TREE is not currently an active basket member';
    el.Share.textContent=data.member?(data.share*100).toFixed(2)+'%':'—';
    el.Held.textContent=data.member?new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(Number(data.held)/1e6):'—';
    el.Holders.textContent=data.member?data.holders.toLocaleString():'—';
    el.Since.textContent=data.member?(data.since===null?'Day one':data.since?new Date(data.since).toLocaleDateString('en',{month:'short',year:'numeric'}):'—'):'—';
    el.MintNote.hidden=!data.member;
    const unavailable=[];
    try {el.Nav.textContent=units(parseNav(raw).priceMist);}catch{el.Nav.textContent='—';unavailable.push('Backing unavailable.');}
    try {
      const parts=parseBasket(raw);el.Basket.replaceChildren();
      for(const part of parts){const segment=document.createElement('span');segment.className='sti-basket-segment'+(part.tree?' is-tree':'');segment.style.flexGrow=String(part.share);segment.title=`${part.symbol}: ${(part.share*100).toFixed(2)}%`;segment.setAttribute('aria-hidden','true');el.Basket.append(segment);}
      el.Basket.hidden=false;el.Basket.setAttribute('aria-label',`STI basket: ${parts.map(part=>`${part.tree?'TREE':part.symbol} ${(part.share*100).toFixed(2)}%`).join(', ')}`);
    }catch{clearBasket();unavailable.push('Basket composition unavailable.');}
    el.DataStatus.textContent=`Source: STI public feed · Updated ${new Date(data.at).toLocaleTimeString()}${unavailable.length?' · '+unavailable.join(' '):''}`;
  } catch {clearFeed();}
  finally {feedLoading=false;}
}
function loadStats(){clearExpired();loadFeed();loadPrice();}
el.OpenBuy.addEventListener('click',()=>{el.Purchase.hidden=false;el.OpenBuy.setAttribute('aria-expanded','true');el.Amount.focus();loadBalance();render();});
el.CloseBuy.addEventListener('click',()=>{if(busy)return;el.Purchase.hidden=true;el.OpenBuy.setAttribute('aria-expanded','false');invalidate();el.OpenBuy.focus();});
el.Amount.addEventListener('input',()=>{invalidate();status('Amount changed. Get a new quote.');});
el.ImpactAccept.addEventListener('change',()=>{
  prepared=null;
  if(busy||connecting||quoting||pendingDigest){acceptedQuote=null;el.ImpactAccept.checked=false;render();return;}
  try{
    const current=validateQuote(quote,parseSui(el.Amount.value));
    acceptedQuote=el.ImpactAccept.checked&&requiresImpactAcceptance(current)?current:null;
    status(acceptedQuote?'Price impact accepted for this quote. Review the purchase before wallet approval.':'Accept the displayed price impact to continue, or enter a smaller SUI amount.');
  }catch(error){invalidate();status(error.message,true);}
  render();
});
el.QuoteButton.addEventListener('click',getQuote);el.BuyButton.addEventListener('click',purchase);
el.WalletButton.addEventListener('click',connectPurchaseWallet);
window.addEventListener('tree:wallet-changed',()=>{invalidate();if(!el.Purchase.hidden)loadBalance();});
window.addEventListener('tree:wallet-manager-ready',()=>{
  if(walletUnavailable && typeof window.openWalletManager==='function'){
    walletUnavailable=false;window.treeStiRecovery?.hideWalletRecovery();render();
    if(!el.Purchase.hidden && !busy && !pendingDigest)status('Wallet tools are ready. Use Connect wallet to choose your wallet.');
  }
});
new MutationObserver(()=>{loadStats();if(document.getElementById('stats').hidden)invalidate();}).observe(document.getElementById('stats'),{attributes:true,attributeFilter:['hidden']});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadStats();});
setInterval(()=>{if(!el.Purchase.hidden)render();},1000);
setInterval(clearExpired,10_000);
setInterval(loadStats,60_000);loadStats();render();
