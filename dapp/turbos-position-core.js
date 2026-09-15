export const TURBOS_POSITION_NFT_TYPE = '0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1::position_nft::TurbosPositionNFT';
export const TURBOS_BURN_POSITION_NFT_TYPE = '0x89253eb9ca5bf424a118bfc1a172bbc2dd39d38becd00e5cbf24b87ee828bce5::position_manager::TurbosPositionBurnNFT';

export function normalizeTurbosAddress(value) {
  const text = String(value || '').toLowerCase();
  const hex = text.startsWith('0x') ? text.slice(2) : text;
  return /^[0-9a-f]+$/.test(hex) ? `0x${hex.replace(/^0+/, '') || '0'}` : text;
}

export function normalizeTurbosType(value) {
  const parts = String(value || '').toLowerCase().split('::');
  return parts.length < 3 ? String(value || '').toLowerCase() : `${normalizeTurbosAddress(parts[0])}::${parts[1]}::${parts[2]}`;
}

function fieldValue(value) {
  if (typeof value === 'string') return value;
  return value?.name ?? value?.fields?.name ?? '';
}

function embeddedPosition(json) {
  const value = json?.position_nft;
  return value?.fields ?? value ?? null;
}

export function parseTurbosPositionObject(object) {
  const json = object?.json?.fields ?? object?.json ?? {};
  const burnProof = normalizeTurbosType(object?.type) === normalizeTurbosType(TURBOS_BURN_POSITION_NFT_TYPE);
  const embedded = burnProof ? embeddedPosition(json) : null;
  const metadata = embedded || json;
  return {
    object,
    objectId: object?.objectId || json?.id || null,
    positionId: fieldValue(json?.position_id) || fieldValue(metadata?.position_id),
    poolId: fieldValue(json?.pool_id) || fieldValue(metadata?.pool_id),
    coinTypeA: fieldValue(json?.coin_type_a) || fieldValue(metadata?.coin_type_a),
    coinTypeB: fieldValue(json?.coin_type_b) || fieldValue(metadata?.coin_type_b),
    feeType: fieldValue(json?.fee_type) || fieldValue(metadata?.fee_type),
    kind: burnProof ? 'burn-proof' : 'standard',
  };
}

export function matchesTurbosPool(position, { poolId, coinTypeA, coinTypeB, feeType }) {
  return normalizeTurbosAddress(position?.poolId) === normalizeTurbosAddress(poolId)
    && normalizeTurbosType(position?.coinTypeA) === normalizeTurbosType(coinTypeA)
    && normalizeTurbosType(position?.coinTypeB) === normalizeTurbosType(coinTypeB)
    && normalizeTurbosType(position?.feeType) === normalizeTurbosType(feeType)
    && /^0x[0-9a-f]{64}$/i.test(String(position?.positionId || ''));
}
