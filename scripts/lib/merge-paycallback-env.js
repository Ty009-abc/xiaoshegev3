#!/usr/bin/env node
'use strict';
/**
 * merge-paycallback-env.js
 * ─────────────────────────────────────────────────────────────
 * RC8_9_PRELAUNCH_P0_PAYMENT_CALLBACK_RECOVERY — merge-safe ENV injector
 * for cloudfunctions/payCallback.
 *
 * WHY
 *   `tcb fn config:update` / `tcb config update fn` apply env in OVERWRITE
 *   mode: the cloud set is replaced wholesale by the map that is sent, so
 *   sending a partial map DELETES every key that is not restated.
 *
 *   The historical set-env.sh sent payCallback ONLY `WXPAY_API_V3_KEY`
 *   (set-env.sh section [4/6]), so the callback had no WXPAY_MCHID /
 *   WXPAY_SERIAL_NO / WXPAY_PUBLIC_KEY / WXPAY_PUBLIC_KEY_ID binding.
 *
 * STRATEGY (fail-closed, value-preserving)
 *   1. read the current remote env map,
 *   2. keep every existing key by default,
 *   3. overlay ONLY the required keys that are supplied locally & non-empty,
 *   4. send the COMPLETE merged map back.
 *   Missing required keys are reported (name only) — never invented, never
 *   rotated, never printed.
 *
 * SAFETY
 *   - never prints values (key names / counts only),
 *   - refuses to proceed on remote key loss,
 *   - pure except for the final --out write (mode 0600, skipped on --dry-run).
 *
 * CLI
 *   PAYCALLBACK_REQUIRED_KEYS="A B C" \
 *     node scripts/lib/merge-paycallback-env.js --remote <fn-detail.json> \
 *       --out <merged-env.json> [--dry-run]
 */

const fs = require('fs');

const SENSITIVE_RE = /(KEY|SECRET|PASSWORD|TOKEN|PASS|CREDENTIAL|AUTH|PRIVATE|CERT|OPENID|ALLOWLIST)/i;

// Default payCallback payment-authority keys (overridable via env).
const DEFAULT_REQUIRED_KEYS = [
  'WXPAY_API_V3_KEY',
  'WXPAY_MCHID',
  'WXPAY_SERIAL_NO',
  'WXPAY_PUBLIC_KEY',
  'WXPAY_PUBLIC_KEY_ID',
];

function requiredKeys() {
  const raw = process.env.PAYCALLBACK_REQUIRED_KEYS;
  const list = (raw ? String(raw).split(/\s+/) : DEFAULT_REQUIRED_KEYS)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return list.length ? list : DEFAULT_REQUIRED_KEYS;
}

/** Normalise the shapes of `tcb fn detail --json` into a { KEY: value } map. */
function parseRemoteVariables(detail) {
  if (!detail || typeof detail !== 'object') return {};
  const d = detail.data && typeof detail.data === 'object' ? detail.data : detail;
  let vars = (d.Environment && d.Environment.Variables) || d.envVariables || null;
  // tolerate DEEP nesting (observed shape: data.Variables = [{Key,Value}])
  if (!vars && d.Variables) vars = d.Variables;
  if (!vars) {
    const found = deepFind(d, 'Variables', 0);
    if (found) vars = found;
  }
  if (!vars) return {};
  const out = {};
  if (Array.isArray(vars)) {
    for (const item of vars) {
      if (item && item.Key !== undefined && item.Key !== null) out[item.Key] = item.Value;
      else if (item && item.key !== undefined && item.key !== null) out[item.key] = item.value;
    }
  } else if (typeof vars === 'object') {
    Object.assign(out, vars);
  }
  return out;
}

function deepFind(obj, key, depth) {
  if (depth > 5 || !obj || typeof obj !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  for (const k of Object.keys(obj)) {
    const r = deepFind(obj[k], key, depth + 1);
    if (r !== null && r !== undefined) return r;
  }
  return null;
}

/** Merge remote (base) with local overlay; never drops a remote key. */
function mergeEnv(remoteEnv, overlayEnv) {
  const remote = remoteEnv && typeof remoteEnv === 'object' ? remoteEnv : {};
  const overlay = overlayEnv && typeof overlayEnv === 'object' ? overlayEnv : {};
  const merged = Object.assign({}, remote);
  const overridden = [];
  const added = [];
  for (const key of Object.keys(overlay)) {
    if (overlay[key] === undefined || overlay[key] === null || String(overlay[key]).trim() === '') continue;
    if (Object.prototype.hasOwnProperty.call(remote, key)) overridden.push(key);
    else added.push(key);
    merged[key] = overlay[key];
  }
  const lost = Object.keys(remote).filter((k) => !Object.prototype.hasOwnProperty.call(merged, k));
  return { merged, overridden, added, lost };
}

/** Overlay only the required keys that are present & non-empty locally. */
function pickOverlay(env, keys) {
  const out = {};
  for (const k of keys) {
    if (env[k] !== undefined && env[k] !== null && String(env[k]).trim() !== '') out[k] = env[k];
  }
  return out;
}

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

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.remote || !args.out) {
    process.stderr.write('usage: merge-paycallback-env.js --remote <fn-detail.json> --out <merged-env.json> [--dry-run]\n');
    process.exit(2);
  }

  let detail;
  try {
    detail = JSON.parse(fs.readFileSync(args.remote, 'utf8'));
  } catch (e) {
    process.stderr.write('❌ cannot read/parse remote detail JSON: ' + e.message + '\n');
    process.exit(3);
  }

  const keys = requiredKeys();
  const remoteEnv = parseRemoteVariables(detail);
  if (Object.keys(remoteEnv).length === 0) {
    process.stderr.write('❌ could not parse any remote env variables (refusing to guess)\n');
    process.exit(5);
  }

  const overlay = pickOverlay(process.env, keys);
  const { merged, overridden, added, lost } = mergeEnv(remoteEnv, overlay);
  if (lost.length !== 0) {
    process.stderr.write('❌ refusing to proceed: remote key loss detected: ' + lost.join(',') + '\n');
    process.exit(6);
  }

  const remoteKeys = Object.keys(remoteEnv);
  const mergedKeys = Object.keys(merged);
  const missing = keys.filter((k) => !Object.prototype.hasOwnProperty.call(merged, k));

  // Diagnostics: key NAMES / counts only — never values.
  const lines = [
    '[paycallback-merge] required_key_count=' + keys.length,
    '[paycallback-merge] remote_env_key_count=' + remoteKeys.length,
    '[paycallback-merge] merged_env_key_count=' + mergedKeys.length,
    '[paycallback-merge] remote_env_key_loss_count=' + lost.length,
    '[paycallback-merge] overlay_overridden_keys=' + overridden.slice().sort().join(','),
    '[paycallback-merge] overlay_added_keys=' + added.slice().sort().join(','),
    '[paycallback-merge] still_missing_required_keys=' + missing.slice().sort().join(','),
  ];
  process.stderr.write(lines.join('\n') + '\n');

  if (missing.length > 0) {
    // fail-closed: do not write an env that cannot satisfy the callback contract
    process.stderr.write('❌ required payment-authority keys unresolved: ' + missing.join(',') +
      ' (provide them in .env.deploy; never invent/rotate)\n');
    process.exit(7);
  }

  if (!args.dryRun) {
    fs.writeFileSync(args.out, JSON.stringify(merged, null, 2) + '\n', { mode: 0o600 });
  }
  process.stdout.write(args.out + '\n');
}

if (require.main === module) main();

module.exports = {
  SENSITIVE_RE,
  DEFAULT_REQUIRED_KEYS,
  parseRemoteVariables,
  mergeEnv,
  pickOverlay,
};
