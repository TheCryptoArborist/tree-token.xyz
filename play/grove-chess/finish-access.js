// Cosmetic access only. Reuse the site's mainnet direct + kiosk ownership reader
// and wallet bridge. No transactions, signatures, rewards, or chess privileges.
export const FINISHES = [
 {id:'gold',name:'Classic Gold',rarity:null,color:'#edcd73',deep:'#70501d'},
 {id:'common',name:'Birch Silver',rarity:'Common',color:'#d6e1e5',deep:'#526773'},
 {id:'rare',name:'Sapphire Stream',rarity:'Rare',color:'#58b8ff',deep:'#174e96'},
 {id:'epic',name:'Amethyst Grove',rarity:'Epic',color:'#bb78ff',deep:'#62319b'},
 {id:'legendary',name:'Ancient Amber',rarity:'Legendary',color:'#ffad42',deep:'#9a4616'},
 {id:'mythic',name:'Rose Canopy',rarity:'Mythic',color:'#ff668d',deep:'#9e2657'},
 {id:'one-of-one',name:'Opal Crown',rarity:'1-of-1',color:'#9bffdf',deep:'#22756d'},
];
const address=x=>typeof x==='string'&&/^0x[a-f0-9]{64}$/i.test(x)?x.toLowerCase():null;
export function createFinishAccess({view=window,loadBridge=()=>import('/assets/arcade/arcade-growth-wallet.js'),loadReader=()=>import('/scripts/profile-studio-access-v4.js'),onChange=()=>{},now=()=>Date.now()}={}) {
 let bridge,reader,bridgePromise,serial=0,timer,unsub,destroyed=false;
 let state={wallet:null,rarities:new Set(),expiresAt:0,busy:false,message:'Connect your wallet to unlock finishes for the NFTree rarities you hold.'};
 const current=()=>{try {const w=bridge?.getWalletState();return w?.connected?address(w.address):null;}catch{return null;}};
 const emit=()=>{if(!destroyed)onChange(state);};
 function clear(message,busy=false){serial++;view.clearTimeout(timer);state={wallet:current(),rarities:new Set(),expiresAt:0,busy,message};emit();}
 async function getBridge(){if(!bridgePromise)bridgePromise=loadBridge().then(b=>{bridge=b;unsub=b.subscribeWalletState?.(()=>{clear('Wallet changed. Checking your NFTrees…',true);void refresh();});return b;}).catch(e=>{bridgePromise=null;throw e;});return bridgePromise;}
 function allowed(id){return id==='gold'||Boolean(FINISHES.some(f=>f.id===id)&&state.expiresAt>now()&&current()===state.wallet&&state.wallet&&state.rarities.has(id));}
 async function refresh({restore=false}={}) {
  clear('Checking NFTree finishes…',true);const ticket=serial;
  try {
   await getBridge();if(destroyed||ticket!==serial)return;
   if(restore&&!current()){
    let hint;for(const key of ['tree-profile:wallet:v1','tree-arcade:daily-growth:session:v1']){try{hint=JSON.parse(view.localStorage?.getItem(key)||view.sessionStorage?.getItem(key)||'null');if(address(hint?.wallet))break;}catch{}}
    if(address(hint?.wallet)&&bridge.restoreWallet)await bridge.restoreWallet({id:hint.walletId||hint.walletName,address:address(hint.wallet)});
   }
   if(destroyed||ticket!==serial)return;const wallet=current();
   if(!wallet){clear('Connect your wallet to unlock finishes for the NFTree rarities you hold.');return;}
   reader=reader||await loadReader();const nfts=await reader.readHeldNFTrees(wallet);
   if(destroyed||ticket!==serial||current()!==wallet)return;
   const rarities=new Set(nfts.map(n=>n.rarity).filter(r=>FINISHES.some(f=>f.rarity&&f.id===r)));
   state={wallet,rarities,expiresAt:now()+120000,busy:false,message:nfts.partial?'Some holdings could not be checked. Verified finishes are available; refresh to retry.':rarities.size?'Your NFTree finishes are unlocked. Choose a finish for each side.':'No NFTrees found in this wallet. Classic Gold is always available.'};
   timer=view.setTimeout(()=>{void refresh();},120000);emit();
  }catch{if(!destroyed&&ticket===serial)clear('NFTree verification is unavailable. Classic Gold is ready to play; refresh to retry.');}
 }
 const focus=()=>{void refresh();};view.addEventListener('focus',focus);
 return {allowed,refresh,get state(){return state;},async wallets(){return (await getBridge()).getAvailableWallets();},async connect(id){await getBridge();clear('Connecting wallet…',true);try{await bridge.connectWallet(id);const w=bridge.getWalletState();if(current())try{view.localStorage?.setItem('tree-profile:wallet:v1',JSON.stringify({wallet:current(),walletId:w.walletId,walletName:w.walletName}));}catch{}await refresh();}catch{clear('Wallet connection was not completed. You can keep playing with Classic Gold.');}},destroy(){destroyed=true;serial++;view.clearTimeout(timer);unsub?.();view.removeEventListener('focus',focus);}};
}
