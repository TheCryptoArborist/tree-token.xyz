import {STI,SUI,POOL,FEED,GAS_RESERVE,QUOTE_TTL,parseSui,units,validatePool,makeQuote,validateQuote,requireBalance,buildPurchase,checkSimulation,parseFeed} from './sti-purchase-core.js';

const el = Object.fromEntries(['Membership','Share','Held','Holders','DataStatus','OpenBuy','CloseBuy','Purchase','Amount','Balance','QuoteButton','QuoteDetails','Estimated','Minimum','Fee','Impact','Expiry','BuyButton','PurchaseStatus','Receipt'].map(key=>[key,document.getElementById('sti'+key)]));
let runtimePromise, quote = null, busy = false, quoting = false, generation = 0, balance = null, balanceOwner = null, pendingDigest = null;
const owner = () => window.playerAddress || null;
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
function invalidate() {generation++;quote=null;el.QuoteDetails.hidden=true;render();}
function render() {
  const fresh=quote && Date.now()-quote.at<QUOTE_TTL;
  el.QuoteButton.disabled=busy||quoting||Boolean(pendingDigest);
  el.Amount.disabled=busy||Boolean(pendingDigest);
  el.CloseBuy.disabled=busy;
  el.BuyButton.textContent=pendingDigest?'Check confirmation':!owner()?'Connect wallet':busy?'Checking purchase…':'Approve purchase in wallet';
  el.BuyButton.disabled=busy||(!pendingDigest&&Boolean(owner())&&(!fresh||quoting));
  if(quote)el.Expiry.textContent=fresh?`${Math.ceil((QUOTE_TTL-(Date.now()-quote.at))/1000)} seconds`:'Expired — get a new quote';
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
    status('Review the amount and minimum STI received. The quote expires after 30 seconds.');
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
  if(busy)return;
  if(!hostAllowed()){status('Purchases are available only on the official TREE site and its review previews.',true);return;}
  if(!owner()){
    if(!window.openWalletManager){status('The wallet connector is still loading. Try again shortly.',true);return;}
    try{await window.openWalletManager({mode:'picker'});}catch{status('Wallet connection cancelled.');}
    render();return;
  }
  const address=owner(), request=generation;
  busy=true;render();
  try {
    const {client,Transaction}=await runtime();
    if(pendingDigest){status('Checking your submitted purchase…');await confirmPending(client);return;}
    const amount=parseSui(el.Amount.value), reviewed=validateQuote(quote,amount);
    const {balance:available}=await client.core.getBalance({owner:address,coinType:SUI});requireBalance(available.balance,amount);
    if(owner()!==address||request!==generation)throw Error('Wallet or amount changed. Get a new quote.');
    status('Checking the purchase on Sui Mainnet before wallet approval…');
    const tx=buildPurchase(Transaction,address,reviewed);
    const bytes=await tx.build({client});
    const result=await client.core.simulateTransaction({transaction:bytes,include:{effects:true,balanceChanges:true}});
    checkSimulation(result,address,reviewed);
    validateQuote(reviewed,parseSui(el.Amount.value));
    if(owner()!==address||request!==generation||el.Purchase.hidden)throw Error('Wallet or purchase details changed. Get a new quote.');
    if(typeof window.signAndExecuteTransactionBlock!=='function')throw Error('Wallet signing is unavailable.');
    status(`Approve ${units(amount)} SUI for at least ${units(reviewed.minOut)} STI in your wallet. Network gas is extra.`);
    // Pass the exact, already-resolved bytes that succeeded in simulation.
    const signed=await window.signAndExecuteTransactionBlock(Transaction.from(bytes));
    const digest=signed?.digest||signed?.Transaction?.digest||signed?.effects?.transactionDigest||signed?.transactionBlockDigest;
    if(!digest)throw Error('No transaction ID was returned. Check your wallet activity before trying again.');
    pendingDigest=digest;invalidate();el.Receipt.hidden=false;el.Receipt.textContent=`Submitted transaction: ${digest}`;
    status('Purchase submitted. Waiting for confirmation…');await confirmPending(client);
  } catch(error) {
    if(pendingDigest)status('Your purchase was submitted; confirmation is pending. Use Check confirmation before making another purchase.',true);
    else {invalidate();status(/reject|cancel/i.test(error.message)?'Purchase cancelled in your wallet. No automatic retry will occur.':error.message||'Purchase unavailable. Check your wallet activity before trying again.',true);}
  } finally {busy=false;render();}
}
let feedLoading=false;
async function loadFeed() {
  if(feedLoading||document.hidden||document.getElementById('stats').hidden)return;
  feedLoading=true;
  try {
    const response=await fetch(FEED,{credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',signal:AbortSignal.timeout(12_000)});
    if(!response.ok)throw Error('Feed unavailable');const data=parseFeed(await response.json());
    el.Membership.textContent=data.member?'TREE is held in the STI basket':'TREE is not currently an active basket member';
    el.Share.textContent=data.member?(data.share*100).toFixed(2)+'%':'—';
    el.Held.textContent=data.member?new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(Number(data.held)/1e6):'—';
    el.Holders.textContent=data.member?data.holders.toLocaleString():'—';
    el.DataStatus.textContent=`Source: STI public feed · Updated ${new Date(data.at).toLocaleTimeString()}`;
  } catch {el.Membership.textContent='Index data temporarily unavailable';el.Share.textContent=el.Held.textContent=el.Holders.textContent='—';el.DataStatus.textContent='STI data could not be verified. Purchase quotes are checked separately against the live pool.';}
  finally {feedLoading=false;}
}
el.OpenBuy.addEventListener('click',()=>{el.Purchase.hidden=false;el.OpenBuy.setAttribute('aria-expanded','true');el.Amount.focus();loadBalance();render();});
el.CloseBuy.addEventListener('click',()=>{if(busy)return;el.Purchase.hidden=true;el.OpenBuy.setAttribute('aria-expanded','false');invalidate();el.OpenBuy.focus();});
el.Amount.addEventListener('input',()=>{invalidate();status('Amount changed. Get a new quote.');});
el.QuoteButton.addEventListener('click',getQuote);el.BuyButton.addEventListener('click',purchase);
window.addEventListener('tree:wallet-changed',()=>{invalidate();if(!el.Purchase.hidden)loadBalance();});
new MutationObserver(()=>{loadFeed();if(document.getElementById('stats').hidden)invalidate();}).observe(document.getElementById('stats'),{attributes:true,attributeFilter:['hidden']});
setInterval(()=>{if(!el.Purchase.hidden)render();},1000);
setInterval(loadFeed,60_000);loadFeed();render();
