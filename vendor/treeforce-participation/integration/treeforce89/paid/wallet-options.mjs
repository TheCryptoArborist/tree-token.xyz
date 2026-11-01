// Installation links go to the wallet publishers. Connection always uses the
// actual UiWallet detected by the existing dApp Kit Wallet Standard store.
export const WALLET_OPTIONS=[
 {name:'Slush',href:'https://slush.app/download',color:'#a596ff',matches:/^(Slush|Sui Wallet)$/i},
 {name:'Suiet',href:'https://suiet.app/install',color:'#77d2fa',matches:/^Suiet(?: Wallet)?$/i},
 {name:'Nightly',href:'https://nightly.app/',color:'#b0a8ff',matches:/^Nightly(?: Wallet)?$/i},
 {name:'Backpack',href:'https://backpack.app/downloads',color:'#ff9b8f',matches:/^Backpack(?: Wallet| \(Sui\))?$/i},
];
export const missingWalletOptions=wallets=>WALLET_OPTIONS.filter(option=>!wallets.some(w=>option.matches.test(w.name)));
