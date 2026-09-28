export const SUI = '0x2::sui::SUI';
export const USDC = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
export const TREE = '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE';
export const SOURCES = {
  base: { USDC: ['0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', 6], ETH: ['0x0000000000000000000000000000000000000000', 18] },
  ethereum: { USDC: ['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 6], ETH: ['0x0000000000000000000000000000000000000000', 18] },
  solana: { USDC: ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 6], SOL: ['0x0000000000000000000000000000000000000000', 9] },
};
export function amountToRaw(value, decimals) {
  if (!/^\d{1,10}(\.\d+)?$/.test(value)) throw Error('Enter a positive amount using digits and a decimal point.');
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > decimals) throw Error(`This asset supports up to ${decimals} decimal places.`);
  const raw = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0'));
  if (raw <= 0n || raw > 18446744073709551615n) throw Error('Amount is outside the supported range.');
  return raw.toString();
}
