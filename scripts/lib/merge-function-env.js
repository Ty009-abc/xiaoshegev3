#!/usr/bin/env node
'use strict';
/**
 * merge-function-env.js
 * ─────────────────────────────────────────────────────────────
 * RC8.4 V6 B2.7 — merge-safe cloud-function ENV injector (pure logic).
 *
 * WHY THIS EXISTS
 *   `tcb config update fn` (and the deprecated `tcb fn config:update`)
 *   applies environment variables in OVERWRITE mode: the cloud set is
 *   replaced wholesale by whatever map is sent. Sending only a partial
 *   map therefore DELETES every key that is not restated.
 *
 *   The old scripts/set-env.sh sent only 4 AI_* keys for generateAiReport,
 *   which would have deleted 6 unrelated RC83_* production keys.
 *
 * STRATEGY (generateAiReport only)
 *   1. read the current remote env map,
 *   2. keep every existing key by default,
 *   3. overlay ONLY the explicitly supplied local deployment values,
 *   4. send the COMPLETE merged map back.
 *
 * SAFETY
 *   - This module never prints values (only key names / counts).
 *   - Keys matching SENSITIVE_RE are reported by name only.
 *   - It is a pure function; it performs no network / no mutation.
 *
 * USAGE (library)
 *   const { mergeFunctionEnv, parseRemoteVariables, validateLocalEnv } = require('./lib/merge-function-env');
 *
 * USAGE (CLI — used by scripts/set-env.sh)
 *   node scripts/lib/merge-function-env.js \
 *        --remote <fn-detail.json> --out <merged-env.json>
 *   # overlay values are read from the process environment.
 *   # prints diagnostics (counts / key names only) to stderr; writes
 *   # the merged env map JSON to --out. Exit != 0 on any validation failure.
 */

const fs = require('fs');

// Keys whose *values* must never be echoed anywhere.
const SENSITIVE_RE = /(KEY|SECRET|PASSWORD|TOKEN|PASS|CREDENTIAL|AUTH|OPENID|ALLOWLIST)/i;

// Local deployment values that must be present & non-empty before any inject.
const REQUIRED_LOCAL_KEYS = [
  'AI_API_KEY',
  'AI_API_BASE_URL',
  'AI_MODEL_FLASH',
  'AI_MODEL_PRO',
];

// Local RC84 V6 keys that are overlaid (may be absent for non-shadow runs,
// but MODE must always be present and valid; allowlist must be non-empty
// whenever MODE != OFF).
const V6_MODE_KEY = 'RC84_V6_WORLDVIEW_MODE';
const V6_ALLOWLIST_KEY = 'RC84_V6_SHADOW_ALLOWLIST';
// R12: optional V6-only worldview model tag. When present in the local deploy
// env it is overlaid (13 → 14 keys); when absent it is left untouched. It is
// NEVER required and NEVER sourced from AI_MODEL_PRO.
const V6_WORLDVIEW_MODEL_KEY = 'RC84_V6_WORLDVIEW_MODEL';
const VALID_MODES = ['OFF', 'SHADOW', 'ON'];

function isSensitive(key) {
  return SENSITIVE_RE.test(String(key));
}

/** Count comma-separated allowlist entries without ever returning the entries. */
function allowlistCount(value) {
  if (value === undefined || value === null) return 0;
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .length;
}

/**
 * Normalise the various possible shapes of `tcb fn detail --json` into a
 * plain { KEY: value } map.
 *   Proven shape on CLI 3.5.9:  data.Environment.Variables = [{Key,Value}, ...]
 *   Also tolerated:             {Environment:{Variables:{K:V}}}, flat {K:V}
 */
function parseRemoteVariables(detail) {
  if (!detail || typeof detail !== 'object') return {};
  const d = detail.data && typeof detail.data === 'object' ? detail.data : detail;
  const vars =
    (d.Environment && d.Environment.Variables) ||
    d.envVariables ||
    null;
  if (!vars) return {};
  const out = {};
  if (Array.isArray(vars)) {
    for (const item of vars) {
      if (item && item.Key !== undefined && item.Key !== null) {
        out[item.Key] = item.Value;
      } else if (item && item.key !== undefined && item.key !== null) {
        out[item.key] = item.value;
      }
    }
  } else if (typeof vars === 'object') {
    Object.assign(out, vars);
  }
  return out;
}

/**
 * Pure merge. `merged` starts as a copy of remote, then every overlay key is
 * applied (overwriting same-name keys). Because remote is the base, no remote
 * key can ever be silently dropped.
 */
function mergeFunctionEnv(remoteEnv, overlayEnv) {
  const remote = remoteEnv && typeof remoteEnv === 'object' ? remoteEnv : {};
  const overlay = overlayEnv && typeof overlayEnv === 'object' ? overlayEnv : {};
  const merged = Object.assign({}, remote);
  const overriddenKeys = [];
  const addedKeys = [];
  for (const key of Object.keys(overlay)) {
    if (overlay[key] === undefined || overlay[key] === null) continue;
    if (Object.prototype.hasOwnProperty.call(remote, key)) overriddenKeys.push(key);
    else addedKeys.push(key);
    merged[key] = overlay[key];
  }
  const lostKeys = Object.keys(remote).filter(
    (k) => !Object.prototype.hasOwnProperty.call(merged, k)
  );
  return { merged, overriddenKeys, addedKeys, lostKeys };
}

/**
 * Fail-closed validation of the local deployment values.
 * Returns { ok, errors, mode, allowlistEntryCount }.
 */
function validateLocalEnv(localEnv) {
  const env = localEnv && typeof localEnv === 'object' ? localEnv : {};
  const errors = [];

  for (const key of REQUIRED_LOCAL_KEYS) {
    const v = env[key];
    if (v === undefined || v === null || String(v).trim() === '') {
      errors.push('MISSING_' + key.replace(/^AI_/, 'AI_').toUpperCase());
    }
  }

  const mode = env[V6_MODE_KEY];
  if (mode === undefined || mode === null || String(mode).trim() === '') {
    errors.push('MISSING_' + V6_MODE_KEY);
  } else if (!VALID_MODES.includes(String(mode).trim())) {
    errors.push('INVALID_' + V6_MODE_KEY);
  }

  const count = allowlistCount(env[V6_ALLOWLIST_KEY]);
  if (mode && String(mode).trim() !== 'OFF' && count < 1) {
    errors.push('SHADOW_WITH_EMPTY_ALLOWLIST');
  }

  return {
    ok: errors.length === 0,
    errors,
    mode: mode === undefined ? undefined : String(mode).trim(),
    allowlistEntryCount: count,
  };
}

/** Extract the local deployment keys (required AI_* + RC84 V6 keys).
 *  RC84_V6_WORLDVIEW_MODEL is OPTIONAL: included only when present. */
function pickLocalDeploymentValues(env) {
  const src = env && typeof env === 'object' ? env : {};
  const keys = REQUIRED_LOCAL_KEYS.concat([V6_MODE_KEY, V6_ALLOWLIST_KEY, V6_WORLDVIEW_MODEL_KEY]);
  const out = {};
  for (const k of keys) {
    if (src[k] !== undefined) out[k] = src[k];
  }
  return out;
}

// ───────────────────────── CLI ─────────────────────────
function parseArgs(argv) {
  const args = { remote: null, out: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--remote') args.remote = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
  }
  return args;
}

/** Diagnostics: KEY NAMES and counts only — never values. */
function reportDiagnostics(tag, remoteEnv, mergedEnv, overriddenKeys, addedKeys, lostKeys, mode, allowlistEntryCount) {
  const lines = [];
  lines.push('[' + tag + '] remote_env_key_count=' + Object.keys(remoteEnv).length);
  lines.push('[' + tag + '] merged_env_key_count=' + Object.keys(mergedEnv).length);
  lines.push('[' + tag + '] remote_env_key_loss_count=' + lostKeys.length);
  lines.push('[' + tag + '] overlay_overridden_keys=' + overriddenKeys.slice().sort().join(','));
  lines.push('[' + tag + '] overlay_added_keys=' + addedKeys.slice().sort().join(','));
  lines.push('[' + tag + '] mode=' + mode);
  lines.push('[' + tag + '] allowlist_entry_count=' + allowlistEntryCount);
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.remote || !args.out) {
    process.stderr.write('usage: merge-function-env.js --remote <fn-detail.json> --out <merged-env.json> [--dry-run]\n');
    process.exit(2);
  }

  let detail;
  try {
    detail = JSON.parse(fs.readFileSync(args.remote, 'utf8'));
  } catch (e) {
    process.stderr.write('❌ cannot read/parse remote detail JSON: ' + e.message + '\n');
    process.exit(3);
  }

  const remoteEnv = parseRemoteVariables(detail);
  const localEnv = pickLocalDeploymentValues(process.env);
  const validation = validateLocalEnv(localEnv);

  if (!validation.ok) {
    process.stderr.write('❌ local deployment env invalid: ' + validation.errors.join(',') + '\n');
    process.exit(4);
  }
  if (Object.keys(remoteEnv).length === 0) {
    process.stderr.write('❌ could not parse any remote env variables (refusing to guess)\n');
    process.exit(5);
  }

  const { merged, overriddenKeys, addedKeys, lostKeys } =
    mergeFunctionEnv(remoteEnv, localEnv);

  if (lostKeys.length !== 0) {
    process.stderr.write('❌ refusing to proceed: remote key loss detected: ' + lostKeys.join(',') + '\n');
    process.exit(6);
  }

  process.stderr.write(
    reportDiagnostics('v6-merge', remoteEnv, merged, overriddenKeys, addedKeys, lostKeys,
      validation.mode, validation.allowlistEntryCount) + '\n'
  );

  if (!args.dryRun) {
    fs.writeFileSync(args.out, JSON.stringify(merged, null, 2) + '\n', { mode: 0o600 });
  }
  process.stdout.write(args.out + '\n');
}

if (require.main === module) {
  main();
}

module.exports = {
  SENSITIVE_RE,
  REQUIRED_LOCAL_KEYS,
  V6_MODE_KEY,
  V6_ALLOWLIST_KEY,
  V6_WORLDVIEW_MODEL_KEY,
  VALID_MODES,
  isSensitive,
  allowlistCount,
  parseRemoteVariables,
  mergeFunctionEnv,
  validateLocalEnv,
  pickLocalDeploymentValues,
};
