import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const registryPath = join(__dirname, "..", "src", "rewardTokens.ts");
const registrySource = await readFile(registryPath, "utf8");

const tokenPattern =
  /tokenId:\s*"(?<tokenId>[^"]+)"[\s\S]*?symbol:\s*"(?<symbol>[^"]+)"[\s\S]*?coinType:\s*"(?<coinType>[^"]+)"[\s\S]*?decimals:\s*(?<decimals>\d+)/g;

const tokens = [...registrySource.matchAll(tokenPattern)].map((match) => ({
  tokenId: match.groups.tokenId,
  symbol: match.groups.symbol,
  coinType: match.groups.coinType,
  registryDecimals: Number(match.groups.decimals),
}));

if (!tokens.length) {
  throw new Error(`No tokens parsed from ${registryPath}`);
}

async function fetchCoinMetadata(token) {
  const response = await fetch("https://fullnode.mainnet.sui.io:443", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: token.tokenId,
      method: "suix_getCoinMetadata",
      params: [token.coinType],
    }),
  });
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message || "metadata lookup failed");
  return payload.result;
}

const rows = [];
for (const token of tokens) {
  try {
    const metadata = await fetchCoinMetadata(token);
    rows.push({
      tokenId: token.tokenId,
      symbol: token.symbol,
      coinType: token.coinType,
      registryDecimals: token.registryDecimals,
      metadataDecimals: metadata?.decimals ?? "missing",
      match: metadata?.decimals === token.registryDecimals ? "match" : "mismatch",
    });
  } catch (error) {
    rows.push({
      tokenId: token.tokenId,
      symbol: token.symbol,
      coinType: token.coinType,
      registryDecimals: token.registryDecimals,
      metadataDecimals: "error",
      match: error instanceof Error ? error.message : "error",
    });
  }
}

console.table(rows.map(({ coinType, ...row }) => row));

const mismatches = rows.filter((row) => row.match !== "match");
if (mismatches.length) {
  console.log("\nDecimal audit mismatches:");
  for (const row of mismatches) {
    console.log(
      `${row.symbol} (${row.tokenId}) registry=${row.registryDecimals} metadata=${row.metadataDecimals}\n  ${row.coinType}`,
    );
  }
  process.exitCode = 1;
} else {
  console.log("\nAll registered token decimals match Sui coin metadata.");
}

