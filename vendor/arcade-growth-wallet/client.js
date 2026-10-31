import { getWallets } from '@mysten/wallet-standard';
import { createGrowthWalletClient } from './wallet-core.mjs';
const client = createGrowthWalletClient(getWallets());
export const { getWalletState, getAvailableWallets, connectWallet, restoreWallet, disconnectWallet,
  signPersonalMessage, subscribeWalletState, subscribeWallets } = client;
