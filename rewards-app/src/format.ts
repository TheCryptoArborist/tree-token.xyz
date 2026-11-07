import { MIST_PER_SUI } from "./config";

export function shortId(value: string) {
  if (!value || value.length < 18) return value || "--";
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

export function isSuiAddress(value: string) {
  return /^0x[a-fA-F0-9]{40,64}$/.test(value.trim());
}

export function parseSuiToMist(value: string) {
  const trimmed = value.trim();
  if (!trimmed || !/^\d+(\.\d*)?$/.test(trimmed)) return 0n;
  const [wholeRaw, fractionalRaw = ""] = trimmed.split(".");
  const whole = BigInt(wholeRaw || "0") * MIST_PER_SUI;
  const fractional = BigInt(fractionalRaw.slice(0, 9).padEnd(9, "0") || "0");
  return whole + fractional;
}

export function parseTokenAmountToAtomic(value: string, decimals: number) {
  const trimmed = value.trim();
  if (!trimmed || !/^\d+(\.\d*)?$/.test(trimmed) || decimals < 0) return 0n;
  const [wholeRaw, fractionalRaw = ""] = trimmed.split(".");
  const scale = 10n ** BigInt(decimals);
  const whole = BigInt(wholeRaw || "0") * scale;
  const fractional = BigInt(fractionalRaw.slice(0, decimals).padEnd(decimals, "0") || "0");
  return whole + fractional;
}

export function mistToSui(mist: bigint) {
  return Number(mist) / Number(MIST_PER_SUI);
}

export function formatSui(mist: bigint, maximumFractionDigits = 6) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(mistToSui(mist))} SUI`;
}

export function formatInteger(value: bigint | number) {
  return new Intl.NumberFormat("en-US").format(value);
}

