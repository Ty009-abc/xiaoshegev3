/**
 * lib/config/worldviewV6Mode.js
 *
 * RC8.4 V6 — Turnaround Strategy V6 worldview runtime mode parser.
 *
 * Independent from every other mode/allowlist in this project:
 *   - world_model_v1  (worldModelWhitelist.js / rolloutMode.js)
 *   - world_model_v2  (worldModelV2Mode.js)
 *   - world_model_v2_1 (worldModelV21Mode.js)
 * V6 is NEVER controlled by the V1/V2/V2.1 MODE or allowlist.
 *
 * Env:
 *   RC84_V6_WORLDVIEW_MODE = OFF | SHADOW | ON
 *
 * Fail-closed: missing / malformed / empty / non-string → OFF.
 * `ON` is PARSED (so a future owner-authorized task can flip it) but this task
 * never sets it; default is OFF and OFF is the production-safe state.
 *
 * This module is a pure parser — no runtime execution, no DB, no network,
 * no persistence, no user-visible mutation.
 *
 * @version turnaround_strategy_v6
 */

const V6_WORLDVIEW_MODE_ENV = 'RC84_V6_WORLDVIEW_MODE'

// Closed allowed-mode set.
const V6_ALLOWED_MODES = Object.freeze(['OFF', 'SHADOW', 'ON'])

const V6_DEFAULT_MODE = 'OFF'

/**
 * Parse a raw V6 worldview mode value. Fail-closed to OFF.
 * @param {*} raw raw env value
 * @returns {'OFF'|'SHADOW'|'ON'}
 */
function parseV6WorldviewMode (raw) {
  if (!raw || typeof raw !== 'string') return V6_DEFAULT_MODE
  const mode = raw.trim().toUpperCase()
  if (mode === 'SHADOW') return 'SHADOW'
  if (mode === 'ON') return 'ON'
  // OFF or any invalid / empty value → OFF (fail-closed).
  return V6_DEFAULT_MODE
}

function getV6WorldviewModeFromEnv () {
  try { return process.env[V6_WORLDVIEW_MODE_ENV] || V6_DEFAULT_MODE } catch (e) { return V6_DEFAULT_MODE }
}

module.exports = {
  V6_WORLDVIEW_MODE_ENV,
  V6_ALLOWED_MODES,
  V6_DEFAULT_MODE,
  parseV6WorldviewMode,
  getV6WorldviewModeFromEnv,
}
