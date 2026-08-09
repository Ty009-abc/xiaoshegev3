/**
 * lib/config/rolloutMode.js
 *
 * RC8.3 Phase-2 003D — Rollout Mode Configuration.
 *
 * Controls world model execution mode.
 * Default: SHADOW. Fail-closed.
 */
function parseRolloutMode(raw) {
  if (!raw || typeof raw !== 'string') return 'SHADOW'
  var mode = raw.trim().toUpperCase()
  if (mode === 'SELECTIVE_PRIMARY') return 'SELECTIVE_PRIMARY'
  // SHADOW or any invalid value → SHADOW
  return 'SHADOW'
}

function getRolloutModeFromEnv() {
  try { return process.env.RC83_WORLD_MODEL_MODE || 'SHADOW' }
  catch (e) { return 'SHADOW' }
}

module.exports = { parseRolloutMode, getRolloutModeFromEnv }
