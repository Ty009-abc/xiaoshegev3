/**
 * utils/worldModelLabels.js
 *
 * PAYMENT_STAGE5A_R7 — canonical world-model type PRESENTER (presentation only).
 *
 * Maps the internal enum emitted by the server
 * (`cloudfunctions/startChallenge/lib/scoring.js` → `calcFinalType()`)
 * to a user-facing Chinese label. This is the SINGLE source of truth for
 * challenge `finalType` display; page files MUST NOT inline their own maps.
 *
 * Hard rules:
 *   - PRESENTATION ONLY. Never mutates storage/engine values.
 *   - Every enum emitted by calcFinalType() MUST have a label here.
 *   - Unknown / missing token → generic Chinese fallback.
 *     NEVER fall back to the raw internal enum key.
 *
 * @version world_model_type_v1
 */

// calcFinalType() outputs: strategic | effort_trap | high_risk |
//                          opportunity_hunter | system_thinker | normal_awakened
const WORLD_MODEL_TYPE_LABELS = Object.freeze({
  strategic: '战略型翻身者',
  effort_trap: '努力陷阱型',
  high_risk: '高风险冲动型',
  opportunity_hunter: '机会捕手型',
  system_thinker: '系统思维型',
  normal_awakened: '普通觉醒型',
})

// Generic user-facing label for anything unmapped. NEVER the raw enum.
const WORLD_MODEL_TYPE_FALLBACK = '认知探索者'

/**
 * Resolve a user-facing label for a challenge finalType enum.
 * @param {string} token internal enum (e.g. 'normal_awakened')
 * @returns {string} Chinese display label (never the raw token)
 */
function worldModelTypeLabel (token) {
  if (typeof token !== 'string') return WORLD_MODEL_TYPE_FALLBACK
  const key = token.trim()
  if (!key) return WORLD_MODEL_TYPE_FALLBACK
  return WORLD_MODEL_TYPE_LABELS[key] || WORLD_MODEL_TYPE_FALLBACK
}

/**
 * True when the raw token must NOT be shown to users (i.e. it is an internal
 * enum key that we translate, or an unknown key we replace with the fallback).
 * @param {string} token
 * @returns {boolean}
 */
function isInternalEnum (token) {
  return typeof token === 'string' && Object.prototype.hasOwnProperty.call(WORLD_MODEL_TYPE_LABELS, token.trim())
}

module.exports = {
  WORLD_MODEL_TYPE_LABELS,
  WORLD_MODEL_TYPE_FALLBACK,
  worldModelTypeLabel,
  isInternalEnum,
}
