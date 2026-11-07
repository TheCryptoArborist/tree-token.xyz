import { useEffect, useMemo, useRef, useState } from "react";
import { useCurrentAccount, useCurrentNetwork, useDAppKit, useWalletConnection, useWallets } from "@mysten/dapp-kit-react";
import { coinWithBalance, Transaction } from "@mysten/sui/transactions";
import { fromBase64, normalizeStructTag, normalizeSuiAddress } from "@mysten/sui/utils";
import { CONFIG } from "./config";
import { fetchHolderSnapshot, hashHolderSnapshotManifest, HolderSnapshot, holderSnapshotPayoutBlockers } from "./holderSnapshot";
import { REGISTERED_REWARD_TOKENS, RegisteredRewardToken } from "./rewardTokens";
import { shortId } from "./format";
import "./manage.css";

const STORAGE_KEY = "tree.nftree.distributions.v1";
const BATCH_SIZE = 40;
const U64_MAX = 18_446_744_073_709_551_615n;
const ADDRESS = /^0x[0-9a-f]{64}$/;
type Recipient = { address: string; nftreeIds: string[]; amount: string };
type PaymentBatch = { index: number; status: "ready" | "signed" | "confirmed" | "failed"; digest?: string; previousDigests?: string[]; error?: string };
export type DistributionManifest = {
  version: 1; id: string; createdAt: string; title: string; sender: string; network: "mainnet";
  tokenId: string; coinType: string; symbol: string; decimals: number;
  budget: string; perNFTree: string; allocated: string; remainder: string;
  snapshot: HolderSnapshot; snapshotHash: string; recipients: Recipient[]; batches: PaymentBatch[];
};

export function parseRewardBudget(value: string, decimals: number) {
  const text = value.trim();
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18 || !/^\d+(\.\d+)?$/.test(text)) throw new Error("Enter a positive amount using numbers and a decimal point.");
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > decimals) throw new Error(`This token supports up to ${decimals} decimal places.`);
  const amount = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
  if (amount <= 0n || amount > U64_MAX) throw new Error("Enter a positive amount within the token transfer limit.");
  return amount;
}
export function formatRewardAmount(value: string | bigint, decimals: number) {
  const amount = BigInt(value); const scale = 10n ** BigInt(decimals);
  const fraction = (amount % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${(amount / scale).toLocaleString("en-US")}${fraction ? `.${fraction}` : ""}`;
}
export function allocateHolderRewards(snapshot: HolderSnapshot, budget: bigint): Recipient[] {
  const blockers = holderSnapshotPayoutBlockers(snapshot);
  if (blockers.length) throw new Error(blockers.join(" "));
  if (snapshot.nftreeType !== CONFIG.nftreeType) throw new Error("The snapshot is for a different NFT collection.");
  if (snapshot.source !== "indexer-graphql" || snapshot.complete !== true || !snapshot.checkpoint || !snapshot.manifestHash) throw new Error("Generate a complete, checkpoint-verified holder snapshot before preparing this distribution.");
  if (snapshot.unresolvedNFTrees || snapshot.unresolved.length) throw new Error("Resolve every NFTree owner before preparing this distribution.");
  const groups = new Map<string, string[]>(); const seen = new Set<string>();
  for (const nftree of snapshot.nftrees) {
    const id = nftree.nftreeObjectId.toLowerCase(); const owner = nftree.ownerAddress?.toLowerCase();
    if (!ADDRESS.test(id) || !owner || !ADDRESS.test(owner) || seen.has(id)) throw new Error("The snapshot contains an invalid or duplicate NFTree record.");
    seen.add(id);
    if (owner === CONFIG.adminAddress.toLowerCase()) throw new Error("Project wallet NFTrees must be excluded from the snapshot.");
    groups.set(owner, [...(groups.get(owner) || []), id]);
  }
  if (!seen.size || seen.size !== snapshot.eligibleNFTrees) throw new Error("The snapshot has no eligible NFTrees or its counts do not match.");
  const perNFTree = budget / BigInt(seen.size);
  if (perNFTree <= 0n) throw new Error("Increase the budget so every eligible NFTree receives at least one token unit.");
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([address, nftreeIds]) => ({ address, nftreeIds: nftreeIds.sort(), amount: (perNFTree * BigInt(nftreeIds.length)).toString() }));
}
function tokenForManifest(manifest: DistributionManifest) {
  const token = REGISTERED_REWARD_TOKENS.find(item => item.tokenId === manifest.tokenId);
  if (!token || token.coinType !== manifest.coinType || token.decimals !== manifest.decimals || token.symbol !== manifest.symbol) throw new Error("Distribution token configuration does not match the current registry.");
  return token;
}
export function validateDistributionManifest(manifest: DistributionManifest) {
  if (!manifest || manifest.version !== 1 || manifest.network !== "mainnet" || manifest.sender !== CONFIG.adminAddress.toLowerCase() || typeof manifest.id !== "string" || !manifest.id || !manifest.snapshot) throw new Error("This is not a valid NFTree distribution manifest.");
  tokenForManifest(manifest);
  const budget = BigInt(manifest.budget);
  if (budget <= 0n || budget > U64_MAX) throw new Error("Invalid distribution budget.");
  const expected = allocateHolderRewards(manifest.snapshot, budget);
  if (JSON.stringify(expected) !== JSON.stringify(manifest.recipients)) throw new Error("Recipient addresses or amounts do not match the holder snapshot.");
  const allocated = expected.reduce((sum, item) => sum + BigInt(item.amount), 0n);
  if (manifest.allocated !== allocated.toString() || manifest.remainder !== (budget - allocated).toString() || manifest.perNFTree !== (budget / BigInt(manifest.snapshot.eligibleNFTrees)).toString()) throw new Error("Distribution totals do not match.");
  if (!Array.isArray(manifest.batches) || manifest.batches.length !== Math.ceil(expected.length / BATCH_SIZE)) throw new Error("Invalid distribution batch count.");
  for (const [index, batch] of manifest.batches.entries()) {
    if (batch.index !== index || !["ready", "signed", "confirmed", "failed"].includes(batch.status) || (["signed", "confirmed", "failed"].includes(batch.status) && (!batch.digest || !/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(batch.digest))) || (batch.status === "ready" && batch.digest)) throw new Error("Invalid saved batch receipt.");
  }
  return manifest;
}
async function snapshotDigest(snapshot: HolderSnapshot) {
  const body = JSON.stringify({ type: snapshot.nftreeType, time: snapshot.snapshotTime, checkpoint: (snapshot as HolderSnapshot & { checkpoint?: string }).checkpoint, nftrees: snapshot.nftrees.map(item => ({ id: item.nftreeObjectId.toLowerCase(), owner: item.ownerAddress?.toLowerCase() })).sort((a, b) => a.id.localeCompare(b.id)) });
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, "0")).join("");
}
function loadSaved(): DistributionManifest[] {
  try { const values = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); return Array.isArray(values) ? values.filter(value => { try { validateDistributionManifest(value); return true; } catch { return false; } }) : []; } catch { return []; }
}
export function preventStalePaymentOverwrite(existing: DistributionManifest, next: DistributionManifest) {
  const immutable = (value: DistributionManifest) => JSON.stringify({ id: value.id, sender: value.sender, tokenId: value.tokenId, coinType: value.coinType, budget: value.budget, allocated: value.allocated, perNFTree: value.perNFTree, remainder: value.remainder, snapshotHash: value.snapshotHash, recipients: value.recipients });
  if (immutable(existing) !== immutable(next)) throw new Error("A saved distribution cannot change its recipients, token or amounts.");
  existing.batches.forEach((before, index) => {
    const after = next.batches[index];
    if (!after || (before.status === "confirmed" && (after.status !== "confirmed" || after.digest !== before.digest)) ||
      (before.status === "signed" && (after.status === "ready" || after.digest !== before.digest)) ||
      (before.status === "failed" && after.status === "ready")) throw new Error("A newer payment receipt exists in this browser. Reload the saved distribution before continuing.");
  });
}
function saveManifest(manifest: DistributionManifest) {
  validateDistributionManifest(manifest);
  const saved = loadSaved();
  const existing = saved.find(item => item.id === manifest.id);
  if (existing) preventStalePaymentOverwrite(existing, manifest);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([manifest, ...saved.filter(item => item.id !== manifest.id)]));
  const check = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as DistributionManifest[];
  if (!check.some(item => item.id === manifest.id && JSON.stringify(item) === JSON.stringify(manifest))) throw new Error("The distribution record could not be saved. Export a backup and allow browser storage before continuing.");
}
function downloadManifest(manifest: DistributionManifest) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = `NFTree-Rewards-${manifest.id}.json`; link.click(); URL.revokeObjectURL(url);
}
function resultState(value: unknown): { success: boolean; digest?: string; error: string } {
  if (!value || typeof value !== "object") return { success: false, error: "Transaction result unavailable." };
  const outer = value as Record<string, unknown>; const raw = (outer.Transaction || outer.FailedTransaction) as Record<string, unknown> | undefined;
  const status = raw?.status as { success?: boolean; error?: { message?: string } | string } | undefined;
  const error = typeof status?.error === "string" ? status.error : status?.error?.message;
  return { success: Boolean(outer.Transaction && status?.success), digest: typeof raw?.digest === "string" ? raw.digest : undefined, error: error || "Transaction did not succeed." };
}
export function validatePaymentReceipt(value: unknown, manifest: DistributionManifest, index: number, expectedDigest?: string) {
  const state = resultState(value);
  const outer = value as Record<string, unknown> | undefined;
  const raw = (outer?.Transaction || outer?.FailedTransaction) as { transaction?: { sender?: string }; balanceChanges?: Array<{ coinType: string; address: string; amount: string }> } | undefined;
  if (!raw?.transaction?.sender || normalizeSuiAddress(raw.transaction.sender) !== manifest.sender) throw new Error("The payment receipt has a different or unavailable sender.");
  if (expectedDigest && state.digest !== expectedDigest) throw new Error("The payment receipt digest does not match the saved transaction.");
  if (state.success) {
    if (!Array.isArray(raw.balanceChanges)) throw new Error("Recipient balance changes are unavailable; the payment cannot be confirmed.");
    const expected = new Map(manifest.recipients.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE).map(item => [item.address, BigInt(item.amount)]));
    const credited = new Map<string, bigint>();
    for (const change of raw.balanceChanges) {
      if (normalizeStructTag(change.coinType) !== normalizeStructTag(manifest.coinType)) continue;
      const address = normalizeSuiAddress(change.address); const amount = BigInt(change.amount);
      if (address === manifest.sender || amount <= 0n) continue;
      if (!expected.has(address)) throw new Error("The payment receipt credits an unexpected recipient.");
      credited.set(address, (credited.get(address) || 0n) + amount);
    }
    for (const [address, amount] of expected) if (credited.get(address) !== amount) throw new Error("The payment receipt does not match every expected holder reward.");
  }
  return state;
}
export async function withDistributionLock<T>(id: string, action: () => Promise<T>): Promise<T> {
  if (!navigator.locks?.request) throw new Error("This browser cannot protect concurrent payment sessions. Use a current browser with Web Locks support.");
  return navigator.locks.request(`tree-nftree-distribution:${id}`, { mode: "exclusive", ifAvailable: true }, async lock => {
    if (!lock) throw new Error("This distribution is active in another tab. Finish that payment before continuing here.");
    return action();
  });
}
function errorMessage(error: unknown) { return error instanceof Error ? error.message : "This action could not finish. Try again."; }

export function ManageApp() {
  const account = useCurrentAccount(); const wallets = useWallets(); const connection = useWalletConnection(); const network = useCurrentNetwork(); const dAppKit = useDAppKit();
  const accountRef = useRef(account?.address.toLowerCase()); accountRef.current = account?.address.toLowerCase();
  const networkRef = useRef(network); networkRef.current = network;
  const [walletOpen, setWalletOpen] = useState(false); const [tokenId, setTokenId] = useState("tree"); const [budgetText, setBudgetText] = useState(""); const [title, setTitle] = useState("NFTree holder rewards");
  const [snapshot, setSnapshot] = useState<HolderSnapshot | null>(null); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  const [manifest, setManifest] = useState<DistributionManifest | null>(null); const [saved, setSaved] = useState<DistributionManifest[]>(loadSaved);
  const [prepared, setPrepared] = useState<{ manifestId: string; index: number; transaction: Transaction; total: bigint } | null>(null);
  const [reviewed, setReviewed] = useState(false); const fileRef = useRef<HTMLInputElement>(null);
  const token = REGISTERED_REWARD_TOKENS.find(item => item.tokenId === tokenId)!;
  const authorized = account?.address.toLowerCase() === CONFIG.adminAddress.toLowerCase();
  const onMainnet = network === CONFIG.network;
  const preview = useMemo(() => { try { return snapshot && budgetText ? allocateHolderRewards(snapshot, parseRewardBudget(budgetText, token.decimals)) : []; } catch { return []; } }, [snapshot, budgetText, token]);
  const complete = Boolean(manifest && manifest.batches.every(batch => batch.status === "confirmed"));
  const pending = manifest?.batches.find(batch => batch.status === "signed");
  const nextBatch = manifest?.batches.find(batch => batch.status === "ready" || batch.status === "failed");
  useEffect(() => { setPrepared(null); setReviewed(false); setWalletOpen(false); }, [account?.address, network]);
  function store(next: DistributionManifest) { saveManifest(next); setManifest(next); setSaved(loadSaved()); }
  function updateBatch(current: DistributionManifest, index: number, change: Partial<PaymentBatch>) { const next = { ...current, batches: current.batches.map(batch => batch.index === index ? { ...batch, ...change } : batch) }; store(next); return next; }
  function ensureOwner(sender = CONFIG.adminAddress.toLowerCase()) { if (accountRef.current !== sender || networkRef.current !== CONFIG.network) throw new Error("Connect the project wallet on Sui Mainnet before continuing."); }
  async function generateSnapshot() {
    setBusy(true); setError(""); setNotice("Checking NFTree holders…"); setSnapshot(null); setPrepared(null);
    try { const value = await fetchHolderSnapshot({ excludedWallets: [CONFIG.adminAddress] }); setSnapshot(value); setNotice(value.unresolvedNFTrees ? "Some owners need review. Distribution is paused until every owner is resolved." : "Holder list ready. Project wallet NFTrees are excluded."); }
    catch (cause) { setError(errorMessage(cause)); setNotice(""); } finally { setBusy(false); }
  }
  async function createManifest() {
    setBusy(true); setError(""); setNotice("");
    try {
      ensureOwner(); if (!snapshot) throw new Error("Generate a holder snapshot first.");
      if (Date.now() - Date.parse(snapshot.snapshotTime) > 15 * 60_000) throw new Error("Refresh the holder snapshot before preparing a new distribution.");
      if (await hashHolderSnapshotManifest(snapshot) !== snapshot.manifestHash) throw new Error("The holder snapshot fingerprint does not match its inventory.");
      const budget = parseRewardBudget(budgetText, token.decimals); const recipients = allocateHolderRewards(snapshot, budget); const hash = await snapshotDigest(snapshot);
      const duplicate = saved.find(item => item.snapshotHash === hash && item.coinType === token.coinType && item.budget === budget.toString());
      if (duplicate) { setManifest(duplicate); setNotice("Loaded the existing distribution for this snapshot and budget."); return; }
      const allocated = recipients.reduce((sum, item) => sum + BigInt(item.amount), 0n);
      const next: DistributionManifest = { version: 1, id: crypto.randomUUID(), createdAt: new Date().toISOString(), title: title.trim() || "NFTree holder rewards", sender: CONFIG.adminAddress.toLowerCase(), network: "mainnet", tokenId: token.tokenId, coinType: token.coinType, symbol: token.symbol, decimals: token.decimals, budget: budget.toString(), perNFTree: (budget / BigInt(snapshot.eligibleNFTrees)).toString(), allocated: allocated.toString(), remainder: (budget - allocated).toString(), snapshot, snapshotHash: hash, recipients, batches: Array.from({ length: Math.ceil(recipients.length / BATCH_SIZE) }, (_, index) => ({ index, status: "ready" })) };
      store(next); setReviewed(false); setPrepared(null); setNotice("Review the distribution below. Nothing has been sent.");
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  async function reconcile() {
    if (!manifest) return; setBusy(true); setError(""); setPrepared(null);
    try {
      ensureOwner(manifest.sender); validateDistributionManifest(manifest);
      let current = manifest;
      for (const batch of current.batches.filter(item => item.digest)) {
        const result = await dAppKit.getClient("mainnet").getTransaction({ digest: batch.digest!, include: { effects: true, balanceChanges: true, transaction: true } });
        const state = validatePaymentReceipt(result, current, batch.index, batch.digest);
        current = updateBatch(current, batch.index, { status: state.success ? "confirmed" : "failed", error: state.success ? undefined : state.error });
      }
      setNotice("Saved payment receipts checked. Confirmed batches will not be sent again.");
    } catch (cause) { setError(`Payment status could not be confirmed. No replacement payment is allowed while this transaction is unresolved. ${errorMessage(cause)}`); } finally { setBusy(false); }
  }
  async function prepareBatch() {
    if (!manifest || !nextBatch || pending) return; setBusy(true); setError(""); setPrepared(null);
    try {
      ensureOwner(manifest.sender); validateDistributionManifest(manifest);
      if (!reviewed) throw new Error("Review and confirm the allocation before preparing a payment.");
      if (await hashHolderSnapshotManifest(manifest.snapshot) !== manifest.snapshot.manifestHash) throw new Error("The holder snapshot evidence does not match its inventory.");
      if (await snapshotDigest(manifest.snapshot) !== manifest.snapshotHash) throw new Error("The saved snapshot does not match its recorded fingerprint.");
      const client = dAppKit.getClient("mainnet");
      // Saved browser status is advisory. A replacement for a failed payment requires a fresh failed on-chain receipt.
      if (nextBatch.digest) {
        const receipt = validatePaymentReceipt(await client.getTransaction({ digest: nextBatch.digest, include: { effects: true, transaction: true, balanceChanges: true } }), manifest, nextBatch.index, nextBatch.digest);
        if (receipt.digest !== nextBatch.digest) throw new Error("The previous payment receipt is unavailable. A replacement is blocked.");
        if (receipt.success) { updateBatch(manifest, nextBatch.index, { status: "confirmed", error: undefined }); setNotice("This batch already succeeded. Its receipt is now confirmed and no replacement was prepared."); return; }
      }
      const recipients = manifest.recipients.slice(nextBatch.index * BATCH_SIZE, (nextBatch.index + 1) * BATCH_SIZE); const total = recipients.reduce((sum, item) => sum + BigInt(item.amount), 0n);
      const [balance, gasBalance] = await Promise.all([client.getBalance({ owner: manifest.sender, coinType: manifest.coinType }), client.getBalance({ owner: manifest.sender, coinType: "0x2::sui::SUI" })]);
      if (BigInt(balance.balance.balance) < total) throw new Error(`The connected wallet does not have enough ${manifest.symbol} for this batch.`);
      const gasReserve = 100_000_000n;
      if (BigInt(gasBalance.balance.balance) < gasReserve + (manifest.tokenId === "sui" ? total : 0n)) throw new Error("Keep at least 0.1 SUI available for this batch's gas budget in addition to any SUI reward amount.");
      const transaction = new Transaction(); transaction.setSender(manifest.sender); transaction.setGasBudget(Number(gasReserve));
      const source = transaction.add(coinWithBalance({ type: manifest.coinType, balance: total }));
      const payments = transaction.splitCoins(source, recipients.map(item => transaction.pure.u64(BigInt(item.amount))));
      recipients.forEach((item, index) => transaction.transferObjects([payments[index]], item.address));
      const simulation = await client.simulateTransaction({ transaction, include: { effects: true, balanceChanges: true, transaction: true } });
      const state = validatePaymentReceipt(simulation, manifest, nextBatch.index); if (!state.success) throw new Error(`Payment simulation failed: ${state.error}`);
      ensureOwner(manifest.sender); setPrepared({ manifestId: manifest.id, index: nextBatch.index, transaction, total }); setNotice(`Batch ${nextBatch.index + 1} passed simulation. Review it in your wallet when you approve.`);
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  async function approveBatch() {
    if (!manifest || !prepared || prepared.manifestId !== manifest.id || pending) return;
    setBusy(true); setError(""); let signedDigest: string | undefined;
    try {
      await withDistributionLock(manifest.id, async () => {
        ensureOwner(manifest.sender);
        let current = loadSaved().find(item => item.id === manifest.id);
        if (!current) throw new Error("The saved distribution record is unavailable. Import its backup before continuing.");
        validateDistributionManifest(current); preventStalePaymentOverwrite(current, manifest);
        const latestBatch = current.batches[prepared.index];
        if (!latestBatch || latestBatch.status === "signed" || latestBatch.status === "confirmed" || latestBatch.status !== manifest.batches[prepared.index].status || latestBatch.digest !== manifest.batches[prepared.index].digest) { setManifest(current); throw new Error("This batch changed in another session. Reload its current receipt before continuing."); }
        if (latestBatch.digest) {
          const receipt = validatePaymentReceipt(await dAppKit.getClient("mainnet").getTransaction({ digest: latestBatch.digest, include: { effects: true, balanceChanges: true, transaction: true } }), current, prepared.index, latestBatch.digest);
          if (receipt.success) { updateBatch(current, prepared.index, { status: "confirmed", error: undefined }); throw new Error("This batch already succeeded. No replacement payment was submitted."); }
        }
        saveManifest(current); ensureOwner(current.sender);
        const signed = await dAppKit.signTransaction({ transaction: prepared.transaction, network: "mainnet" });
        signedDigest = await Transaction.from(signed.bytes).getDigest();
        current = updateBatch(current, prepared.index, { status: "signed", digest: signedDigest, previousDigests: [...(latestBatch.previousDigests || []), ...(latestBatch.digest ? [latestBatch.digest] : [])], error: undefined });
        // Persist the digest before execution. Unknown status blocks replacement payments.
        ensureOwner(current.sender);
        const result = await dAppKit.getClient("mainnet").executeTransaction({ transaction: fromBase64(signed.bytes), signatures: [signed.signature], include: { effects: true, balanceChanges: true, transaction: true } });
        const state = validatePaymentReceipt(result, current, prepared.index, signedDigest);
        if (!state.success) { updateBatch(current, prepared.index, { status: "failed", error: state.error }); throw new Error(`Payment failed on chain: ${state.error}`); }
        updateBatch(current, prepared.index, { status: "confirmed", error: undefined });
        setNotice(`Batch ${prepared.index + 1} confirmed. Rewards were delivered directly to the recipient wallets.`);
      });
    } catch (cause) { setError(`${signedDigest ? "The signed batch is recorded. Check its receipt before continuing. " : ""}${errorMessage(cause)}`); }
    finally { setPrepared(null); setBusy(false); }
  }
  async function importManifest(file: File | undefined) {
    if (!file) return; setBusy(true); setError("");
    try {
      if (file.size > 10_000_000) throw new Error("This manifest is too large.");
      const value = validateDistributionManifest(JSON.parse(await file.text()) as DistributionManifest);
      if (await hashHolderSnapshotManifest(value.snapshot) !== value.snapshot.manifestHash) throw new Error("The imported holder snapshot evidence does not match its inventory.");
      if (await snapshotDigest(value.snapshot) !== value.snapshotHash) throw new Error("The imported snapshot fingerprint does not match.");
      for (const batch of value.batches.filter(item => item.digest)) {
        const state = validatePaymentReceipt(await dAppKit.getClient("mainnet").getTransaction({ digest: batch.digest!, include: { effects: true, balanceChanges: true, transaction: true } }), value, batch.index, batch.digest);
        batch.status = state.success ? "confirmed" : "failed";
        batch.error = state.success ? undefined : state.error;
      }
      store(value); setPrepared(null); setReviewed(false); setNotice("Distribution restored. Check any pending receipt before continuing.");
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  const activeStep = !manifest ? snapshot ? 3 : 1 : complete ? 5 : prepared || pending ? 5 : 4;
  const showAmount = (value: string | bigint, decimals = manifest?.decimals ?? token.decimals) => formatRewardAmount(value, decimals);
  return <div className="reward-manager">
    <header className="rm-header"><a className="rm-brand" href="/">TREE<span>NFTree Rewards</span></a><nav aria-label="Rewards navigation"><a href="/">Home</a><a href="/dapp/">App</a><a href="/play/">Arcade</a><a href="/rewards/">My rewards</a></nav><div className="rm-wallet"><button onClick={() => setWalletOpen(!walletOpen)} disabled={busy || connection.isConnecting}>{account ? shortId(account.address) : "Connect Wallet"}</button>{walletOpen && <div className="rm-wallet-menu">{wallets.map(wallet => <button key={wallet.name} onClick={() => { setError(""); void dAppKit.connectWallet({ wallet }).then(() => setWalletOpen(false)).catch(cause => setError(errorMessage(cause))); }}>{wallet.name}</button>)}{account && <button onClick={() => { void dAppKit.disconnectWallet(); setWalletOpen(false); }}>Disconnect</button>}{!wallets.length && <p>Open this page in a Sui wallet browser or install a supported wallet.</p>}</div>}</div></header>
    <main className="rm-main"><div className="rm-intro"><a href="/rewards/" className="rm-back">← Holder rewards</a><span className="rm-eyebrow">PROJECT WALLET · SUI MAINNET</span><h1>Reward your holders.</h1><p>Choose a budget. Review the holder list. Deliver rewards directly to their wallets.</p></div>
      <ol className="rm-steps" aria-label="Distribution progress">{["Choose reward", "Find holders", "Review shares", "Prepare payment", "Deliver & track"].map((label, index) => <li key={label} className={activeStep === index + 1 ? "is-current" : activeStep > index + 1 ? "is-done" : ""} aria-current={activeStep === index + 1 ? "step" : undefined}><span>{index + 1}</span>{label}</li>)}</ol>
      {!authorized ? <section className="rm-card rm-connect"><span className="rm-leaf" aria-hidden="true">↗</span><h2>{account ? "Project wallet required" : "Connect the project wallet"}</h2><p>Distribution tools are available to the authorized project wallet. Holder rewards are available on the rewards page.</p><button className="rm-primary" onClick={() => setWalletOpen(true)} disabled={connection.isConnecting}>Choose wallet</button><a href="/rewards/">View holder rewards</a></section> : <>
        {!onMainnet && <p className="rm-error" role="alert">Select Sui Mainnet in your wallet to manage rewards.</p>}
        <div className="rm-workspace"><section className="rm-card"><div className="rm-card-heading"><span className="rm-number">1</span><div><h2>Choose the reward</h2><p>Equal shares per NFTree. One combined payment per wallet.</p></div></div>
          <div className="rm-form"><label>Distribution name<input value={manifest?.title ?? title} disabled={busy || Boolean(manifest)} onChange={event => setTitle(event.target.value)} maxLength={100} /></label><label>Reward token<select value={manifest?.tokenId ?? tokenId} disabled={busy || Boolean(manifest)} onChange={event => { setTokenId(event.target.value); setReviewed(false); }}>{REGISTERED_REWARD_TOKENS.filter(item => item.isActive).map(item => <option value={item.tokenId} key={item.tokenId}>{item.symbol} — {item.name}</option>)}</select></label><label>Total reward budget<input inputMode="decimal" placeholder="Enter total amount" value={manifest ? showAmount(manifest.budget).replaceAll(",", "") : budgetText} disabled={busy || Boolean(manifest)} onChange={event => { setBudgetText(event.target.value); setReviewed(false); }} /><small>Rewards are paid from your connected wallet. Gas is additional.</small></label></div>
          {!manifest && <><div className="rm-divider" /><div className="rm-card-heading"><span className="rm-number">2</span><div><h2>Find NFTree holders</h2><p>Generate the holder list automatically. Project wallet NFTrees are excluded.</p></div></div><button className="rm-secondary" onClick={() => void generateSnapshot()} disabled={busy || !onMainnet}>{busy ? "Working…" : snapshot ? "Refresh holder list" : "Generate holder list"}</button>{snapshot && <div className="rm-snapshot"><div><strong>{snapshot.eligibleNFTrees}</strong><span>eligible NFTrees</span></div><div><strong>{snapshot.eligibleHolderWallets}</strong><span>holder wallets</span></div><div><strong>{snapshot.excludedProjectWalletNFTrees}</strong><span>project NFTrees excluded</span></div><div><strong>{snapshot.unresolvedNFTrees}</strong><span>owners need review</span></div></div>}{snapshot && <p className="rm-muted">Snapshot: {new Date(snapshot.snapshotTime).toLocaleString()}{"checkpoint" in snapshot ? ` · Checkpoint ${String(snapshot.checkpoint)}` : ""}</p>}{snapshot?.unresolvedNFTrees ? <p className="rm-error">Every owner must be resolved before sending. Review the snapshot in Advanced tools.</p> : null}{snapshot?.warning && <details className="rm-detail"><summary>Snapshot details</summary><p>{snapshot.warning}</p></details>}</>}
        </section><section className="rm-card rm-review"><div className="rm-card-heading"><span className="rm-number">3</span><div><h2>{manifest ? "Distribution review" : "Review the shares"}</h2><p>{manifest ? manifest.title : "Your budget is divided by the eligible NFTree count."}</p></div></div>
          {manifest ? <><div className="rm-highlight"><span>Total to deliver</span><strong>{showAmount(manifest.allocated)} <small>{manifest.symbol}</small></strong></div><dl className="rm-totals"><div><dt>Per NFTree</dt><dd>{showAmount(manifest.perNFTree)} {manifest.symbol}</dd></div><div><dt>Holder wallets</dt><dd>{manifest.recipients.length}</dd></div><div><dt>Eligible NFTrees</dt><dd>{manifest.snapshot.eligibleNFTrees}</dd></div><div><dt>Rounding remainder</dt><dd>{showAmount(manifest.remainder)} {manifest.symbol}</dd></div><div><dt>Payment batches</dt><dd>{manifest.batches.filter(batch => batch.status === "confirmed").length} / {manifest.batches.length} confirmed</dd></div></dl><p className="rm-muted">Remainder stays in your wallet. Each batch has up to {BATCH_SIZE} recipient wallets.</p></> : preview.length && snapshot ? <><div className="rm-highlight"><span>Each eligible NFTree receives</span><strong>{showAmount(preview.reduce((sum, item) => sum + BigInt(item.amount), 0n) / BigInt(snapshot.eligibleNFTrees))} <small>{token.symbol}</small></strong></div><p>{preview.length} wallet{preview.length === 1 ? "" : "s"} will receive a combined payment for their NFTrees.</p><p className="rm-muted">Any fraction too small to divide equally remains in your wallet.</p><button className="rm-primary" onClick={() => void createManifest()} disabled={busy || !onMainnet}>Review distribution</button></> : <div className="rm-empty"><span aria-hidden="true">◎</span><p>Enter a budget and generate a holder list to see the allocation.</p></div>}
          {(manifest?.recipients || preview).length > 0 && <details className="rm-detail"><summary>View every recipient ({(manifest?.recipients || preview).length})</summary><div className="rm-recipient-list">{(manifest?.recipients || preview).map(item => <div key={item.address}><a href={`https://suiscan.xyz/mainnet/account/${item.address}`} target="_blank" rel="noreferrer" title={item.address}>{shortId(item.address)}</a><span>{item.nftreeIds.length} NFTree{item.nftreeIds.length === 1 ? "" : "s"}</span><strong>{showAmount(item.amount)} {manifest?.symbol || token.symbol}</strong></div>)}</div></details>}
        </section></div>
        {manifest && <section className="rm-card rm-deliver"><div className="rm-card-heading"><span className="rm-number">{complete ? "✓" : "4"}</span><div><h2>{complete ? "Rewards delivered" : "Approve and deliver"}</h2><p>{complete ? "Every recipient batch has a confirmed transaction receipt." : "Prepare each batch, then review and approve its exact payment in your wallet."}</p></div></div>{!complete && <label className="rm-checkbox"><input type="checkbox" checked={reviewed} disabled={busy || Boolean(pending)} onChange={event => { setReviewed(event.target.checked); setPrepared(null); }} /><span>I reviewed the token, total amount, snapshot and recipient wallets. These are direct wallet payments.</span></label>}
          <div className="rm-payment-actions">{pending ? <button className="rm-primary" onClick={() => void reconcile()} disabled={busy || !onMainnet}>Check pending payment</button> : !complete ? prepared ? <button className="rm-primary" onClick={() => void approveBatch()} disabled={busy || !onMainnet}>{busy ? "Waiting for confirmation…" : `Approve batch ${prepared.index + 1} · ${showAmount(prepared.total)} ${manifest.symbol}`}</button> : <button className="rm-primary" onClick={() => void prepareBatch()} disabled={busy || !reviewed || !onMainnet}>{busy ? "Preparing payment…" : `Prepare batch ${(nextBatch?.index ?? 0) + 1}`}</button> : null}<button className="rm-secondary" onClick={() => downloadManifest(manifest)} disabled={busy}>Export distribution record</button>{!pending && manifest.batches.some(batch => batch.digest) && <button className="rm-secondary" onClick={() => void reconcile()} disabled={busy || !onMainnet}>Verify saved receipts</button>}</div>
          {pending && <p className="rm-warning">A signed payment is awaiting a verified receipt. A replacement payment is blocked to prevent paying twice.</p>}
          <div className="rm-batches">{manifest.batches.map(batch => <div key={batch.index}><span>Batch {batch.index + 1}</span><strong className={`rm-batch-${batch.status}`}>{batch.status === "ready" ? "Not sent" : batch.status === "signed" ? "Receipt pending" : batch.status === "confirmed" ? "Confirmed" : "Failed on chain"}</strong>{batch.digest && <a href={`https://suiscan.xyz/mainnet/tx/${batch.digest}`} target="_blank" rel="noreferrer">View transaction ↗</a>}{batch.error && <small>{batch.error}</small>}</div>)}</div>
          <p className="rm-muted">Progress is saved in this browser. Export the distribution record before switching devices or clearing browser data. Imported records must be reconciled before any replacement payment.</p>
          <button className="rm-text-button" onClick={() => { setManifest(null); setPrepared(null); setReviewed(false); setNotice(""); setError(""); }} disabled={busy}>Start another distribution</button>
        </section>}
        <section className="rm-history"><div><h2>Saved distributions</h2><p>Resume a distribution or restore its exported record.</p></div><button className="rm-secondary" onClick={() => fileRef.current?.click()} disabled={busy}>Import record</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={event => void importManifest(event.target.files?.[0])} />{saved.length ? <div className="rm-saved-list">{saved.map(item => <button key={item.id} onClick={() => { setManifest(item); setPrepared(null); setReviewed(false); setError(""); setNotice("Saved distribution loaded. Confirmed batches are preserved."); }} disabled={busy}><span><strong>{item.title}</strong><small>{new Date(item.createdAt).toLocaleString()} · {item.symbol}</small></span><span>{item.batches.filter(batch => batch.status === "confirmed").length}/{item.batches.length} confirmed →</span></button>)}</div> : <p className="rm-muted">Your first distribution record will appear here.</p>}</section>
      </>}
      <div className="rm-feedback" aria-live="polite">{notice && <p className="rm-notice" role="status">{notice}</p>}{error && <p className="rm-error" role="alert">{error}</p>}</div>
      <footer className="rm-footer"><span>TREE · NFTree holder rewards</span><a href="/rewards/?advanced=1">Advanced claim pools</a><a href="/rewards/">Back to rewards</a></footer>
    </main></div>;
}
