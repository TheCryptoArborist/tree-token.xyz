import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import {
  StandardConnect,
  StandardDisconnect,
  StandardEvents,
  SuiSignAndExecuteTransaction,
  SuiSignAndExecuteTransactionBlock,
  getWallets,
} from "@mysten/wallet-standard";

const SUI_SIGN_PERSONAL_MESSAGE = "sui:signPersonalMessage";

const MAINNET_CHAIN = "sui:mainnet";
const SUI_COIN_TYPE = "0x2::sui::SUI";
const SUI_RPC_URL = "https://fullnode.mainnet.sui.io:443";
const FALLBACK_PRICE_MIST = "25000000000";
const FALLBACK_PACKAGE_ID = "0x79459345a7abde29c4763c97c65f8f48b9e9878dc077ea7ab57c0ad7d585c736";
const FALLBACK_MINT_CONFIG_ID = "0xe83616020f61f73b30c40fd3f888ed397626afd071bd4666374c306d8e98b06b";
const GAS_BUDGET_MIST = 120_000_000n;
const DEBUG_MINT = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debugMint") === "1";
const USER_FACING_MESSAGES = Object.freeze({
  walletDisconnected: "Wallet disconnected.",
  connectBeforeMinting: "Connect a Sui wallet before minting.",
  mintPreview25Sui: "You are about to mint 1 NFTree for 25 SUI.",
  salePoolFailed: "Sale pool data failed to load.",
  noActivePool: "No active NFTree sale pool found.",
  insufficientSui: "Insufficient SUI for NFTree mint. You need 25 SUI plus gas.",
  walletSigningCancelled: "Wallet signing was cancelled.",
  unsupportedSigning: "Wallet does not support Sui transaction signing.",
});

const client = new SuiGrpcClient({ network: "mainnet", baseUrl: SUI_RPC_URL });
const walletsApi = getWallets();
const connectedAccounts = new Map();
let activeConnection = { accountAddress: "", walletName: "" };

function errorDebugDetails(error) {
  if (!error) return {};
  return {
    name: error.name || "",
    message: error.message || String(error),
    code: error.code || "",
    cause: error.cause ? String(error.cause?.message || error.cause) : "",
    stack: error.stack || "",
    digest: error.digest || "",
  };
}

function debugMint(label, details = {}) {
  if (!DEBUG_MINT) return;
  console.info("[NFTree mint debug]", label, details);
}

function walletDebugDetails(wallet) {
  return {
    name: wallet?.name || "",
    chains: Array.from(wallet?.chains || []),
    features: Object.keys(wallet?.features || {}),
  };
}

function accountDebugDetails(account) {
  return {
    address: account?.address || "",
    chains: Array.from(account?.chains || []),
    features: Array.from(account?.features || []),
  };
}

function walletSupportsSui(wallet) {
  return (
    wallet?.chains?.includes(MAINNET_CHAIN) ||
    wallet?.accounts?.some((account) => account.chains?.includes(MAINNET_CHAIN))
  );
}

function hasSigningFeature(wallet) {
  return Boolean(wallet?.features?.[SuiSignAndExecuteTransaction] || wallet?.features?.[SuiSignAndExecuteTransactionBlock]);
}

async function signReferralClaim({ walletName, accountAddress, message }) {
  const wallet = findWallet(walletName);
  const account = wallet && getConnectedAccount(wallet, accountAddress);
  const feature = wallet?.features?.[SUI_SIGN_PERSONAL_MESSAGE];
  if (!wallet || !account?.address || !feature?.signPersonalMessage) {
    throw new Error("This wallet cannot sign the referral verification message.");
  }
  const result = await feature.signPersonalMessage({
    account,
    message: new TextEncoder().encode(String(message)),
  });
  if (!result?.signature) throw new Error("The wallet did not return a referral verification signature.");
  return { signature: result.signature };
}

function hasConnectFeature(wallet) {
  return Boolean(wallet?.features?.[StandardConnect]);
}

function mintCapableWallets() {
  return walletsApi.get().filter((wallet) => walletSupportsSui(wallet) && hasConnectFeature(wallet) && hasSigningFeature(wallet));
}

function normalizedName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+wallet\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function findWallet(walletName) {
  const target = normalizedName(walletName);
  const wallets = mintCapableWallets();
  return (
    wallets.find((wallet) => normalizedName(wallet.name) === target) ||
    wallets.find((wallet) => normalizedName(wallet.name).includes(target) || target.includes(normalizedName(wallet.name))) ||
    undefined
  );
}

function findInstalledWallet(walletName) {
  const target = normalizedName(walletName);
  if (!target) return undefined;
  return walletsApi.get().find((wallet) => normalizedName(wallet?.name) === target);
}

function getMainnetAccount(accounts) {
  return accounts.find((account) => account.chains?.includes(MAINNET_CHAIN));
}

function getConnectedAccount(wallet, accountAddress) {
  const accounts = Array.from(wallet?.accounts || []);
  if (accountAddress) {
    const cached = connectedAccounts.get(`${normalizedName(wallet?.name)}:${accountAddress}`);
    if (cached?.address === accountAddress && cached.chains?.includes(MAINNET_CHAIN)) return cached;
    return accounts.find((account) => account.address === accountAddress && account.chains?.includes(MAINNET_CHAIN));
  }
  return getMainnetAccount(accounts);
}

function forgetConnectedAccount(walletName, accountAddress) {
  if (!accountAddress) return;
  connectedAccounts.delete(`${normalizedName(walletName)}:${accountAddress}`);
  if (normalizedName(activeConnection.walletName) === normalizedName(walletName) && activeConnection.accountAddress === accountAddress) {
    activeConnection = { accountAddress: "", walletName: "" };
  }
}

function rememberConnectedAccount(walletName, account) {
  if (!account?.address) return;
  connectedAccounts.set(`${normalizedName(walletName)}:${account.address}`, account);
  activeConnection = { accountAddress: account.address, walletName };
}

function getConnectedWalletState({ walletName, accountAddress } = {}) {
  const effectiveWalletName = walletName || activeConnection.walletName;
  const effectiveAccountAddress = accountAddress || activeConnection.accountAddress;
  const wallet = walletName ? findInstalledWallet(effectiveWalletName) : findWallet(effectiveWalletName);
  const account = wallet && effectiveAccountAddress ? getConnectedAccount(wallet, effectiveAccountAddress) : undefined;

  return {
    accountAddress: account?.address || "",
    accountExists: Boolean(account?.address),
    account: accountDebugDetails(account),
    canSign: Boolean(wallet && account?.address && hasSigningFeature(wallet)),
    walletExists: Boolean(wallet),
    wallet: walletDebugDetails(wallet),
    walletName: wallet?.name || effectiveWalletName || "",
  };
}

function exactMainnetAccount(accounts, accountAddress) {
  return Array.from(accounts || []).find(
    (account) => account?.address === accountAddress && account.chains?.includes(MAINNET_CHAIN),
  );
}

async function restoreWalletConnection({ walletName, accountAddress } = {}) {
  if (!walletName || !accountAddress) {
    return { connected: false, definitive: false, reason: "missing-saved-connection" };
  }

  const wallet = findInstalledWallet(walletName);
  if (!wallet) {
    return { connected: false, definitive: false, reason: "wallet-not-registered", walletName };
  }

  const connectFeature = wallet.features?.[StandardConnect];
  if (!connectFeature?.connect || !hasSigningFeature(wallet)) {
    return { connected: false, definitive: false, reason: "wallet-cannot-restore", walletName: wallet.name };
  }

  const cached = connectedAccounts.get(`${normalizedName(wallet.name)}:${accountAddress}`);
  const existing = exactMainnetAccount([cached, ...Array.from(wallet.accounts || [])], accountAddress);
  if (existing) {
    rememberConnectedAccount(wallet.name, existing);
    return { connected: true, account: existing.address, accountAddress: existing.address, walletName: wallet.name };
  }

  let connection;
  try {
    connection = await connectFeature.connect({ silent: true });
  } catch (error) {
    debugMint("Silent wallet restore failed", {
      walletName: wallet.name,
      accountAddress,
      error: errorDebugDetails(error),
    });
    return { connected: false, definitive: false, reason: "silent-connect-failed", walletName: wallet.name };
  }

  const returnedAccounts = Array.from(connection?.accounts || []);
  const currentAccounts = Array.from(wallet.accounts || []);
  const restored = exactMainnetAccount([...returnedAccounts, ...currentAccounts], accountAddress);
  if (!restored) {
    const reportedAccounts = Array.isArray(connection?.accounts) || returnedAccounts.length > 0 || currentAccounts.length > 0;
    return {
      connected: false,
      definitive: reportedAccounts,
      reason: reportedAccounts ? "saved-account-unavailable" : "silent-restore-unavailable",
      walletName: wallet.name,
    };
  }

  rememberConnectedAccount(wallet.name, restored);
  debugMint("Silent wallet restore succeeded", {
    walletName: wallet.name,
    account: accountDebugDetails(restored),
  });
  return { connected: true, account: restored.address, accountAddress: restored.address, walletName: wallet.name };
}

function firstAvailablePool(salePoolStatus) {
  const pools = Array.isArray(salePoolStatus?.pools) ? salePoolStatus.pools : [];
  return (
    pools.find((pool) => pool.poolId === salePoolStatus?.activePoolId && Number(pool.count || 0) > 0) ||
    pools.find((pool) => Number(pool.count || 0) > 0)
  );
}

function formatMistAsSui(value) {
  const mist = BigInt(value || 0);
  const whole = mist / 1_000_000_000n;
  const fraction = mist % 1_000_000_000n;
  if (fraction === 0n) return `${whole.toLocaleString("en-US")} SUI`;
  return `${whole.toLocaleString("en-US")}.${fraction.toString().padStart(9, "0").replace(/0+$/, "")} SUI`;
}

function balanceMistFromResponse(balance) {
  if (typeof balance?.totalBalance === "string") return balance.totalBalance;
  if (typeof balance?.balance === "string") return balance.balance;
  if (typeof balance?.balance?.balance === "string") return balance.balance.balance;
  if (typeof balance?.balance?.coinBalance === "string") return balance.balance.coinBalance;
  return "0";
}

function coinItemsFromPage(page) {
  if (Array.isArray(page?.data)) return page.data;
  if (Array.isArray(page?.objects)) return page.objects;
  return [];
}

function nextCoinCursorFromPage(page) {
  return page?.nextCursor || page?.cursor || null;
}

async function fetchSuiCoins(owner) {
  const coins = [];
  let cursor = null;

  do {
    const page = await client.listCoins({
      owner,
      coinType: SUI_COIN_TYPE,
      cursor,
      limit: 50,
    });
    coins.push(...coinItemsFromPage(page));
    cursor = page?.hasNextPage ? nextCoinCursorFromPage(page) : null;
  } while (cursor && coins.length < 200);

  return coins;
}

async function getSuiBalance({ accountAddress } = {}) {
  const owner = String(accountAddress || activeConnection.accountAddress || "");
  if (!owner) {
    throw new Error("Connect a Sui wallet before checking balance.");
  }

  const balance = await client.getBalance({ owner, coinType: SUI_COIN_TYPE });
  const balanceMist = balanceMistFromResponse(balance);
  debugMint("Fetched SUI balance", {
    accountAddress: owner,
    balanceMist,
    balanceSui: formatMistAsSui(balanceMist),
    coinType: SUI_COIN_TYPE,
  });

  return {
    accountAddress: owner,
    balanceMist,
    balanceSui: formatMistAsSui(balanceMist),
    coinType: SUI_COIN_TYPE,
  };
}

async function assertMintBalance(account, mintPriceMist) {
  try {
    const [balance, coins] = await Promise.all([
      client.getBalance({ owner: account.address, coinType: SUI_COIN_TYPE }),
      fetchSuiCoins(account.address),
    ]);
    const totalBalance = BigInt(balanceMistFromResponse(balance));
    const requiredBalance = mintPriceMist + GAS_BUDGET_MIST;
    const largestCoinBalance = coins.reduce((largest, coin) => {
      const coinBalance = BigInt(coin?.balance || 0);
      return coinBalance > largest ? coinBalance : largest;
    }, 0n);

    if (totalBalance < requiredBalance) {
      throw Object.assign(
        new Error(
          `${account.address.slice(0, 6)}...${account.address.slice(-4)} has ${formatMistAsSui(totalBalance)} available. ` +
            `NFTree minting needs ${formatMistAsSui(mintPriceMist)} plus up to ${formatMistAsSui(GAS_BUDGET_MIST)} gas.`,
        ),
        { code: "NFTREE_INSUFFICIENT_SUI" },
      );
    }

    if (coins.length && largestCoinBalance < requiredBalance) {
      throw Object.assign(
        new Error(
          `${account.address.slice(0, 6)}...${account.address.slice(-4)} has enough total SUI, but it appears split across smaller SUI coins. ` +
            `Merge SUI coins in the wallet so one coin can cover ${formatMistAsSui(mintPriceMist)} plus up to ${formatMistAsSui(GAS_BUDGET_MIST)} gas.`,
        ),
        { code: "NFTREE_INSUFFICIENT_SUI" },
      );
    }
  } catch (error) {
    if (error?.code === "NFTREE_INSUFFICIENT_SUI") throw error;
    console.warn("NFTree balance precheck failed; continuing with wallet signing.", error);
  }
}

function humanizeTransactionError(message) {
  if (String(message || "").includes("InsufficientCoinBalance")) {
    return `${USER_FACING_MESSAGES.insufficientSui} Add SUI, merge SUI coins in the wallet, or switch wallets and try again.`;
  }
  return message || "The wallet submitted the transaction, but it did not complete.";
}

function buildPurchaseTransaction({ account, pool, salePoolStatus }) {
  if (!pool?.poolId) throw new Error(USER_FACING_MESSAGES.noActivePool);

  const tx = new Transaction();
  tx.setSender(account.address);
  tx.setGasBudget(Number(GAS_BUDGET_MIST));

  const mintPriceMist = BigInt(salePoolStatus?.mintPriceMist || FALLBACK_PRICE_MIST);
  const latestPackageId = salePoolStatus?.latestPackageId || FALLBACK_PACKAGE_ID;
  const mintConfigId = salePoolStatus?.mintConfigId || FALLBACK_MINT_CONFIG_ID;
  const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(mintPriceMist)]);
  const target = `${latestPackageId}::collection::purchase`;

  debugMint("Build NFTree purchase transaction", {
    account: account.address,
    poolId: pool.poolId,
    poolLabel: pool.label || "",
    mintConfigId,
    mintPriceMist: mintPriceMist.toString(),
    transactionTarget: target,
    chain: MAINNET_CHAIN,
  });

  tx.moveCall({
    target,
    arguments: [tx.object(pool.poolId), payment, tx.object(mintConfigId)],
  });

  return tx;
}

async function signAndExecute(wallet, account, transaction) {
  const transactionWrapper = {
    toJSON: async () => transaction.toJSON({ client }),
  };

  const modernFeature = wallet.features[SuiSignAndExecuteTransaction];
  if (modernFeature) {
    debugMint("Wallet signing method selected", {
      method: SuiSignAndExecuteTransaction,
      chain: MAINNET_CHAIN,
      wallet: walletDebugDetails(wallet),
      account: accountDebugDetails(account),
      transactionHasToJSON: typeof transactionWrapper.toJSON === "function",
    });
    return modernFeature.signAndExecuteTransaction({
      account,
      chain: MAINNET_CHAIN,
      transaction: transactionWrapper,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });
  }

  const legacyFeature = wallet.features[SuiSignAndExecuteTransactionBlock];
  if (legacyFeature) {
    debugMint("Wallet signing method selected", {
      method: SuiSignAndExecuteTransactionBlock,
      chain: MAINNET_CHAIN,
      wallet: walletDebugDetails(wallet),
      account: accountDebugDetails(account),
      transactionHasToJSON: typeof transactionWrapper.toJSON === "function",
    });
    return legacyFeature.signAndExecuteTransactionBlock({
      account,
      chain: MAINNET_CHAIN,
      transactionBlock: Transaction.from(await transactionWrapper.toJSON()),
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });
  }

  throw new Error(`${USER_FACING_MESSAGES.unsupportedSigning} ${wallet.name} cannot submit this NFTree mint.`);
}

async function connectWalletInternal(walletName) {
  const wallet = findWallet(walletName);
  if (!wallet) {
    throw new Error(`${walletName || "That wallet"} was not detected in this browser.`);
  }
  debugMint("Wallet detected for connect", walletDebugDetails(wallet));

  const connectFeature = wallet.features[StandardConnect];
  if (!connectFeature) {
    throw new Error(`${wallet.name} cannot connect through Wallet Standard.`);
  }

  const connection = await connectFeature.connect();
  const account = getMainnetAccount(Array.from(connection.accounts || wallet.accounts || []));
  if (!account?.address) {
    throw new Error(`${wallet.name} did not return a Sui mainnet account.`);
  }

  debugMint("Wallet connected account selected", {
    wallet: walletDebugDetails(wallet),
    account: accountDebugDetails(account),
  });

  return { wallet, account };
}

async function connectWallet({ walletName }) {
  try {
    const { wallet, account } = await connectWalletInternal(walletName);
    rememberConnectedAccount(wallet.name, account);
    return {
      account: account.address,
      walletName: wallet.name,
    };
  } catch (error) {
    debugMint("Wallet connect error", errorDebugDetails(error));
    throw error;
  }
}

async function mintWithWalletAccount({ wallet, account, salePoolStatus }) {
  const pool = firstAvailablePool(salePoolStatus);
  if (!pool?.poolId) throw new Error(USER_FACING_MESSAGES.noActivePool);
  const mintPriceMist = BigInt(salePoolStatus?.mintPriceMist || FALLBACK_PRICE_MIST);
  debugMint("Mint with wallet account requested", {
    wallet: walletDebugDetails(wallet),
    account: accountDebugDetails(account),
    activePoolId: pool?.poolId || "",
    activePoolLabel: pool?.label || "",
    mintConfigId: salePoolStatus?.mintConfigId || FALLBACK_MINT_CONFIG_ID,
    mintPriceMist: mintPriceMist.toString(),
    transactionTarget: `${salePoolStatus?.latestPackageId || FALLBACK_PACKAGE_ID}::collection::purchase`,
  });
  await assertMintBalance(account, mintPriceMist);

  const transaction = buildPurchaseTransaction({ account, pool, salePoolStatus });
  const result = await signAndExecute(wallet, account, transaction);
  const transactionStatus = result?.effects?.status;

  if (transactionStatus?.status === "failure") {
    throw Object.assign(new Error(humanizeTransactionError(transactionStatus.error)), {
      code: "NFTREE_TRANSACTION_FAILED",
      digest: result.digest,
    });
  }

  return {
    account: account.address,
    digest: result.digest,
    poolId: pool.poolId,
    poolLabel: pool.label || "Sale pool",
    walletName: wallet.name,
  };
}

async function mintWithConnectedWallet({ walletName, accountAddress, salePoolStatus }) {
  const wallet = findWallet(walletName);
  if (!wallet) {
    throw new Error(`${walletName || "That wallet"} was not detected in this browser.`);
  }

  const account = getConnectedAccount(wallet, accountAddress);
  if (!account?.address) {
    throw new Error(`${wallet.name} is not connected. Connect the wallet before minting.`);
  }

  try {
    return await mintWithWalletAccount({ wallet, account, salePoolStatus });
  } catch (error) {
    debugMint("Mint with connected wallet error", errorDebugDetails(error));
    throw error;
  }
}

async function connectAndMint({ walletName, salePoolStatus }) {
  try {
    const { wallet, account } = await connectWalletInternal(walletName);
    rememberConnectedAccount(wallet.name, account);
    return await mintWithWalletAccount({ wallet, account, salePoolStatus });
  } catch (error) {
    debugMint("Connect and mint error", errorDebugDetails(error));
    throw error;
  }
}

async function disconnectWallet({ walletName, accountAddress } = {}) {
  const wallet = findWallet(walletName);
  try {
    const disconnectFeature = wallet?.features?.[StandardDisconnect];
    if (disconnectFeature?.disconnect) {
      await disconnectFeature.disconnect();
    }
  } finally {
    forgetConnectedAccount(wallet?.name || walletName, accountAddress);
  }

  return {
    walletName: wallet?.name || walletName || "",
    disconnected: true,
  };
}

function onConnectedWalletChange({ walletName, accountAddress }, callback) {
  if (typeof callback !== "function") return () => {};

  const wallet = findInstalledWallet(walletName);
  const on = wallet?.features?.[StandardEvents]?.on;
  if (!on) return () => {};

  return on("change", (properties) => {
    if (!Object.hasOwn(properties, "accounts")) return;

    const accounts = Array.from(properties.accounts || []);
    const account = accountAddress
      ? exactMainnetAccount(accounts, accountAddress)
      : getMainnetAccount(accounts);
    if (!account?.address) {
      forgetConnectedAccount(wallet.name, accountAddress);
      callback({ connected: false, walletName: wallet.name, account: "" });
      return;
    }

    rememberConnectedAccount(wallet.name, account);
    callback({ connected: true, walletName: wallet.name, account: account.address });
  });
}

function availableWallets() {
  return mintCapableWallets().map((wallet) => ({
    name: wallet.name,
    icon: typeof wallet.icon === "string" ? wallet.icon : "",
  }));
}

function availableWalletNames() {
  return availableWallets().map((wallet) => wallet.name);
}

function onWalletsChanged(callback) {
  if (typeof callback !== "function") return () => {};

  const emit = () => callback(availableWallets());
  const unsubscribeRegister = walletsApi.on?.("register", emit);
  const unsubscribeUnregister = walletsApi.on?.("unregister", emit);
  queueMicrotask(emit);

  return () => {
    unsubscribeRegister?.();
    unsubscribeUnregister?.();
  };
}

window.NFTreeWalletMint = {
  availableWallets,
  availableWalletNames,
  connectWallet,
  connectAndMint,
  disconnectWallet,
  getSuiBalance,
  getConnectedWalletState,
  messages: USER_FACING_MESSAGES,
  mintWithConnectedWallet,
  onConnectedWalletChange,
  onWalletsChanged,
  restoreWalletConnection,
  signReferralClaim,
};
