/**
 * tools/rc83-stage21-release-safety/lib/configReadback.js
 *
 * W3 — Authoritative Config Readback (read-only abstraction).
 *
 * The SINGLE authoritative source for production runtime mode is the DEPLOYED
 * CloudBase function / control-plane environment. This module is a read-only
 * abstraction that:
 *   - defaults to LOCAL/FIXTURE mode (no production access)
 *   - requires explicit `--live-readonly` opt-in for live readback
 *   - never accepts cloudbaserc.json / local .env / repo config as authority
 *
 * This module does NOT execute config mutation. It does NOT import the live
 * CLI. Live readback is injected by the caller (a CLI adapter) only under
 * explicit opt-in; here we only define the contract and normalization.
 */

'use strict'

var fingerprintLib = require('./fingerprint')

// ── Authority declaration (frozen Stage21 design §3/§5) ──
var PRODUCTION_CONFIG_AUTHORITY = 'DEPLOYED_CLOUDBASE_FUNCTION_ENV'
var NON_AUTHORITIES = ['cloudbaserc.json', 'local .env', 'repository config']

// ── Canonical config shape expected from a live readback ──
var CONFIG_FIELDS = ['environmentId', 'engineMode', 'v2Mode', 'v21Mode', 'allowlistState', 'cohortConfig']

/**
 * Read production config. In LOCAL/FIXTURE mode (default), this returns the
 * provided fixture. Live access is ONLY performed by an injected `liveReader`
 * AND when `opts.liveReadonly === true`.
 *
 * @param {Object} opts
 *   - opts.liveReadonly {boolean} explicit opt-in (default false)
 *   - opts.fixture {Object} local fixture (used when not liveReadonly)
 *   - opts.liveReader {Function} injected reader that performs the actual
 *     control-plane readback (returns a config object). Called only when
 *     liveReadonly === true.
 * @returns {Object} { mode: 'FIXTURE'|'LIVE', config: {...} }
 */
function readProductionConfig(opts) {
  opts = opts || {}
  var liveReadonly = opts.liveReadonly === true
  if (!liveReadonly) {
    if (!opts.fixture || typeof opts.fixture !== 'object') {
      throw new Error('readProductionConfig: LOCAL/FIXTURE mode requires opts.fixture')
    }
    return { mode: 'FIXTURE', config: opts.fixture }
  }
  // Explicit opt-in: live readback via injected reader.
  if (typeof opts.liveReader !== 'function') {
    throw new Error('readProductionConfig: --live-readonly requires opts.liveReader (injected control-plane reader)')
  }
  var live = opts.liveReader()
  if (!live || typeof live !== 'object') {
    throw new Error('readProductionConfig: liveReader returned invalid config')
  }
  return { mode: 'LIVE', config: live }
}

/**
 * Normalize a raw production config into the canonical fingerprint payload.
 * This is the bridge between a live readback and the fingerprint library.
 */
function normalizeProductionConfig(rawConfig) {
  return fingerprintLib.buildConfigFingerprintPayload(rawConfig)
}

/**
 * Compute the authoritative fingerprint from a config object.
 */
function productionConfigFingerprint(rawConfig) {
  return fingerprintLib.fingerprintConfig(rawConfig)
}

module.exports = {
  PRODUCTION_CONFIG_AUTHORITY: PRODUCTION_CONFIG_AUTHORITY,
  NON_AUTHORITIES: NON_AUTHORITIES,
  CONFIG_FIELDS: CONFIG_FIELDS,
  readProductionConfig: readProductionConfig,
  normalizeProductionConfig: normalizeProductionConfig,
  productionConfigFingerprint: productionConfigFingerprint,
}
