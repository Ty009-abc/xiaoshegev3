/**
 * lib/config/worldviewV6Model.js
 *
 * RC8.4 V6 — Turnaround Strategy V6 worldview MODEL selector.
 *
 * Introduces an explicit V6-only model configuration so the V6 worldview
 * draft can NEVER silently inherit AI_MODEL_PRO (which is a reasoning-tier
 * tag and produced empty/verbose output — the R10 finding).
 *
 * Env:
 *   RC84_V6_WORLDVIEW_MODEL = <provider model tag>   (optional)
 *
 * Priority:
 *   RC84_V6_WORLDVIEW_MODEL  →  safe V6-local default (V6_DEFAULT_MODEL)
 *
 *   AI_MODEL_PRO / AI_MODEL_FLASH are NEVER consulted for the V6 default.
 *
 * Fail-closed: missing / blank / non-string → V6_DEFAULT_MODEL.
 * This module is a pure parser — no runtime execution, no DB, no network.
 *
 * @version turnaround_strategy_v6
 */

const V6_WORLDVIEW_MODEL_ENV = 'RC84_V6_WORLDVIEW_MODEL'

// Safe V6-local default. Deliberately NOT AI_MODEL_PRO.
const V6_DEFAULT_MODEL = 'deepseek-flash'

/**
 * Resolve the V6 worldview model.
 * @param {*} raw   raw env value (RC84_V6_WORLDVIEW_MODEL)
 * @returns {string} non-empty model tag (never AI_MODEL_PRO)
 */
function parseV6WorldviewModel (raw) {
  if (!raw || typeof raw !== 'string') return V6_DEFAULT_MODEL
  const m = raw.trim()
  if (m === '') return V6_DEFAULT_MODEL
  return m
}

function getV6WorldviewModelFromEnv () {
  try { return parseV6WorldviewModel(process.env[V6_WORLDVIEW_MODEL_ENV]) } catch (e) { return V6_DEFAULT_MODEL }
}

module.exports = {
  V6_WORLDVIEW_MODEL_ENV,
  V6_DEFAULT_MODEL,
  parseV6WorldviewModel,
  getV6WorldviewModelFromEnv,
}
