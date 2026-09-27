'use strict'
/**
 * lib/aiPricing.js — RC8.9C_R1A canonical price table + cost calculator.
 *
 * PURE: no network, no DB, no env mutation.
 *
 * SOURCE (CNY, verified 2026-09-27):
 *   https://api-docs.deepseek.com/zh-cn/quick_start/pricing
 *
 * Prices are CNY per 1,000,000 tokens.
 * Peak hours (Beijing time, Mon–Fri, excl. PRC public holidays):
 *   09:00–12:00 and 14:00–18:00  → PEAK  (2× off-peak)
 *   all other hours (incl. weekends/holidays) → OFF_PEAK
 * NOTE: PRC public holidays are NOT modeled (documented approximation; the
 * holiday window is off-peak, so the default PEAK rule can only over-estimate
 * on a holiday weekday — never under-estimate).
 *
 * INPUT_BASIS = CACHE_MISS (conservative: cache-hit input is far cheaper and
 * the cache status is not observable from the response).
 *
 * Cost is an ESTIMATE, not a billing authority. Unknown model / missing usage
 * ⇒ estimatedCostCny = null (NEVER 0).
 */

const PRICE_TABLE_VERSION = 'deepseek-cny-2026-09-27'
const PRICE_SOURCE_URL = 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing'
const INPUT_BASIS = 'CACHE_MISS'
const CURRENCY = 'CNY'

// provider → model → { input:{peak,offPeak}, output:{peak,offPeak} } CNY / 1M tokens
const PROVIDER_TABLE = {
  DeepSeek: {
    // Flash line (V4.1-Flash). Legacy v4-flash names are billed at Flash price.
    'deepseek-flash': { input: { peak: 2, offPeak: 1 }, output: { peak: 8, offPeak: 4 } },
    'deepseek-chat': { input: { peak: 2, offPeak: 1 }, output: { peak: 8, offPeak: 4 } }, // legacy standard-chat alias → Flash tier
    'deepseek-v4-flash': { input: { peak: 2, offPeak: 1 }, output: { peak: 8, offPeak: 4 } },
    'deepseek-v4-flash-vision-exp': { input: { peak: 2, offPeak: 1 }, output: { peak: 8, offPeak: 4 } },
    // Pro line
    'deepseek-v4-pro': { input: { peak: 9, offPeak: 4.5 }, output: { peak: 27, offPeak: 13.5 } },
    'deepseek-v4-pro-0813': { input: { peak: 9, offPeak: 4.5 }, output: { peak: 27, offPeak: 13.5 } },
    'deepseek-reasoner': { input: { peak: 9, offPeak: 4.5 }, output: { peak: 27, offPeak: 13.5 } }, // reasoner tier → Pro pricing
  },
}

/** Beijing (UTC+8) weekday + hour from an epoch-ms timestamp. */
function beijingParts (tsMs) {
  const d = new Date((Number(tsMs) || 0) + 8 * 3600 * 1000)
  return { day: d.getUTCDay(), hour: d.getUTCHours() } // day 0=Sun … 6=Sat
}

function isPeak (tsMs) {
  const { day, hour } = beijingParts(tsMs)
  const weekday = day >= 1 && day <= 5
  if (!weekday) return false
  return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18)
}

/** → { inputPricePer1M, outputPricePer1M, basis, currency } | null (unknown). */
function resolvePrice (provider, model, tsMs) {
  const prov = PROVIDER_TABLE[provider]
  if (!prov) return null
  const entry = prov[String(model || '')]
  if (!entry) return null
  const basis = isPeak(tsMs) ? 'PEAK' : 'OFF_PEAK'
  return {
    inputPricePer1M: basis === 'PEAK' ? entry.input.peak : entry.input.offPeak,
    outputPricePer1M: basis === 'PEAK' ? entry.output.peak : entry.output.offPeak,
    basis,
    currency: CURRENCY,
  }
}

/** round to 6 decimals — preserves any real per-call cost (min ≈ 1e-6). */
function round6 (n) { return Math.round((Number(n) || 0) * 1e6) / 1e6 }

/**
 * @returns {{ estimatedCostCny:number|null, costReason:string|null,
 *   priceBasis:string|null, computedInputPricePer1M:number|null,
 *   computedOutputPricePer1M:number|null, currency:string, priceVersion:string }}
 */
function estimateCostCny ({ provider, model, inputTokens, outputTokens, tsMs }) {
  const hasInput = typeof inputTokens === 'number' && isFinite(inputTokens)
  const hasOutput = typeof outputTokens === 'number' && isFinite(outputTokens)
  if (!hasInput && !hasOutput) {
    return { estimatedCostCny: null, costReason: 'USAGE_MISSING', priceBasis: null, computedInputPricePer1M: null, computedOutputPricePer1M: null, currency: CURRENCY, priceVersion: PRICE_TABLE_VERSION }
  }
  const price = resolvePrice(provider, model, tsMs || Date.now())
  if (!price) {
    return { estimatedCostCny: null, costReason: 'MODEL_NOT_PRICED', priceBasis: null, computedInputPricePer1M: null, computedOutputPricePer1M: null, currency: CURRENCY, priceVersion: PRICE_TABLE_VERSION }
  }
  const inTok = hasInput ? inputTokens : 0
  const outTok = hasOutput ? outputTokens : 0
  const cost = (inTok / 1e6) * price.inputPricePer1M + (outTok / 1e6) * price.outputPricePer1M
  return {
    estimatedCostCny: round6(cost),
    costReason: null,
    priceBasis: price.basis,
    computedInputPricePer1M: price.inputPricePer1M,
    computedOutputPricePer1M: price.outputPricePer1M,
    currency: CURRENCY,
    priceVersion: PRICE_TABLE_VERSION,
  }
}

module.exports = {
  PRICE_TABLE_VERSION,
  PRICE_SOURCE_URL,
  INPUT_BASIS,
  CURRENCY,
  PROVIDER_TABLE,
  beijingParts,
  isPeak,
  resolvePrice,
  round6,
  estimateCostCny,
}
