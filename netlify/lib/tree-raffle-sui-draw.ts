import {
  treeRaffleWinnerForTicket,
  type TreeRaffleTicketRange,
} from './tree-raffle-draw-audit.ts';

const SUI_ID = /^0x[0-9a-fA-F]{1,64}$/;
const SUI_ADDRESS = /^0x[0-9a-f]{64}$/;
const SUI_DIGEST = /^[1-9A-HJ-NP-Za-km-z]{40,64}$/;
const U64_MAX = 18_446_744_073_709_551_615n;
export const SUI_RANDOM_OBJECT_ID = '0x8';

type TransactionConstructor = new () => {
  object(id: string): unknown;
  pure: {
    address(value: string): unknown;
    u64(value: bigint | string): unknown;
    vector(type: 'u8', value: number[]): unknown;
  };
  moveCall(input: { target: string; typeArguments?: string[]; arguments: unknown[] }): unknown;
};

export type TreeRaffleDrawTransactionInput = {
  packageId: string;
  poolId: string;
  operatorCapId: string;
  onchainDrawId: string;
  ledgerCommitment: string;
  totalTickets: string;
  randomObjectId?: string;
};

function suiId(value: string, label: string): string {
  if (!SUI_ID.test(value)) throw new Error(`Invalid TREE raffle ${label}.`);
  return value.toLowerCase();
}

function u64(value: string, label: string): bigint {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new Error(`Invalid TREE raffle ${label}.`);
  const parsed = BigInt(value);
  if (parsed > U64_MAX) throw new Error(`Invalid TREE raffle ${label}.`);
  return parsed;
}

function utf8Bytes(value: string): number[] {
  const bytes = [...new TextEncoder().encode(value)];
  if (bytes.length === 0 || bytes.length > 96) throw new Error('Invalid TREE raffle on-chain draw ID.');
  return bytes;
}

function hexBytes(value: string): number[] {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error('Invalid TREE raffle ledger commitment.');
  return value.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16));
}

export function buildTreeRaffleExecuteDrawTransaction(
  Transaction: TransactionConstructor,
  input: TreeRaffleDrawTransactionInput,
) {
  const packageId = suiId(input.packageId, 'package ID');
  const totalTickets = u64(input.totalTickets, 'ticket total');
  if (totalTickets === 0n) throw new Error('TREE raffle draw requires at least one ticket.');
  const transaction = new Transaction();
  transaction.moveCall({
    target: `${packageId}::prize_pool::execute_draw`,
    arguments: [
      transaction.object(suiId(input.poolId, 'prize pool ID')),
      transaction.object(suiId(input.operatorCapId, 'operator capability ID')),
      transaction.object(suiId(input.randomObjectId || SUI_RANDOM_OBJECT_ID, 'Random object ID')),
      transaction.pure.vector('u8', utf8Bytes(input.onchainDrawId)),
      transaction.pure.vector('u8', hexBytes(input.ledgerCommitment)),
      transaction.pure.u64(totalTickets),
    ],
  });
  return transaction;
}

export function buildTreeRaffleRegisterWinnerTransaction(
  Transaction: TransactionConstructor,
  input: Omit<TreeRaffleDrawTransactionInput, 'ledgerCommitment' | 'totalTickets' | 'randomObjectId'> & {
    winner: string;
    tokenType: string;
    amountRaw: string;
  },
) {
  const packageId = suiId(input.packageId, 'package ID');
  if (!SUI_ADDRESS.test(input.winner)) throw new Error('Invalid TREE raffle winner wallet.');
  if (!input.tokenType.includes('::')) throw new Error('Invalid TREE raffle prize token type.');
  const amount = u64(input.amountRaw, 'prize amount');
  if (amount === 0n) throw new Error('TREE raffle prize amount must be positive.');
  const transaction = new Transaction();
  transaction.moveCall({
    target: `${packageId}::prize_pool::register_winner`,
    typeArguments: [input.tokenType],
    arguments: [
      transaction.object(suiId(input.poolId, 'prize pool ID')),
      transaction.object(suiId(input.operatorCapId, 'operator capability ID')),
      transaction.pure.vector('u8', utf8Bytes(input.onchainDrawId)),
      transaction.pure.address(input.winner),
      transaction.pure.u64(amount),
    ],
  });
  return transaction;
}

export function buildTreeRaffleClaimTransaction(
  Transaction: TransactionConstructor,
  input: {
    packageId: string;
    poolId: string;
    onchainDrawId: string;
    tokenType: string;
  },
) {
  const packageId = suiId(input.packageId, 'package ID');
  if (!input.tokenType.includes('::')) throw new Error('Invalid TREE raffle prize token type.');
  const transaction = new Transaction();
  transaction.moveCall({
    target: `${packageId}::prize_pool::claim`,
    typeArguments: [input.tokenType],
    arguments: [
      transaction.object(suiId(input.poolId, 'prize pool ID')),
      transaction.pure.vector('u8', utf8Bytes(input.onchainDrawId)),
    ],
  });
  return transaction;
}

function byteArray(value: unknown, label: string): number[] {
  if (!Array.isArray(value) || value.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
    throw new Error(`Sui returned an invalid TREE raffle ${label}.`);
  }
  return value as number[];
}

function normalizedSuiId(value: string): string {
  return `0x${value.slice(2).toLowerCase().replace(/^0+/, '') || '0'}`;
}

export function verifyTreeRaffleDrawTransaction(input: {
  transaction: unknown;
  packageId: string;
  onchainDrawId: string;
  ledgerCommitment: string;
  totalTickets: string;
  ticketRanges: TreeRaffleTicketRange[];
}) {
  const tx = input.transaction as Record<string, any>;
  const digest = tx?.digest ?? tx?.transaction?.digest;
  const status = tx?.effects?.status?.status ?? tx?.effects?.status ?? tx?.transaction?.effects?.status?.status;
  if (!SUI_DIGEST.test(String(digest || '')) || status !== 'success') {
    throw new Error('TREE raffle draw transaction did not finalize successfully.');
  }
  const packageId = normalizedSuiId(suiId(input.packageId, 'package ID'));
  const events = Array.isArray(tx?.events) ? tx.events : [];
  const matches = events.filter((event: Record<string, unknown>) => {
    const type = String(event?.type || '');
    const [eventPackage, moduleName, eventName] = type.split('::');
    return SUI_ID.test(eventPackage || '')
      && normalizedSuiId(eventPackage) === packageId
      && moduleName === 'prize_pool'
      && eventName === 'DrawExecuted';
  });
  if (matches.length !== 1) throw new Error('Sui returned an invalid TREE raffle draw event count.');

  const event = (matches[0].json ?? matches[0].parsedJson) as Record<string, unknown>;
  if (!event || typeof event !== 'object') throw new Error('Sui returned malformed TREE raffle draw data.');
  const drawId = new TextDecoder().decode(Uint8Array.from(byteArray(event.draw_id, 'draw ID')));
  const commitment = byteArray(event.ledger_commitment, 'ledger commitment')
    .map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const winningTicket = u64(String(event.winning_ticket), 'winning ticket');
  const totalTickets = u64(String(event.total_tickets), 'ticket total');
  if (drawId !== input.onchainDrawId
    || commitment !== input.ledgerCommitment
    || totalTickets.toString() !== input.totalTickets
    || winningTicket >= totalTickets) {
    throw new Error('Sui TREE raffle draw event does not match the locked ledger.');
  }
  return {
    digest: String(digest),
    winningTicket: winningTicket.toString(),
    totalTickets: totalTickets.toString(),
    winner: treeRaffleWinnerForTicket(input.ticketRanges, winningTicket),
  };
}

export function verifyTreeRaffleClaimTransaction(input: {
  transaction: unknown;
  packageId: string;
  onchainDrawId: string;
  wallet: string;
  tokenType: string;
  amountRaw: string;
}) {
  const tx = input.transaction as Record<string, any>;
  const digest = tx?.digest ?? tx?.transaction?.digest;
  const status = tx?.effects?.status?.status ?? tx?.effects?.status ?? tx?.transaction?.effects?.status?.status;
  if (!SUI_DIGEST.test(String(digest || '')) || status !== 'success') {
    throw new Error('TREE raffle claim transaction did not finalize successfully.');
  }
  if (!SUI_ADDRESS.test(input.wallet) || !input.tokenType.includes('::')) {
    throw new Error('Invalid TREE raffle expected claim values.');
  }
  const expectedAmount = u64(input.amountRaw, 'prize amount');
  const packageId = normalizedSuiId(suiId(input.packageId, 'package ID'));
  const events = Array.isArray(tx?.events) ? tx.events : [];
  const matches = events.filter((event: Record<string, unknown>) => {
    const type = String(event?.type || '');
    const separator = type.indexOf('::');
    if (separator < 0) return false;
    const eventPackage = type.slice(0, separator);
    return SUI_ID.test(eventPackage)
      && normalizedSuiId(eventPackage) === packageId
      && type.slice(separator) === `::prize_pool::PrizeClaimed<${input.tokenType}>`;
  });
  if (matches.length !== 1) throw new Error('Sui returned an invalid TREE raffle claim event count.');
  const event = (matches[0].json ?? matches[0].parsedJson) as Record<string, unknown>;
  if (!event || typeof event !== 'object') throw new Error('Sui returned malformed TREE raffle claim data.');
  const drawId = new TextDecoder().decode(Uint8Array.from(byteArray(event.draw_id, 'claim draw ID')));
  const amount = u64(String(event.amount), 'claimed amount');
  if (drawId !== input.onchainDrawId
    || String(event.winner).toLowerCase() !== input.wallet
    || amount !== expectedAmount) {
    throw new Error('Sui TREE raffle claim event does not match the recorded prize.');
  }
  return { digest: String(digest), wallet: input.wallet, amountRaw: amount.toString() };
}
