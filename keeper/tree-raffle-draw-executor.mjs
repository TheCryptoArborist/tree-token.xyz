import { bcs } from '@mysten/sui/bcs';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';

export const TREE_TYPE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
export const DAILY_PRIZE_RAW = '50000000000';
export const RANDOM_OBJECT_ID = '0x8';

const DRAW_ID_PATTERN = /^[a-z0-9][a-z0-9:_-]{2,95}$/;
const SUI_ADDRESS_PATTERN = /^0x[0-9a-f]{64}$/;
const DIGEST_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{40,64}$/;

const DrawKeyBcs = bcs.struct('DrawKey', { draw_id: bcs.vector(bcs.u8()) });
const PrizeKeyBcs = bcs.struct('PrizeKey', { draw_id: bcs.vector(bcs.u8()) });
const DrawOutcomeBcs = bcs.struct('DrawOutcome', {
  ledger_commitment: bcs.vector(bcs.u8()),
  winning_ticket: bcs.u64(),
  total_tickets: bcs.u64(),
  winner_registered: bcs.bool(),
});
const WinnerPrizeBcs = bcs.struct('WinnerPrize', {
  winner: bcs.Address,
  balance: bcs.struct('Balance', { value: bcs.u64() }),
});

function required(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${label} is not configured.`);
  return normalized;
}

function normalizedAddress(value, label) {
  const body = required(value, label).toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const address = `0x${body}`;
  if (!SUI_ADDRESS_PATTERN.test(address)) throw new Error(`${label} is invalid.`);
  return address;
}

function utf8(value) {
  return [...new TextEncoder().encode(value)];
}

function hex(value) {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error('Invalid raffle ledger commitment.');
  return value.match(/.{2}/g).map((byte) => Number.parseInt(byte, 16));
}

function digestOf(result) {
  const digest = result?.digest ?? result?.transaction?.digest;
  if (!DIGEST_PATTERN.test(String(digest || ''))) throw new Error('Sui returned no valid transaction digest.');
  return String(digest);
}

function successful(result) {
  return (result?.effects?.status?.status ?? result?.effects?.status) === 'success';
}

function datePartsInNewYork(now) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return {
    year: Number(values.year), month: Number(values.month), day: Number(values.day),
    hour: Number(values.hour), minute: Number(values.minute),
  };
}

export function dueDailyRoundId(now = new Date()) {
  const parts = datePartsInNewYork(now);
  if (parts.hour < 10 || (parts.hour === 10 && parts.minute < 5)) return null;
  const previous = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - 1));
  return `daily:${previous.toISOString().slice(0, 10)}`;
}

export function winnerForTicket(ranges, winningTicket) {
  const ticket = BigInt(winningTicket);
  for (const range of ranges) {
    if (ticket >= BigInt(range.start) && ticket < BigInt(range.endExclusive)) return range.wallet;
  }
  throw new Error('The on-chain winning ticket is outside the locked ledger.');
}

function validateSnapshot(snapshot, roundId) {
  if (!snapshot || snapshot.roundId !== roundId || snapshot.prizeClass !== 'main'
    || snapshot.onchainDrawId !== `${roundId}:main`
    || !DRAW_ID_PATTERN.test(snapshot.onchainDrawId)
    || !/^[0-9a-f]{64}$/.test(snapshot.ledgerCommitment)
    || !/^[1-9][0-9]*$/.test(snapshot.totalTickets)
    || !Array.isArray(snapshot.ticketRanges) || snapshot.ticketRanges.length === 0) {
    throw new Error('Supabase returned an invalid daily raffle snapshot.');
  }
  return snapshot;
}

function validateKnowledgeAward(snapshot) {
  if (!snapshot
    || !/^knowledge:\d{4}-\d{2}-\d{2}$/.test(snapshot.roundId)
    || snapshot.onchainDrawId !== `${snapshot.roundId}:award`
    || !DRAW_ID_PATTERN.test(snapshot.onchainDrawId)
    || !/^[0-9a-f]{64}$/.test(snapshot.resolutionCommitment)
    || snapshot.totalTickets !== '1'
    || !SUI_ADDRESS_PATTERN.test(snapshot.wallet)
    || snapshot.tokenType !== TREE_TYPE
    || snapshot.amountRaw !== DAILY_PRIZE_RAW) {
    throw new Error('Supabase returned an invalid Knowledge Trial award snapshot.');
  }
  return {
    ...snapshot,
    ledgerCommitment: snapshot.resolutionCommitment,
    totalTickets: '1',
  };
}

export class SupabaseDailyDrawStore {
  constructor({ url, secretKey, fetchImpl = fetch }) {
    this.url = new URL(required(url, 'TREE_RAFFLE_SUPABASE_URL')).origin;
    this.secretKey = required(secretKey, 'TREE_RAFFLE_SUPABASE_SECRET_KEY');
    this.fetchImpl = fetchImpl;
  }

  async rpc(name, body, { allowMissingRound = false } = {}) {
    const response = await this.fetchImpl(`${this.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json', 'Content-Type': 'application/json',
        Authorization: `Bearer ${this.secretKey}`, apikey: this.secretKey,
        'X-Client-Info': 'tree-raffle-keeper-draw/1',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok && allowMissingRound && response.status === 500
      && payload?.code === 'P0002' && payload?.message === 'TREE raffle round was not found.') return null;
    if (!response.ok) throw new Error(`Supabase ${name} failed with HTTP ${response.status}.`);
    return payload;
  }

  async lockDaily(roundId) {
    const snapshot = await this.rpc('lock_tree_raffle_draw', {
      p_round_id: roundId, p_prize_class: 'main',
    }, { allowMissingRound: true });
    return snapshot === null ? null : validateSnapshot(snapshot, roundId);
  }

  recordWinner(input) {
    return this.rpc('record_tree_raffle_winner', {
      p_round_id: input.roundId,
      p_prize_class: 'main',
      p_onchain_draw_id: input.onchainDrawId,
      p_ledger_commitment: input.ledgerCommitment,
      p_winning_ticket: input.winningTicket,
      p_wallet: input.wallet,
      p_draw_tx_digest: input.drawTxDigest,
      p_register_tx_digest: input.registerTxDigest,
    });
  }
}

export class SupabaseKnowledgeTrialAwardStore {
  constructor({ url, secretKey, fetchImpl = fetch }) {
    this.url = new URL(required(url, 'TREE_KNOWLEDGE_TRIAL_SUPABASE_URL')).origin;
    this.secretKey = required(secretKey, 'TREE_KNOWLEDGE_TRIAL_SUPABASE_SECRET_KEY');
    this.fetchImpl = fetchImpl;
  }

  async rpc(name, body) {
    const response = await this.fetchImpl(`${this.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json', 'Content-Type': 'application/json',
        Authorization: `Bearer ${this.secretKey}`, apikey: this.secretKey,
        'X-Client-Info': 'tree-knowledge-trial-award-keeper/1',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`Supabase ${name} failed with HTTP ${response.status}.`);
    return payload;
  }

  async lockNext() {
    const snapshot = await this.rpc('lock_next_tree_knowledge_trial_award_v1', {});
    return snapshot === null ? null : validateKnowledgeAward(snapshot);
  }

  recordAward(input) {
    return this.rpc('record_tree_knowledge_trial_award_v1', {
      p_round_id: input.roundId,
      p_onchain_draw_id: input.onchainDrawId,
      p_resolution_commitment: input.resolutionCommitment,
      p_wallet: input.wallet,
      p_draw_tx_digest: input.drawTxDigest,
      p_register_tx_digest: input.registerTxDigest,
    });
  }
}

export class SuiDailyDrawChain {
  constructor({ packageId, poolId, operatorCapId, operatorAddress, privateKey, client }) {
    this.packageId = normalizedAddress(packageId, 'TREE_RAFFLE_PACKAGE_ID');
    this.poolId = normalizedAddress(poolId, 'TREE_RAFFLE_PRIZE_POOL_ID');
    this.operatorCapId = normalizedAddress(operatorCapId, 'TREE_RAFFLE_OPERATOR_CAP_ID');
    this.operatorAddress = normalizedAddress(operatorAddress, 'TREE_RAFFLE_OPERATOR_ADDRESS');
    this.keypair = Ed25519Keypair.fromSecretKey(required(privateKey, 'TREE_RAFFLE_OPERATOR_PRIVATE_KEY'));
    if (this.keypair.toSuiAddress() !== this.operatorAddress) {
      throw new Error('The raffle operator private key does not match the configured operator wallet.');
    }
    this.client = client ?? new SuiGrpcClient({
      network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443',
    });
  }

  async finalized(transaction) {
    const submitted = await this.client.signAndExecuteTransaction({
      transaction, signer: this.keypair, include: { effects: true, events: true },
    });
    const finalized = await this.client.core.waitForTransaction({
      result: submitted, timeout: 60_000, include: { effects: true, events: true },
    });
    if (!successful(finalized)) throw new Error('The raffle operator transaction failed on Sui.');
    return finalized;
  }

  dynamicName(typeName, drawId, schema) {
    return { type: `${this.packageId}::prize_pool::${typeName}`, bcs: schema.serialize({ draw_id: utf8(drawId) }).toBytes() };
  }

  async readDraw(snapshot) {
    try {
      const response = await this.client.core.getDynamicField({
        parentId: this.poolId,
        name: this.dynamicName('DrawKey', snapshot.onchainDrawId, DrawKeyBcs),
      });
      const parsed = DrawOutcomeBcs.parse(response.dynamicField.value.bcs);
      const commitment = [...parsed.ledger_commitment].map((byte) => byte.toString(16).padStart(2, '0')).join('');
      if (commitment !== snapshot.ledgerCommitment || String(parsed.total_tickets) !== snapshot.totalTickets) {
        throw new Error('The persisted Sui draw conflicts with the locked ledger.');
      }
      return {
        digest: required(response.dynamicField.previousTransaction, 'draw transaction digest'),
        winningTicket: String(parsed.winning_ticket),
        winnerRegistered: parsed.winner_registered,
      };
    } catch (error) {
      if (/not found|does not exist|objectnotfound/i.test(String(error?.message || error))) return null;
      throw error;
    }
  }

  async executeDraw(snapshot) {
    const existing = await this.readDraw(snapshot);
    if (existing) return existing;
    const transaction = new Transaction();
    transaction.moveCall({
      target: `${this.packageId}::prize_pool::execute_draw`,
      arguments: [
        transaction.object(this.poolId), transaction.object(this.operatorCapId),
        transaction.object(RANDOM_OBJECT_ID), transaction.pure.vector('u8', utf8(snapshot.onchainDrawId)),
        transaction.pure.vector('u8', hex(snapshot.ledgerCommitment)),
        transaction.pure.u64(snapshot.totalTickets),
      ],
    });
    await this.finalized(transaction);
    const persisted = await this.readDraw(snapshot);
    if (!persisted) throw new Error('The finalized raffle draw was not persisted on Sui.');
    return persisted;
  }

  async readPrize(snapshot) {
    try {
      const response = await this.client.core.getDynamicField({
        parentId: this.poolId,
        name: this.dynamicName('PrizeKey', snapshot.onchainDrawId, PrizeKeyBcs),
      });
      const parsed = WinnerPrizeBcs.parse(response.dynamicField.value.bcs);
      return {
        digest: required(response.dynamicField.previousTransaction, 'winner registration transaction digest'),
        winner: normalizedAddress(parsed.winner, 'registered raffle winner'),
        amountRaw: String(parsed.balance.value),
      };
    } catch (error) {
      if (/not found|does not exist|objectnotfound/i.test(String(error?.message || error))) return null;
      throw error;
    }
  }

  async registerWinner(snapshot, winner) {
    const existing = await this.readPrize(snapshot);
    if (existing) return existing;
    const transaction = new Transaction();
    transaction.moveCall({
      target: `${this.packageId}::prize_pool::register_winner`,
      typeArguments: [TREE_TYPE],
      arguments: [
        transaction.object(this.poolId), transaction.object(this.operatorCapId),
        transaction.pure.vector('u8', utf8(snapshot.onchainDrawId)),
        transaction.pure.address(winner), transaction.pure.u64(DAILY_PRIZE_RAW),
      ],
    });
    await this.finalized(transaction);
    const persisted = await this.readPrize(snapshot);
    if (!persisted || persisted.winner !== winner || persisted.amountRaw !== DAILY_PRIZE_RAW) {
      throw new Error('The finalized raffle winner registration does not match the verified winner.');
    }
    return persisted;
  }

  async settleKnowledgeAward(snapshot) {
    if (snapshot.tokenType !== TREE_TYPE || snapshot.amountRaw !== DAILY_PRIZE_RAW
      || snapshot.totalTickets !== '1' || !SUI_ADDRESS_PATTERN.test(snapshot.wallet)) {
      throw new Error('The Knowledge Trial award does not match the approved TREE prize.');
    }
    const existing = await this.readPrize(snapshot);
    if (existing) {
      if (existing.winner !== snapshot.wallet || existing.amountRaw !== snapshot.amountRaw) {
        throw new Error('The persisted Knowledge Trial award conflicts with the resolved winner.');
      }
      return { drawTxDigest: existing.digest, registerTxDigest: existing.digest };
    }

    const persistedDraw = await this.readDraw(snapshot);
    if (persistedDraw) {
      const registered = await this.registerWinner(snapshot, snapshot.wallet);
      return { drawTxDigest: persistedDraw.digest, registerTxDigest: registered.digest };
    }

    const transaction = new Transaction();
    transaction.moveCall({
      target: `${this.packageId}::prize_pool::execute_draw`,
      arguments: [
        transaction.object(this.poolId), transaction.object(this.operatorCapId),
        transaction.object(RANDOM_OBJECT_ID), transaction.pure.vector('u8', utf8(snapshot.onchainDrawId)),
        transaction.pure.vector('u8', hex(snapshot.resolutionCommitment)),
        transaction.pure.u64(1),
      ],
    });
    transaction.moveCall({
      target: `${this.packageId}::prize_pool::register_winner`,
      typeArguments: [snapshot.tokenType],
      arguments: [
        transaction.object(this.poolId), transaction.object(this.operatorCapId),
        transaction.pure.vector('u8', utf8(snapshot.onchainDrawId)),
        transaction.pure.address(snapshot.wallet), transaction.pure.u64(snapshot.amountRaw),
      ],
    });
    const finalized = await this.finalized(transaction);
    const digest = digestOf(finalized);
    const registered = await this.readPrize(snapshot);
    if (!registered || registered.winner !== snapshot.wallet || registered.amountRaw !== snapshot.amountRaw) {
      throw new Error('The finalized Knowledge Trial award was not persisted correctly.');
    }
    return { drawTxDigest: digest, registerTxDigest: digest };
  }
}

export async function runDailyDraw({ roundId, store, chain }) {
  if (!/^daily:\d{4}-\d{2}-\d{2}$/.test(roundId)) throw new Error('Invalid daily raffle round ID.');
  const snapshot = await store.lockDaily(roundId);
  if (snapshot === null) return { status: 'no-round', roundId };
  const draw = await chain.executeDraw(snapshot);
  const winner = winnerForTicket(snapshot.ticketRanges, draw.winningTicket);
  const registration = await chain.registerWinner(snapshot, winner);
  if (registration.winner !== winner || registration.amountRaw !== DAILY_PRIZE_RAW) {
    throw new Error('The registered daily prize does not match the verified draw.');
  }
  const recorded = await store.recordWinner({
    roundId,
    onchainDrawId: snapshot.onchainDrawId,
    ledgerCommitment: snapshot.ledgerCommitment,
    winningTicket: draw.winningTicket,
    wallet: winner,
    drawTxDigest: draw.digest,
    registerTxDigest: registration.digest,
  });
  return { roundId, winner, winningTicket: draw.winningTicket, drawTxDigest: draw.digest, registerTxDigest: registration.digest, recorded };
}

export async function runNextKnowledgeTrialAward({ store, chain }) {
  const snapshot = await store.lockNext();
  if (snapshot === null) return { status: 'no-award-ready' };
  const settled = await chain.settleKnowledgeAward(snapshot);
  const recorded = await store.recordAward({
    roundId: snapshot.roundId,
    onchainDrawId: snapshot.onchainDrawId,
    resolutionCommitment: snapshot.resolutionCommitment,
    wallet: snapshot.wallet,
    ...settled,
  });
  return {
    status: 'awarded',
    roundId: snapshot.roundId,
    wallet: snapshot.wallet,
    ...settled,
    recorded,
  };
}

export function configuredDailyDrawExecutor(env = process.env) {
  const store = new SupabaseDailyDrawStore({
    url: env.TREE_RAFFLE_SUPABASE_URL,
    secretKey: env.TREE_RAFFLE_SUPABASE_SECRET_KEY,
  });
  const chain = new SuiDailyDrawChain({
    packageId: env.TREE_RAFFLE_PACKAGE_ID,
    poolId: env.TREE_RAFFLE_PRIZE_POOL_ID,
    operatorCapId: env.TREE_RAFFLE_OPERATOR_CAP_ID,
    operatorAddress: env.TREE_RAFFLE_OPERATOR_ADDRESS,
    privateKey: env.TREE_RAFFLE_OPERATOR_PRIVATE_KEY,
  });
  return { run: (roundId) => runDailyDraw({ roundId, store, chain }) };
}

export function configuredKnowledgeTrialAwardExecutor(env = process.env) {
  const store = new SupabaseKnowledgeTrialAwardStore({
    url: env.TREE_KNOWLEDGE_TRIAL_SUPABASE_URL || env.TREE_RAFFLE_SUPABASE_URL,
    secretKey: env.TREE_KNOWLEDGE_TRIAL_SUPABASE_SECRET_KEY || env.TREE_RAFFLE_SUPABASE_SECRET_KEY,
  });
  const chain = new SuiDailyDrawChain({
    packageId: env.TREE_RAFFLE_PACKAGE_ID,
    poolId: env.TREE_RAFFLE_PRIZE_POOL_ID,
    operatorCapId: env.TREE_RAFFLE_OPERATOR_CAP_ID,
    operatorAddress: env.TREE_RAFFLE_OPERATOR_ADDRESS,
    privateKey: env.TREE_RAFFLE_OPERATOR_PRIVATE_KEY,
  });
  return { run: () => runNextKnowledgeTrialAward({ store, chain }) };
}
