import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  UiWallet,
  useCurrentAccount,
  useCurrentClient,
  useCurrentNetwork,
  useCurrentWallet,
  useDAppKit,
  useWalletConnection,
  useWallets,
} from "@mysten/dapp-kit-react";
import { Inputs, Transaction } from "@mysten/sui/transactions";
import {
  COMMUNITY_REWARDS_PACKAGE_ID,
  CommunityRewardTokenConfig,
  CommunityTokenPoolState,
  fetchAllCommunityTokenPoolStates,
  fetchCommunityEligibilityForNFTrees,
  findCommunityRewardConfig,
} from "./communityRewards";
import {
  fetchClaimedCommunityNFTrees,
  fetchClaimedNFTrees,
  fetchOwnedNFTrees,
  fetchRewardPoolState,
  OwnedNFTree,
  RewardPoolState,
} from "./pool";
import { CONFIG } from "./config";
import { REGISTERED_REWARD_TOKENS } from "./rewardTokens";
import { shortId } from "./format";
import "./holder.css";

type RewardAsset = {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  round: bigint;
  amount: bigint;
  vault: bigint;
  claimed: Set<string>;
  eligible: Set<string>;
  config?: CommunityRewardTokenConfig;
};
type RewardView = {
  wallet: string;
  nftrees: OwnedNFTree[];
  assets: RewardAsset[];
  checkedAt: number;
};
type ClaimOperation = { asset: RewardAsset; nftreeId: string; key: string };
type ClaimReceipt = { digest: string; amounts: Array<{ symbol: string; amount: bigint; decimals: number }>; confirmedAt: number };
type Notice = { tone: "info" | "success" | "error"; title: string; detail: string };
const MAX_CLAIMS_PER_BATCH = 24;

function claimKey(asset: RewardAsset, nftreeId: string) {
  return `${asset.id}:${asset.round.toString()}:${nftreeId.toLowerCase()}`;
}

function atomicAmount(amount: bigint, decimals: number) {
  const scale = 10n ** BigInt(decimals);
  const whole = (amount / scale).toLocaleString("en-US");
  const fraction = (amount % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

function message(error: unknown) {
  const text = error instanceof Error ? error.message : "The reward check could not finish.";
  if (/reject|cancel|denied/i.test(text)) return "The wallet request was cancelled. Your confirmed rewards are safe to check again.";
  if (/insufficient.*gas|gas.*balance|no valid gas/i.test(text)) return "Your wallet needs a small amount of SUI for the network fee.";
  return text.length > 250 ? "The request could not finish. Refresh your rewards and try again." : text;
}

function RewardsBackground() {
  const video = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!video.current) return;
    if (reduced || paused) video.current.pause();
    else void video.current.play().catch(() => setPaused(true));
  }, [reduced, paused]);
  return <>
    <div className="hr-background" aria-hidden="true">
      {!reduced && !failed && <video ref={video} src={CONFIG.backgroundVideoUrl} muted loop playsInline autoPlay preload="metadata" onError={() => setFailed(true)} />}
    </div>
    {!reduced && !failed && <button className="hr-video-control" onClick={() => setPaused(value => !value)} aria-label={paused ? "Play background video" : "Pause background video"}>{paused ? "Play background" : "Pause background"}</button>}
  </>;
}

function Leaf({ large = false }: { large?: boolean }) {
  return <svg className={large ? "hr-leaf hr-leaf-large" : "hr-leaf"} viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M31 8C16 7 8 14 10 23c2 9 15 12 19 1 2-5 0-10 2-16Z" fill="currentColor" opacity=".22"/><path d="M31 8C16 7 8 14 10 23c2 9 15 12 19 1 2-5 0-10 2-16ZM9 33l16-17M16 26l-1-7m6 2 7-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

async function readPools(signal: AbortSignal): Promise<{ sui: RewardPoolState; community: CommunityTokenPoolState[] }> {
  const [sui, community] = await Promise.all([
    fetchRewardPoolState(signal),
    fetchAllCommunityTokenPoolStates(REGISTERED_REWARD_TOKENS, signal),
  ]);
  if (sui.source !== "mainnet") throw new Error("SUI rewards could not be checked. Please try again.");
  const unavailable = community.filter((pool) => pool.source !== "mainnet");
  if (unavailable.length) throw new Error(`${unavailable.map((pool) => pool.symbol).join(", ")} rewards could not be checked. Please try again.`);
  return { sui, community };
}

async function readHolderRewards(address: string, signal: AbortSignal): Promise<RewardView> {
  const [{ sui, community }, nftrees] = await Promise.all([readPools(signal), fetchOwnedNFTrees(address, signal)]);
  signal.throwIfAborted();
  const ids = nftrees.map((nftree) => nftree.objectId);
  const owned = new Set(ids.map((id) => id.toLowerCase()));
  const assets: RewardAsset[] = [];
  // Include depleted current rounds in history; only funded rewards enter the claim plan.
  if (sui.currentRound > 0n && sui.perNftreeMist > 0n) {
    if (ids.length && !sui.claimedTableId) throw new Error("SUI claim history could not be verified. Please try again.");
    const claimed = ids.length ? await fetchClaimedNFTrees(sui.claimedTableId, sui.currentRound, ids, signal) : new Set<string>();
    assets.push({ id: "sui", symbol: "SUI", name: "Sui", decimals: 9, round: sui.currentRound, amount: sui.perNftreeMist, vault: sui.vaultBalance, claimed, eligible: owned });
  }
  const communityAssets = await Promise.all(community.filter((pool) => pool.currentRound > 0n && pool.perNftreeAmount > 0n).map(async (pool): Promise<RewardAsset> => {
    const config = findCommunityRewardConfig(pool.tokenId);
    const token = REGISTERED_REWARD_TOKENS.find((item) => item.tokenId === pool.tokenId);
    if (!config || !token || !config.eligibilityRegistryObjectId) throw new Error(`${pool.symbol} reward setup is unavailable.`);
    if (ids.length && !pool.claimedTableId) throw new Error(`${pool.symbol} claim history could not be verified.`);
    const [claimed, eligibility] = ids.length ? await Promise.all([
      fetchClaimedCommunityNFTrees(pool.claimedTableId, pool.currentRound, ids, signal),
      fetchCommunityEligibilityForNFTrees(config, pool.currentRound, ids, address, signal),
    ]) : [new Set<string>(), { eligibleNFTreeIds: new Set<string>() }];
    return { id: pool.tokenId, symbol: token.symbol, name: token.name, decimals: token.decimals, round: pool.currentRound, amount: pool.perNftreeAmount, vault: pool.vaultBalance, claimed, eligible: eligibility.eligibleNFTreeIds, config };
  }));
  signal.throwIfAborted();
  assets.push(...communityAssets);
  return { wallet: address.toLowerCase(), nftrees, assets, checkedAt: Date.now() };
}

function planClaims(view: RewardView | null, confirmed: Set<string>) {
  const operations: ClaimOperation[] = [];
  if (!view || view.wallet === CONFIG.adminAddress.toLowerCase()) return operations;
  for (const asset of view.assets) {
    let remaining = asset.vault;
    for (const nftree of view.nftrees) {
      const id = nftree.objectId.toLowerCase();
      const key = claimKey(asset, id);
      if (!asset.eligible.has(id) || asset.claimed.has(id) || confirmed.has(key) || remaining < asset.amount) continue;
      operations.push({ asset, nftreeId: nftree.objectId, key });
      remaining -= asset.amount;
    }
  }
  return operations;
}

// Original SUI and upgraded community calls cannot share one PTB: their Move
// linkage tables resolve the same rewards module to incompatible versions.
export function partitionClaimBatches(operations: ClaimOperation[], limit = MAX_CLAIMS_PER_BATCH) {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CLAIMS_PER_BATCH) throw new Error("Invalid claim batch limit.");
  const batches: ClaimOperation[][] = [];
  for (const community of [false, true]) {
    const family = operations.filter((operation) => Boolean(operation.asset.config) === community);
    for (let offset = 0; offset < family.length; offset += limit) batches.push(family.slice(offset, offset + limit));
  }
  return batches;
}

export function buildClaimBatch(operations: ClaimOperation[], address: string) {
  if (!operations.length || operations.length > MAX_CLAIMS_PER_BATCH) throw new Error("The reward batch is invalid. Refresh and try again.");
  const community = Boolean(operations[0].asset.config);
  if (operations.some((operation) => Boolean(operation.asset.config) !== community)) throw new Error("SUI and community rewards need separate wallet approvals.");
  const tx = new Transaction();
  tx.setSender(address);
  tx.setGasBudget(100_000_000);
  for (const operation of operations) {
    const config = operation.asset.config;
    if (!config) {
      tx.moveCall({
        target: `${CONFIG.packageId}::rewards::claim`,
        typeArguments: [CONFIG.nftreeType],
        arguments: [tx.object(Inputs.SharedObjectRef({ objectId: CONFIG.poolId, initialSharedVersion: CONFIG.poolInitialSharedVersion, mutable: true })), tx.object(operation.nftreeId)],
      });
    } else {
      if (!config.eligibilityRegistryObjectId || !config.eligibilityRegistryInitialSharedVersion) throw new Error(`${config.symbol} eligibility is unavailable.`);
      tx.moveCall({
        target: `${COMMUNITY_REWARDS_PACKAGE_ID}::rewards::claim_community_token_snapshot`,
        typeArguments: [config.coinType],
        arguments: [
          tx.object(Inputs.SharedObjectRef({ objectId: config.poolObjectId, initialSharedVersion: config.poolInitialSharedVersion, mutable: true })),
          tx.object(Inputs.SharedObjectRef({ objectId: config.eligibilityRegistryObjectId, initialSharedVersion: config.eligibilityRegistryInitialSharedVersion, mutable: false })),
          tx.pure.address(operation.nftreeId),
        ],
      });
    }
  }
  return tx;
}

function groupAmounts(operations: ClaimOperation[]) {
  const totals = new Map<string, { symbol: string; amount: bigint; decimals: number; count: number; name: string }>();
  for (const { asset } of operations) {
    const previous = totals.get(asset.id);
    totals.set(asset.id, { symbol: asset.symbol, amount: (previous?.amount || 0n) + asset.amount, decimals: asset.decimals, count: (previous?.count || 0) + 1, name: asset.name });
  }
  return Array.from(totals.values());
}

export function HolderApp() {
  const account = useCurrentAccount();
  const wallet = useCurrentWallet();
  const wallets = useWallets();
  const connection = useWalletConnection();
  const network = useCurrentNetwork();
  const client = useCurrentClient();
  const dAppKit = useDAppKit();
  const address = account?.address || "";
  const session = `${network}:${address.toLowerCase()}`;
  const currentSession = useRef(session);
  currentSession.current = session;
  const runController = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const modal = useRef<HTMLDialogElement>(null);
  const confirmed = useRef(new Map<string, Set<string>>());
  const [view, setView] = useState<RewardView | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [receipts, setReceipts] = useState<Record<string, ClaimReceipt[]>>({});
  const [confirmedNonce, setConfirmedNonce] = useState(0);
  const [publicStatus, setPublicStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const isAdmin = address.toLowerCase() === CONFIG.adminAddress.toLowerCase();
  const mainnet = network === CONFIG.network;

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timeout = setTimeout(() => controller.abort(), 30_000);
    setPublicStatus("loading");
    readPools(controller.signal).then(({ sui, community }) => {
      if (!disposed && !controller.signal.aborted) setPublicStatus((sui.currentRound > 0n && sui.perNftreeMist > 0n && sui.vaultBalance >= sui.perNftreeMist) || community.some((pool) => pool.currentRound > 0n && pool.perNftreeAmount > 0n && pool.vaultBalance >= pool.perNftreeAmount) ? "ready" : "empty");
    }).catch(() => { if (!disposed) setPublicStatus("error"); }).finally(() => clearTimeout(timeout));
    return () => { disposed = true; clearTimeout(timeout); controller.abort(); };
  }, [refreshNonce]);

  useEffect(() => {
    runController.current?.abort();
    busyRef.current = false;
    setBusy(false);
    setProgress("");
    setNotice(null);
    setView(null);
    setCheckError("");
    if (!address || !mainnet || isAdmin) { setChecking(false); return; }
    const controller = new AbortController();
    let disposed = false;
    const timeout = setTimeout(() => controller.abort(new Error("The reward check timed out. Please try again.")), 35_000);
    setChecking(true);
    readHolderRewards(address, controller.signal).then((next) => {
      if (!disposed && !controller.signal.aborted && currentSession.current === session) setView(next);
    }).catch((error) => {
      if (!disposed && currentSession.current === session) setCheckError(message(controller.signal.aborted ? controller.signal.reason : error));
    }).finally(() => {
      clearTimeout(timeout);
      if (!disposed && currentSession.current === session) setChecking(false);
    });
    return () => { disposed = true; clearTimeout(timeout); controller.abort(); };
  }, [address, mainnet, isAdmin, refreshNonce, session]);

  useEffect(() => () => runController.current?.abort(), []);

  const confirmedForWallet = confirmed.current.get(session) || new Set<string>();
  const operations = useMemo(() => planClaims(view, confirmedForWallet), [view, session, confirmedNonce]);
  const amounts = useMemo(() => groupAmounts(operations), [operations]);
  const approvalCount = partitionClaimBatches(operations).length;
  const eligibleCount = new Set(operations.map((operation) => operation.nftreeId)).size;
  const receiptList = receipts[session] || [];
  const checkedView = view?.wallet === address.toLowerCase() ? view : null;
  const canClaim = Boolean(address && mainnet && checkedView && operations.length && !checking && !busy && !checkError && !isAdmin);
  const retry = () => { if (!busyRef.current) setRefreshNonce((value) => value + 1); };

  const connect = async (chosen: UiWallet) => {
    try {
      setNotice(null);
      await dAppKit.connectWallet({ wallet: chosen });
      modal.current?.close();
    } catch (error) {
      setNotice({ tone: "error", title: "Wallet not connected", detail: message(error) });
    }
  };

  const claimAll = useCallback(async () => {
    if (!canClaim || busyRef.current || !account) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    const claimSession = session;
    const controller = new AbortController();
    runController.current = controller;
    const assertSession = () => {
      controller.signal.throwIfAborted();
      if (currentSession.current !== claimSession) throw new Error("Your wallet changed. Check rewards for the selected wallet before claiming.");
    };
    let completed = 0;
    try {
      setProgress("Refreshing your rewards…");
      const fresh = await readHolderRewards(address, controller.signal);
      assertSession();
      setView(fresh);
      const alreadyConfirmed = confirmed.current.get(claimSession) || new Set<string>();
      const pending = planClaims(fresh, alreadyConfirmed);
      if (!pending.length) { setNotice({ tone: "info", title: "Rewards up to date", detail: "There are no remaining rewards to claim for these NFTrees." }); return; }
      const batches = partitionClaimBatches(pending);
      const totalBatches = batches.length;
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
        assertSession();
        const batch = batches[batchIndex];
        const batchNumber = batchIndex + 1;
        const familyLabel = batch[0].asset.config ? "community rewards" : "SUI rewards";
        const label = totalBatches > 1 ? ` (${batchNumber} of ${totalBatches})` : "";
        // Recheck receipts and round immediately before each approval. Never resubmit a confirmed claim.
        const latest = batchIndex === 0 ? fresh : await readHolderRewards(address, controller.signal);
        assertSession();
        if (batch.some((operation) => {
          const currentAsset = latest.assets.find((asset) => asset.id === operation.asset.id);
          return !currentAsset || currentAsset.round !== operation.asset.round || currentAsset.amount !== operation.asset.amount;
        })) throw new Error("This reward drop changed. Refresh your rewards before approving a new claim.");
        const latestByKey = new Map(planClaims(latest, alreadyConfirmed).map((operation) => [operation.key, operation]));
        const remaining = batch.filter((operation) => latestByKey.has(operation.key));
        if (remaining.some((operation) => latestByKey.get(operation.key)?.asset.amount !== operation.asset.amount)) throw new Error("This reward drop changed. Refresh your rewards before approving a new claim.");
        if (!remaining.length) continue;
        const tx = buildClaimBatch(remaining, address);
        setProgress(`Checking ${familyLabel}${label}…`);
        const simulation = await client.simulateTransaction({ transaction: tx, include: { effects: true }, signal: controller.signal });
        assertSession();
        if (simulation.FailedTransaction || !simulation.Transaction?.status.success) throw new Error("The claim could not pass its network check. Refresh your rewards and try again.");
        setProgress(`Approve ${familyLabel}${label} in ${wallet?.name || "your wallet"}`);
        const result = await dAppKit.signAndExecuteTransaction({ transaction: tx, account, network: CONFIG.network, signal: controller.signal });
        if (result.FailedTransaction || !result.Transaction?.status.success) throw new Error("The network did not complete this claim. Refresh your rewards before trying again.");
        const digest = result.Transaction.digest;
        // The execution response has successful effects. Remember it even if indexing or the UI session changes.
        const confirmedKeys = confirmed.current.get(claimSession) || new Set<string>();
        for (const operation of remaining) confirmedKeys.add(operation.key);
        confirmed.current.set(claimSession, confirmedKeys);
        const receipt = { digest, amounts: groupAmounts(remaining), confirmedAt: Date.now() };
        setReceipts((current) => ({ ...current, [claimSession]: [...(current[claimSession] || []), receipt] }));
        setConfirmedNonce((value) => value + 1);
        completed += remaining.length;
        assertSession();
        setProgress(`Confirming ${familyLabel}${label}…`);
        const finalized = await client.waitForTransaction({ result, include: { effects: true }, timeout: 30_000, signal: controller.signal });
        if (finalized.FailedTransaction || !finalized.Transaction?.status.success) throw new Error("The claim receipt could not be confirmed. Check the transaction receipt before trying again.");
        assertSession();
      }
      setNotice({ tone: "success", title: "Rewards delivered", detail: "Your confirmed rewards are now in your wallet. Open Reward history to view the receipts." });
    } catch (error) {
      if (currentSession.current === claimSession && !controller.signal.aborted) setNotice({ tone: "error", title: completed ? "Some rewards were delivered" : "Claim paused", detail: `${message(error)}${completed ? " Confirmed rewards will not be submitted again." : ""}` });
    } finally {
      if (runController.current === controller) {
        runController.current = null;
        busyRef.current = false;
        if (currentSession.current === claimSession) { setBusy(false); setProgress(""); setRefreshNonce((value) => value + 1); }
      }
    }
  }, [account, address, canClaim, client, dAppKit, session, wallet?.name]);

  const opening = connection.isConnecting || connection.isReconnecting;
  const stateTitle = isAdmin ? "Your reward manager is ready" : !address ? "Your NFTrees unlock more." : !mainnet ? "Select Sui Mainnet" : checking ? "Checking your NFTrees…" : checkError ? "We couldn’t check your rewards" : !checkedView ? "Ready when you are" : !checkedView.nftrees.length ? "An NFTree is your access pass" : operations.length ? "A little extra for your canopy." : "You’re all caught up.";
  const stateDescription = isAdmin ? "This is the project wallet. Create and manage distributions from your reward manager." : !address ? "Connect the wallet that holds your NFTrees. We’ll find your eligible rewards automatically." : !mainnet ? "Rewards are available on Sui Mainnet. Check your wallet network and reconnect." : checking ? "Finding your NFTrees and checking the current reward drops." : checkError ? checkError : !checkedView ? "Your rewards will appear here after a successful check." : !checkedView.nftrees.length ? "Use the wallet that holds your NFTree, or get one to join the TREE ecosystem." : operations.length ? `Rewards from ${eligibleCount} eligible NFTree${eligibleCount === 1 ? "" : "s"}, combined into one simple claim.` : "No rewards are available for these NFTrees right now. Check back when a new drop opens.";

  return <div className="hr-page">
    <RewardsBackground />
    <header className="hr-header">
      <a className="hr-brand" href="/" aria-label="TREE home"><span className="hr-brand-icon"><Leaf /></span><span>TREE<span className="hr-brand-sub">ROOTED IN COMMUNITY</span></span></a>
      <nav className="hr-nav" aria-label="TREE navigation"><a href="/">Home</a><a href="/dapp/">App</a><a href="/play/">Arcade</a><a className="hr-nav-active" href="/rewards/" aria-current="page">NFTree Rewards</a></nav>
      <button className="hr-wallet-button" onClick={() => modal.current?.showModal()} disabled={opening || busy} aria-haspopup="dialog">{opening ? "Connecting…" : address ? shortId(address) : "Connect Wallet"}<span aria-hidden="true">↗</span></button>
    </header>

    <main className="hr-main" id="main">
      <section className="hr-intro" aria-labelledby="hr-title">
        <div className="hr-intro-copy"><p className="hr-eyebrow"><span /> THE NFTREE HOLDER BENEFIT</p><h1 id="hr-title">NFTree Rewards<span className="hr-title-dot">.</span></h1><p>Good things grow here. Collect rewards for the NFTrees you hold, all in one place.</p><div className="hr-intro-meta"><span className="hr-network"><span /> Sui Mainnet</span><span>Powered by TreeDrop</span></div></div>
        <div className="hr-art" aria-hidden="true"><img src="/assets/profile-nftree-art.jpg" alt="" /><span className="hr-art-shade" /><span className="hr-art-caption">GROW TOGETHER.<br /><strong>SHARE THE REWARDS.</strong></span></div>
      </section>

      <section className="hr-reward-card" aria-labelledby="hr-reward-title" aria-busy={checking || busy}>
        <div className="hr-card-top"><div><p className="hr-eyebrow">YOUR REWARDS</p><h2 id="hr-reward-title">{address ? "One wallet. Every eligible NFTree." : "A few clicks. More to grow."}</h2></div><span className={`hr-status-pill ${checkError || publicStatus === "error" ? "hr-status-warning" : ""}`}><span />{address && checking ? "Checking" : checkError ? "Check unavailable" : checkedView ? `${checkedView.nftrees.length} NFTree${checkedView.nftrees.length === 1 ? "" : "s"} found` : publicStatus === "loading" ? "Checking drops" : publicStatus === "error" ? "Drop check unavailable" : publicStatus === "ready" ? "Reward drops open" : "Waiting for the next drop"}</span></div>
        <div className={`hr-card-content ${amounts.length ? "hr-has-rewards" : ""}`}>
          <div className="hr-state-copy"><span className={`hr-state-symbol ${checking ? "hr-is-checking" : ""}`}><Leaf large /></span><h3>{stateTitle}</h3><p>{stateDescription}</p>
            {!address ? <div className="hr-mini-steps"><span><b>1</b> Connect</span><i aria-hidden="true">→</i><span><b>2</b> Auto check</span><i aria-hidden="true">→</i><span><b>3</b> Collect</span></div> : null}
          </div>
          {amounts.length ? <div className="hr-amounts" aria-label="Your available rewards">{amounts.map((amount) => <div className="hr-token-row" key={amount.symbol}><span className={`hr-token-icon hr-token-${amount.symbol.toLowerCase()}`} aria-hidden="true">{amount.symbol.slice(0, 2)}</span><div className="hr-token-name"><strong>{amount.symbol}</strong><small>{amount.count} eligible NFTree{amount.count === 1 ? "" : "s"}</small></div><strong className="hr-token-amount">{atomicAmount(amount.amount, amount.decimals)}</strong></div>)}</div> : null}
        </div>
        <div className="hr-card-actions">
          {!address ? <button className="hr-primary" onClick={() => modal.current?.showModal()} disabled={opening}>{opening ? "Connecting…" : "Connect Wallet"}<span aria-hidden="true">↗</span></button> : isAdmin ? <a className="hr-primary" href="/rewards/?manage=1">Manage Rewards<span aria-hidden="true">→</span></a> : canClaim || busy ? <button className="hr-primary" onClick={() => void claimAll()} disabled={!canClaim}>{busy ? progress || "Claim in progress…" : "Claim All Rewards"}{!busy ? <span aria-hidden="true">↗</span> : null}</button> : !mainnet || checkError ? <button className="hr-primary" onClick={retry} disabled={checking || busy}>{checking ? "Checking…" : "Try Again"}<span aria-hidden="true">↻</span></button> : checkedView && !checkedView.nftrees.length ? <a className="hr-primary" href={CONFIG.nftreeMintUrl}>Get an NFTree<span aria-hidden="true">↗</span></a> : <button className="hr-primary hr-muted-action" onClick={retry} disabled={checking}>{checking ? "Checking rewards…" : "Check for New Rewards"}<span aria-hidden="true">↻</span></button>}
          <p className="hr-action-note">{busy ? "Follow the labeled approvals in your wallet. Each confirmed reward is recorded before the next request." : canClaim ? `${approvalCount} wallet approval${approvalCount === 1 ? "" : "s"}. ${amounts.some((amount) => amount.symbol === "SUI") && amounts.length > 1 ? "SUI and community rewards are approved separately. " : ""}A small SUI network fee applies.` : "NFTree ownership is checked automatically. No extra sign-up."}</p>
          {address && !isAdmin && !checking && !busy && canClaim ? <button className="hr-text-button" onClick={retry}>Refresh rewards</button> : null}
        </div>
        {notice ? <div className={`hr-notice hr-notice-${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}><strong>{notice.title}</strong><p>{notice.detail}</p></div> : null}
        {checkedView && !checking ? <div className="hr-checked">Wallet {shortId(address)} <span>·</span> Checked {new Date(checkedView.checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div> : null}
      </section>

      <div className="hr-details-grid">
        <details className="hr-details"><summary><span><span className="hr-summary-icon" aria-hidden="true">↺</span>Reward history</span><span className="hr-plus" aria-hidden="true">+</span></summary><div className="hr-details-body">
          {!address ? <p>Connect your wallet to view confirmed claims for your NFTrees.</p> : checking ? <p>Checking current drop activity…</p> : checkError ? <p>Your history could not be checked. Refresh your rewards to try again.</p> : isAdmin ? <p>Open Manage Rewards to review distributions from the project wallet.</p> : !checkedView?.assets.length ? <p>No current reward round was found for this wallet.</p> : <><p>Confirmed claims for the NFTrees currently in your wallet. Earlier rounds are not shown here.</p>{checkedView.assets.filter((asset) => asset.claimed.size > 0 || checkedView.nftrees.some((nftree) => confirmedForWallet.has(claimKey(asset, nftree.objectId)))).map((asset) => {
            const count = checkedView.nftrees.filter((nftree) => asset.claimed.has(nftree.objectId.toLowerCase()) || confirmedForWallet.has(claimKey(asset, nftree.objectId))).length;
            return <div className="hr-history-row" key={asset.id}><span><strong>{asset.symbol}</strong><small>Current round {asset.round.toString()} · {count} NFTree{count === 1 ? "" : "s"}</small></span><strong>{atomicAmount(asset.amount * BigInt(count), asset.decimals)} {asset.symbol}<small>Claimed</small></strong></div>;
          })}{!checkedView.assets.some((asset) => asset.claimed.size || checkedView.nftrees.some((nftree) => confirmedForWallet.has(claimKey(asset, nftree.objectId)))) ? <p>No confirmed claims were found for these current rounds.</p> : null}</>}
          {receiptList.length ? <div className="hr-receipts"><h4>Receipts from this visit</h4>{receiptList.map((receipt) => <a href={`https://suiscan.xyz/mainnet/tx/${receipt.digest}`} target="_blank" rel="noopener noreferrer" key={receipt.digest}><span>{receipt.amounts.map((amount) => `${atomicAmount(amount.amount, amount.decimals)} ${amount.symbol}`).join(" + ")}</span><small>View transaction ↗</small></a>)}</div> : null}
        </div></details>
        <details className="hr-details"><summary><span><span className="hr-summary-icon" aria-hidden="true">?</span>How rewards work</span><span className="hr-plus" aria-hidden="true">+</span></summary><div className="hr-details-body"><ol className="hr-explainer"><li><strong>Hold an NFTree.</strong><p>Your NFTree is your pass to eligible TREE community rewards.</p></li><li><strong>Connect your wallet.</strong><p>We find your NFTrees and combine their available rewards automatically.</p></li><li><strong>Claim your rewards.</strong><p>Review the request in your wallet. Each NFTree can claim each eligible reward once per round.</p></li></ol><p>Some campaigns use a holder snapshot. Buying or transferring an NFTree does not guarantee eligibility for an existing drop.</p><a className="hr-inline-link" href="https://nftree.net/">Explore NFTrees ↗</a></div></details>
      </div>

      <div className="hr-community-line"><Leaf /><p>Want to put something good in the canopy? <a href="/rewards/?sponsor=1">Sponsor rewards <span aria-hidden="true">↗</span></a></p>{isAdmin ? <a href="/rewards/?manage=1">Manage Rewards →</a> : null}</div>
    </main>
    <footer className="hr-footer"><span>TREE ECOSYSTEM</span><p>Rooted in community. Built on Sui.</p><a href="/play/">Visit the Arcade ↗</a></footer>

    <dialog className="hr-wallet-dialog" ref={modal} onClick={(event) => { if (event.target === event.currentTarget && !opening) modal.current?.close(); }} aria-labelledby="hr-wallet-title"><div className="hr-dialog-top"><div><p className="hr-eyebrow">YOUR SUI WALLET</p><h2 id="hr-wallet-title">{address ? "Manage wallet" : "Connect to collect"}</h2></div><button className="hr-dialog-close" onClick={() => modal.current?.close()} aria-label="Close wallet selector" disabled={opening}>×</button></div><p>Choose the wallet that holds your NFTrees.</p><div className="hr-wallet-list">{wallets.map((available) => <button key={available.name} onClick={() => void connect(available)} disabled={opening || busy}>{available.icon ? <img src={available.icon} alt="" /> : <Leaf />}<span>{available.name}</span><span aria-hidden="true">↗</span></button>)}</div>{!wallets.length ? <div className="hr-wallet-empty"><p>No compatible Sui wallet was found in this browser.</p><a href="https://slush.app/" target="_blank" rel="noopener noreferrer">Get Slush Wallet ↗</a><p>On mobile, open this page inside your wallet’s browser.</p></div> : null}{wallet ? <button className="hr-disconnect" onClick={() => void dAppKit.disconnectWallet().then(() => modal.current?.close())} disabled={opening || busy}>Disconnect {wallet.name} · {shortId(address)}</button> : null}{notice?.tone === "error" && !address ? <p className="hr-dialog-error" role="alert">{notice.detail}</p> : null}</dialog>
  </div>;
}
