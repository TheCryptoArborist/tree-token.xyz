export const CLMM_Q64 = 1n << 64n;
export const CLMM_MIN_TICK = -443_636;
export const CLMM_MAX_TICK = 443_636;

const NEGATIVE_TICK_FACTORS = [
  18_445_821_805_675_392_311n,
  18_444_899_583_751_176_498n,
  18_443_055_278_223_354_162n,
  18_439_367_220_385_604_838n,
  18_431_993_317_065_449_817n,
  18_417_254_355_718_160_513n,
  18_387_811_781_193_591_352n,
  18_329_067_761_203_520_168n,
  18_212_142_134_806_085_854n,
  17_980_523_815_641_551_639n,
  17_526_086_738_831_147_013n,
  16_651_378_430_235_024_244n,
  15_030_750_278_693_429_944n,
  12_247_334_978_882_834_399n,
  8_131_365_268_884_822_000n,
  3_584_323_654_723_342_297n,
  696_457_651_847_595_233n,
  26_294_789_957_452_057n,
  37_481_735_321_082n,
] as const;

const POSITIVE_TICK_FACTORS = [
  79_232_123_823_359_799_118_286_999_567n,
  79_236_085_330_515_764_027_303_304_731n,
  79_244_008_939_048_815_603_706_035_061n,
  79_259_858_533_276_714_757_314_932_305n,
  79_291_567_232_598_584_799_939_703_904n,
  79_355_022_692_464_371_645_785_046_466n,
  79_482_085_999_252_804_386_437_311_141n,
  79_736_823_300_114_093_921_829_183_326n,
  80_248_749_790_819_932_309_965_073_892n,
  81_282_483_887_344_747_381_513_967_011n,
  83_390_072_131_320_151_908_154_828_281n,
  87_770_609_709_833_876_024_991_924_138n,
  97_234_110_755_111_693_312_479_820_773n,
  119_332_217_159_966_728_226_237_229_890n,
  179_736_315_981_702_064_433_883_588_727n,
  407_748_233_172_238_350_107_850_275_304n,
  2_098_478_828_474_011_912_436_660_412_517n,
  55_581_415_166_113_811_149_459_800_483_533n,
  38_992_368_544_603_139_932_233_054_999_993_551n,
] as const;

function parseUnsignedInteger(value: unknown, maximum?: bigint): bigint | null {
  let candidate: unknown = value;
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    candidate = (candidate as Record<string, unknown>).bits;
  }
  if (typeof candidate === 'number') {
    if (!Number.isSafeInteger(candidate) || candidate < 0) return null;
    candidate = String(candidate);
  }
  if (typeof candidate !== 'string' || !/^\d+$/.test(candidate)) return null;
  try {
    const parsed = BigInt(candidate);
    if (maximum !== undefined && parsed > maximum) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseSignedI32(value: unknown): number | null {
  const raw = parseUnsignedInteger(value, 0xffff_ffffn);
  if (raw === null) return null;
  const signed = raw >= 0x8000_0000n ? raw - 0x1_0000_0000n : raw;
  const result = Number(signed);
  return Number.isSafeInteger(result) ? result : null;
}

export function tickToSqrtPriceQ64(tick: number): bigint {
  if (!Number.isSafeInteger(tick) || tick < CLMM_MIN_TICK || tick > CLMM_MAX_TICK) {
    throw new RangeError(`CLMM tick ${tick} is outside [${CLMM_MIN_TICK}, ${CLMM_MAX_TICK}].`);
  }
  const absoluteTick = Math.abs(tick);
  if (tick < 0) {
    let ratio = (absoluteTick & 1) !== 0 ? NEGATIVE_TICK_FACTORS[0] : CLMM_Q64;
    for (let bit = 1; bit < NEGATIVE_TICK_FACTORS.length; bit += 1) {
      if ((absoluteTick & (1 << bit)) !== 0) ratio = ratio * NEGATIVE_TICK_FACTORS[bit] >> 64n;
    }
    return ratio;
  }

  let ratio = (absoluteTick & 1) !== 0
    ? POSITIVE_TICK_FACTORS[0]
    : 79_228_162_514_264_337_593_543_950_336n;
  for (let bit = 1; bit < POSITIVE_TICK_FACTORS.length; bit += 1) {
    if ((absoluteTick & (1 << bit)) !== 0) ratio = ratio * POSITIVE_TICK_FACTORS[bit] >> 96n;
  }
  return ratio >> 32n;
}

function amountXDelta(lower: bigint, upper: bigint, liquidity: bigint): bigint {
  if (liquidity <= 0n || lower <= 0n || upper <= lower) return 0n;
  return liquidity * (upper - lower) * CLMM_Q64 / (lower * upper);
}

function amountYDelta(lower: bigint, upper: bigint, liquidity: bigint): bigint {
  if (liquidity <= 0n || lower <= 0n || upper <= lower) return 0n;
  return liquidity * (upper - lower) / CLMM_Q64;
}

export function amountsForLiquidityQ64(
  currentSqrtPrice: bigint,
  lowerSqrtPrice: bigint,
  upperSqrtPrice: bigint,
  liquidity: bigint,
): { amountX: bigint; amountY: bigint } {
  if (currentSqrtPrice <= 0n || lowerSqrtPrice <= 0n || upperSqrtPrice <= lowerSqrtPrice || liquidity <= 0n) {
    return { amountX: 0n, amountY: 0n };
  }
  if (currentSqrtPrice <= lowerSqrtPrice) {
    return { amountX: amountXDelta(lowerSqrtPrice, upperSqrtPrice, liquidity), amountY: 0n };
  }
  if (currentSqrtPrice >= upperSqrtPrice) {
    return { amountX: 0n, amountY: amountYDelta(lowerSqrtPrice, upperSqrtPrice, liquidity) };
  }
  return {
    amountX: amountXDelta(currentSqrtPrice, upperSqrtPrice, liquidity),
    amountY: amountYDelta(lowerSqrtPrice, currentSqrtPrice, liquidity),
  };
}
