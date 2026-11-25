// Game and cosmetic access. Reuse the site's mainnet direct + kiosk ownership reader
// and wallet bridge. No transactions, signatures, or rewards.
export const FINISHES = [
 {id:'gold',detail:'The original woodland court.',name:'Classic Gold',rarity:null,color:'#edcd73',deep:'#70501d'},
 {id:'common',detail:'Silver leafwork and a polished pedestal.',name:'Birch Silver',rarity:'Common',color:'#d6e1e5',deep:'#526773'},
 {id:'rare',detail:'Faceted crystal spires and a sapphire plinth.',name:'Sapphire Crystal',rarity:'Rare',color:'#58b8ff',deep:'#174e96'},
 {id:'epic',detail:'An arcane ring, woodland sigils and amethyst inlay.',name:'Runic Amethyst',rarity:'Epic',color:'#bb78ff',deep:'#62319b'},
 {id:'legendary',detail:'An oak-leaf crown and a carved golden pedestal.',name:'Ancient Oak',rarity:'Legendary',color:'#ffad42',deep:'#9a4616'},
 {id:'mythic',detail:'Rosefire petals, a crystal crest and a sculpted base.',name:'Rosefire Bloom',rarity:'Mythic',color:'#ff668d',deep:'#9e2657'},
 {id:'one-of-one',detail:'An iridescent leaf crown, starbursts and an opal plinth.',name:'Opal Crown',rarity:'1-of-1',color:'#9bffdf',deep:'#22756d'},
];
const address=x=>typeof x==='string'&&/^0x[a-f0-9]{64}$/i.test(x)?x.toLowerCase():null;
export function createFinishAccess({view=window,loadBridge=()=>import('/assets/arcade/arcade-growth-wallet.js'),loadReader=()=>import('/scripts/profile-studio-access-v4.js'),onChange=()=>{},now=()=>Date.now()}={}) {
 let bridge,reader,bridgePromise,serial=0,timer,unsub,destroyed=false;
 let state={wallet:null,rarities:new Set(),nftCount:0,expiresAt:0,busy:false,message:'No wallet is needed for your two free games. After that, connect a wallet containing an NFTree to keep playing.'};
 const current=()=>{try {const w=bridge?.getWalletState();return w?.connected?address(w.address):null;}catch{return null;}};
 const emit=()=>{if(!destroyed)onChange(state);};
 function clear(message,busy=false){serial++;view.clearTimeout(timer);state={wallet:current(),rarities:new Set(),nftCount:0,expiresAt:0,busy,message};emit();}
 async function getBridge(){if(!bridgePromise)bridgePromise=loadBridge().then(b=>{bridge=b;let observed=current();unsub=b.subscribeWalletState?.(()=>{const next=current();if(next===observed)return;observed=next;clear('Wallet changed. Checking your NFTrees…',true);void refresh();});return b;}).catch(e=>{bridgePromise=null;throw e;});return bridgePromise;}
 function allowed(id){return id==='gold'||Boolean(FINISHES.some(f=>f.id===id)&&state.expiresAt>now()&&current()===state.wallet&&state.wallet&&state.rarities.has(id));}
 async function refresh({restore=false}={}) {
  clear('Checking your NFTrees for game access…',true);const ticket=serial;
  try {
   await getBridge();if(destroyed||ticket!==serial)return;
   if(restore&&!current()){
    let hint;for(const key of ['tree-profile:wallet:v1','tree-arcade:daily-growth:session:v1']){try{hint=JSON.parse(view.localStorage?.getItem(key)||view.sessionStorage?.getItem(key)||'null');if(address(hint?.wallet))break;}catch{}}
    if(address(hint?.wallet)&&bridge.restoreWallet)await bridge.restoreWallet({id:hint.walletId||hint.walletName,address:address(hint.wallet)});
   }
   if(destroyed||ticket!==serial)return;const wallet=current();
   if(!wallet){clear('No wallet is needed for your two free games. After that, connect a wallet containing an NFTree to keep playing.');return;}
   reader=reader||await loadReader();const nfts=await reader.readHeldNFTrees(wallet);
   if(destroyed||ticket!==serial||current()!==wallet)return;
   const rarities=new Set(nfts.map(n=>n.rarity).filter(r=>FINISHES.some(f=>f.rarity&&f.id===r)));
   state={wallet,rarities,nftCount:nfts.length,expiresAt:now()+120000,busy:false,message:nfts.length?(nfts.partial?'NFTree verified — unlimited game access unlocked. Some chess sets could not be checked; select Check access & unlock sets to try again.':'NFTree verified — unlimited game access unlocked. Choose from your available chess sets below.'):(nfts.partial?'The NFTree check is incomplete. Select Check access & unlock sets to verify game access.':'No NFTrees found in this wallet. You can use your two free games; after that, an NFTree is required to keep playing.')};
   timer=view.setTimeout(()=>{void refresh();},120000);emit();
  }catch{if(!destroyed&&ticket===serial)clear('We could not check your NFTrees. Your game is saved. Select Check access & unlock sets to try again.');}
 }
 const focus=()=>{void refresh();};view.addEventListener('focus',focus);
 return {connection(){try{const w=bridge?.getWalletState();return w?.connected&&address(w.address)?{address:address(w.address),name:w.walletName||'Sui wallet',id:w.walletId||''}:null;}catch{return null;}},allowed,isHolder:()=>Boolean(state.nftCount>0&&state.expiresAt>now()&&current()===state.wallet&&state.wallet),refresh,get state(){return state;},async wallets(){return (await getBridge()).getAvailableWallets();},async connect(id){await getBridge();clear('Connecting wallet…',true);try{await bridge.connectWallet(id);const w=bridge.getWalletState();if(current())try{view.localStorage?.setItem('tree-profile:wallet:v1',JSON.stringify({wallet:current(),walletId:w.walletId,walletName:w.walletName}));}catch{}await refresh();}catch{clear('Wallet connection was not completed. Your saved game is safe.');}},destroy(){destroyed=true;serial++;view.clearTimeout(timer);unsub?.();view.removeEventListener('focus',focus);}};
}
