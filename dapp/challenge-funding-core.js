import { TREE_TYPE, coinForAmount, normalizeAddress } from './earn-transactions-core.js';

export { TREE_TYPE };

export const CHALLENGE_FUNDING_WALLET = '0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f';
export const TREE_RAFFLE_PACKAGE_ID = '0xf732666a9e373afc1058229a9d6c46cd58ad401471e0c55362b0accca54ae00e';
export const TREE_RAFFLE_PRIZE_POOL_ID = '0x4b46d5f0543b6c036641875145b86d792f858b4315ddc08cc97d4619202438d9';
export const TREE_DECIMALS = 6;
export const DAILY_CHALLENGE_PRIZE_RAW = 50_000n * 10n ** BigInt(TREE_DECIMALS);

export function summarizeChallengeKeeper({ availableRaw = 0n, poolFields = [], recentRounds = [] } = {}) {
  const expectedPrize = `::prize_pool::WinnerPrize<${TREE_TYPE}>`.toLowerCase();
  const prizeFields = poolFields.filter((node) => {
    const type = String(node?.value?.type?.repr || '').toLowerCase();
    return type.endsWith(expectedPrize);
  });
  const reservedRaw = prizeFields.reduce(
    (total, node) => total + BigInt(node?.value?.json?.balance ?? 0),
    0n,
  );
  const unresolvedRoundCount = recentRounds.filter((round) => round?.state === 'scored' && !round?.award).length;
  const available = BigInt(availableRaw ?? 0);
  return {
    availableRaw: available,
    reservedRaw,
    totalRaw: available + reservedRaw,
    reservedPrizeCount: prizeFields.length,
    unresolvedRoundCount,
  };
}

export function isChallengeFundingWallet(wallet) {
  return normalizeAddress(wallet) === normalizeAddress(CHALLENGE_FUNDING_WALLET);
}

export function parseTreeFundingAmount(value) {
  const text = String(value ?? '').trim().replace(/,/g, '');
  if (!/^\d+(?:\.\d{0,6})?$/.test(text)) throw new Error('Enter a valid TREE amount with no more than six decimal places.');
  const [whole, fraction = ''] = text.split('.');
  const raw = BigInt(`${whole}${fraction.padEnd(TREE_DECIMALS, '0')}`.replace(/^0+/, '') || '0');
  if (raw <= 0n) throw new Error('Enter a TREE amount greater than zero.');
  if (raw > 18_446_744_073_709_551_615n) throw new Error('The funding amount exceeds the Sui u64 limit.');
  return raw;
}

export function formatTreeRaw(value, maximumFractionDigits = 6) {
  const raw = BigInt(value ?? 0);
  const base = 10n ** BigInt(TREE_DECIMALS);
  const whole = raw / base;
  const fraction = String(raw % base).padStart(TREE_DECIMALS, '0').replace(/0+$/, '');
  const formattedWhole = Number(whole).toLocaleString('en-US');
  if (!fraction || maximumFractionDigits <= 0) return formattedWhole;
  return `${formattedWhole}.${fraction.slice(0, maximumFractionDigits)}`;
}

function assertDepositOnly(transaction) {
  const expected = `${normalizeAddress(TREE_RAFFLE_PACKAGE_ID)}::prize_pool::deposit`;
  for (const command of transaction.getData().commands || []) {
    const call = command?.MoveCall || (command?.$kind === 'MoveCall' ? command.MoveCall : null);
    if (!call) continue;
    const target = `${normalizeAddress(call.package)}::${call.module}::${call.function}`;
    if (target !== expected) throw new Error(`Unexpected Move call in Challenge funding transaction: ${target}`);
  }
}

export async function buildChallengePoolFundingTransaction({ Transaction, client, owner, amountRaw }) {
  if (typeof Transaction !== 'function' || !client?.core?.listCoins) throw new Error('Sui funding dependencies are unavailable.');
  if (!isChallengeFundingWallet(owner)) throw new Error('Connect the designated Challenge funding wallet.');
  const amount = BigInt(amountRaw ?? 0);
  if (amount <= 0n) throw new Error('Enter a TREE amount greater than zero.');
  const transaction = new Transaction();
  transaction.setSender(CHALLENGE_FUNDING_WALLET);
  const fundingCoin = await coinForAmount(transaction, client, CHALLENGE_FUNDING_WALLET, TREE_TYPE, amount);
  transaction.moveCall({
    target: `${TREE_RAFFLE_PACKAGE_ID}::prize_pool::deposit`,
    typeArguments: [TREE_TYPE],
    arguments: [transaction.object(TREE_RAFFLE_PRIZE_POOL_ID), fundingCoin],
  });
  assertDepositOnly(transaction);
  return { transaction, amountRaw: amount };
}
