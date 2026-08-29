/**
 * lib/config/worldModelV21Mode.js
 *
 * RC8.3 Stage20 — World Model V2.1 runtime mode parser.
 *
 * Independent from world_model_v1 config (worldModelWhitelist.js / rolloutMode.js)
 * AND from world_model_v2 config (worldModelV2Mode.js). V2.1 is NEVER controlled
 * by the V1 or V2 MODE / allowlist.
 *
 * Env:
 *   RC83_WORLD_MODEL_V2_1_MODE = OFF | SHADOW
 *
 * Fail-closed: missing / malformed / empty / invalid → OFF.
 * PRIMARY / SELECTIVE_PRIMARY / allowlist are FORBIDDEN (never parsed → OFF).
 *
 * This module is a pure parser — no runtime execution, no DB, no cognition,
 * no persistence, no render, no user-visible mutation.
 *
 * @version world_model_v2_1
 */

const V21_MODE_ENV = 'RC83_WORLD_MODEL_V2_1_MODE'

// Closed allowed-mode set (R0 §1): exactly OFF | SHADOW. No PRIMARY, no allowlist.
const V21_ALLOWED_MODES = Object.freeze(['OFF', 'SHADOW'])

const V21_DEFAULT_MODE = 'OFF'

/**
 * Parse a raw V2.1 mode value. Fail-closed to OFF.
 * Only 'SHADOW' is elevated; OFF and every other value (including PRIMARY /
 * SELECTIVE_PRIMARY) resolve to OFF.
 *
 * @param {*} raw  raw env value (string or otherwise)
 * @returns {'OFF'|'SHADOW'}
 */
function parseV21Mode(raw) {
  if (!raw || typeof raw !== 'string') return 'OFF'
  var mode = raw.trim().toUpperCase()
  if (mode === 'SHADOW') return 'SHADOW'
  // OFF or any invalid / forbidden value → OFF (fail-closed).
  return 'OFF'
}

function getV21ModeFromEnv() {
  try { return process.env[V21_MODE_ENV] || 'OFF' }
  catch (e) { return 'OFF' }
}

module.exports = {
  V21_MODE_ENV,
  V21_ALLOWED_MODES,
  V21_DEFAULT_MODE,
  parseV21Mode,
  getV21ModeFromEnv,
}
