#!/usr/bin/env node
'use strict';
/**
 * rc84-v6-env-merge.test.js
 * RC8.4 V6 B2.7 R5 — merge-safe env injector contract tests.
 *
 * Proves, with NO cloud mutation and NO secret output:
 *   REMOTE_EXISTING_KEY_PRESERVED
 *   RC83_KEYS_PRESERVED
 *   UNRELATED_REMOTE_KEY_PRESERVED
 *   LOCAL_AI_VALUES_OVERRIDE_REMOTE
 *   LOCAL_RC84_MODE_OVERRIDE_REMOTE
 *   LOCAL_RC84_ALLOWLIST_OVERRIDE_REMOTE
 *   MISSING_AI_KEY_FAILS / MISSING_BASE_URL_FAILS / MISSING_MODEL_FLASH_FAILS / MISSING_MODEL_PRO_FAILS
 *   INVALID_MODE_FAILS
 *   SHADOW_WITH_EMPTY_ALLOWLIST_FAILS
 *   SECRET_NOT_LOGGED / OPENID_NOT_LOGGED
 *   PAYMENT_ENV_NOT_TOUCHED
 */

const assert = require('assert');
const path = require('path');
const {
  parseRemoteVariables,
  mergeFunctionEnv,
  validateLocalEnv,
  pickLocalDeploymentValues,
  allowlistCount,
  isSensitive,
} = require(path.join(__dirname, '..', '..', 'scripts', 'lib', 'merge-function-env.js'));

let pass = 0;
let fail = 0;
const failures = [];
function t(name, fn) {
  try {
    fn();
    pass++;
  } catch (e) {
    fail++;
    failures.push(name + ' :: ' + e.message);
  }
}

// A faithful sample of the real remote map (11 keys incl. 6 RC83_* keys).
const REMOTE_DETAIL = {
  data: {
    Environment: {
      Variables: [
        { Key: 'AI_API_KEY', Value: 'PLACEHOLDER' },
        { Key: 'AI_API_BASE_URL', Value: 'https://api.deepseek.com/v1' },
        { Key: 'AI_MODEL_FLASH', Value: 'deepseek-chat' },
        { Key: 'AI_MODEL_PRO', Value: 'deepseek-chat' },
        { Key: 'RC83_WORLD_MODEL_MODE', Value: 'SHADOW' },
        { Key: 'RC83_WORLD_MODEL_ALLOWLIST', Value: 'oX1,oX2' },
        { Key: 'RC83_WORLD_MODEL_V2_MODE', Value: 'SHADOW' },
        { Key: 'RC83_WORLD_MODEL_V2_ALLOWLIST', Value: 'oX1' },
        { Key: 'RC83_WORLD_MODEL_V2_1_MODE', Value: 'SHADOW' },
        { Key: 'RC83_V21_COGNITIVE_PREVIEW_ENABLED', Value: 'ENABLED' },
        { Key: 'RC83_V21_COGNITIVE_PREVIEW_ALLOWLIST', Value: 'oX1,oX2' },
      ],
    },
  },
};

const LOCAL = {
  AI_API_KEY: 'LOCALKEY',
  AI_API_BASE_URL: 'https://api.deepseek.com/v1',
  AI_MODEL_FLASH: 'deepseek-chat',
  AI_MODEL_PRO: 'deepseek-chat',
  RC84_V6_WORLDVIEW_MODE: 'OFF',
  RC84_V6_SHADOW_ALLOWLIST: 'oTEST1',
};

const RC83_KEYS = [
  'RC83_WORLD_MODEL_MODE',
  'RC83_WORLD_MODEL_ALLOWLIST',
  'RC83_WORLD_MODEL_V2_MODE',
  'RC83_WORLD_MODEL_V2_ALLOWLIST',
  'RC83_WORLD_MODEL_V2_1_MODE',
  'RC83_V21_COGNITIVE_PREVIEW_ENABLED',
  'RC83_V21_COGNITIVE_PREVIEW_ALLOWLIST',
];

// ── parse ─────────────────────────────────────────────────────────────
t('parseRemoteVariables reads data.Environment.Variables', () => {
  const m = parseRemoteVariables(REMOTE_DETAIL);
  assert.strictEqual(Object.keys(m).length, 11);
  assert.strictEqual(m.AI_API_BASE_URL, 'https://api.deepseek.com/v1');
});
t('parseRemoteVariables tolerates object map', () => {
  const m = parseRemoteVariables({ Environment: { Variables: { A: '1', B: '2' } } });
  assert.deepStrictEqual(m, { A: '1', B: '2' });
});
t('parseRemoteVariables returns {} on junk', () => {
  assert.deepStrictEqual(parseRemoteVariables(null), {});
  assert.deepStrictEqual(parseRemoteVariables({}), {});
});

// ── REMOTE_EXISTING_KEY_PRESERVED ─────────────────────────────────────
t('REMOTE_EXISTING_KEY_PRESERVED', () => {
  const remote = parseRemoteVariables(REMOTE_DETAIL);
  const { merged, lostKeys } = mergeFunctionEnv(remote, LOCAL);
  for (const k of Object.keys(remote)) {
    assert.ok(Object.prototype.hasOwnProperty.call(merged, k), 'lost ' + k);
  }
  assert.strictEqual(lostKeys.length, 0);
});

// ── RC83_KEYS_PRESERVED ───────────────────────────────────────────────
t('RC83_KEYS_PRESERVED', () => {
  const remote = parseRemoteVariables(REMOTE_DETAIL);
  const { merged } = mergeFunctionEnv(remote, LOCAL);
  for (const k of RC83_KEYS) {
    assert.ok(Object.prototype.hasOwnProperty.call(merged, k), 'lost RC83 key ' + k);
    assert.strictEqual(merged[k], remote[k]);
  }
});

// ── UNRELATED_REMOTE_KEY_PRESERVED ────────────────────────────────────
t('UNRELATED_REMOTE_KEY_PRESERVED', () => {
  const remote = parseRemoteVariables(REMOTE_DETAIL);
  remote.SOME_UNRELATED_FUTURE_KEY = 'keepme';
  const { merged } = mergeFunctionEnv(remote, LOCAL);
  assert.strictEqual(merged.SOME_UNRELATED_FUTURE_KEY, 'keepme');
});

// ── LOCAL_AI_VALUES_OVERRIDE_REMOTE ───────────────────────────────────
t('LOCAL_AI_VALUES_OVERRIDE_REMOTE', () => {
  const remote = parseRemoteVariables(REMOTE_DETAIL);
  const { merged } = mergeFunctionEnv(remote, LOCAL);
  assert.strictEqual(merged.AI_API_KEY, 'LOCALKEY');
  assert.strictEqual(merged.AI_API_BASE_URL, 'https://api.deepseek.com/v1');
});

// ── LOCAL_RC84_MODE_OVERRIDE_REMOTE ───────────────────────────────────
t('LOCAL_RC84_MODE_OVERRIDE_REMOTE', () => {
  const remote = parseRemoteVariables(REMOTE_DETAIL);
  remote.RC84_V6_WORLDVIEW_MODE = 'ON'; // stale remote value
  const { merged } = mergeFunctionEnv(remote, LOCAL);
  assert.strictEqual(merged.RC84_V6_WORLDVIEW_MODE, 'OFF');
});

// ── LOCAL_RC84_ALLOWLIST_OVERRIDE_REMOTE ──────────────────────────────
t('LOCAL_RC84_ALLOWLIST_OVERRIDE_REMOTE', () => {
  const remote = parseRemoteVariables(REMOTE_DETAIL);
  remote.RC84_V6_SHADOW_ALLOWLIST = 'olds1,olds2';
  const { merged } = mergeFunctionEnv(remote, LOCAL);
  assert.strictEqual(merged.RC84_V6_SHADOW_ALLOWLIST, 'oTEST1');
});

// ── loss guard ────────────────────────────────────────────────────────
t('merge loses no remote key when overlay is a strict superset', () => {
  const remote = { A: '1', B: '2', C: '3' };
  const { merged, lostKeys } = mergeFunctionEnv(remote, { B: 'x' });
  assert.deepStrictEqual(lostKeys, []);
  assert.deepStrictEqual(merged, { A: '1', B: 'x', C: '3' });
});

// ── validateLocalEnv: required AI keys ────────────────────────────────
for (const [key, code] of [
  ['AI_API_KEY', 'MISSING_AI_API_KEY'],
  ['AI_API_BASE_URL', 'MISSING_AI_API_BASE_URL'],
  ['AI_MODEL_FLASH', 'MISSING_AI_MODEL_FLASH'],
  ['AI_MODEL_PRO', 'MISSING_AI_MODEL_PRO'],
]) {
  t(code + '_FAILS', () => {
    const env = Object.assign({}, LOCAL);
    delete env[key];
    const r = validateLocalEnv(env);
    assert.strictEqual(r.ok, false);
    assert.ok(r.errors.includes(code), 'expected ' + code + ' got ' + r.errors.join(','));
  });
}
t('MISSING_AI_KEY_EMPTY_FAILS', () => {
  const env = Object.assign({}, LOCAL, { AI_API_KEY: '   ' });
  const r = validateLocalEnv(env);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.includes('MISSING_AI_API_KEY'));
});

// ── INVALID_MODE_FAILS ────────────────────────────────────────────────
t('INVALID_MODE_FAILS', () => {
  const env = Object.assign({}, LOCAL, { RC84_V6_WORLDVIEW_MODE: 'TURBO' });
  const r = validateLocalEnv(env);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.includes('INVALID_RC84_V6_WORLDVIEW_MODE'));
});
t('MISSING_MODE_FAILS', () => {
  const env = Object.assign({}, LOCAL);
  delete env.RC84_V6_WORLDVIEW_MODE;
  const r = validateLocalEnv(env);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.includes('MISSING_RC84_V6_WORLDVIEW_MODE'));
});
t('VALID_MODES_ACCEPTED', () => {
  for (const m of ['OFF', 'SHADOW', 'ON']) {
    const env = Object.assign({}, LOCAL, { RC84_V6_WORLDVIEW_MODE: m, RC84_V6_SHADOW_ALLOWLIST: 'o1' });
    assert.strictEqual(validateLocalEnv(env).ok, true, 'mode ' + m + ' should pass');
  }
});

// ── SHADOW_WITH_EMPTY_ALLOWLIST_FAILS ─────────────────────────────────
t('SHADOW_WITH_EMPTY_ALLOWLIST_FAILS', () => {
  const env = Object.assign({}, LOCAL, { RC84_V6_WORLDVIEW_MODE: 'SHADOW', RC84_V6_SHADOW_ALLOWLIST: '' });
  const r = validateLocalEnv(env);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.includes('SHADOW_WITH_EMPTY_ALLOWLIST'));
});
t('ON_WITH_EMPTY_ALLOWLIST_FAILS', () => {
  const env = Object.assign({}, LOCAL, { RC84_V6_WORLDVIEW_MODE: 'ON', RC84_V6_SHADOW_ALLOWLIST: '' });
  assert.strictEqual(validateLocalEnv(env).ok, false);
});
t('OFF_WITH_EMPTY_ALLOWLIST_OK', () => {
  const env = Object.assign({}, LOCAL, { RC84_V6_WORLDVIEW_MODE: 'OFF', RC84_V6_SHADOW_ALLOWLIST: '' });
  assert.strictEqual(validateLocalEnv(env).ok, true);
});

// ── allowlist count without printing entries ──────────────────────────
t('ALLOWLIST_ENTRY_COUNT computed without exposing values', () => {
  assert.strictEqual(allowlistCount('a,b,c'), 3);
  assert.strictEqual(allowlistCount(' a , b ,, c '), 3);
  assert.strictEqual(allowlistCount(''), 0);
  assert.strictEqual(allowlistCount('   '), 0);
  assert.strictEqual(allowlistCount(undefined), 0);
});

// ── SECRET_NOT_LOGGED / OPENID_NOT_LOGGED ─────────────────────────────
t('SECRET_NOT_LOGGED / OPENID_NOT_LOGGED (sensitive-key classifier)', () => {
  assert.ok(isSensitive('AI_API_KEY'));
  assert.ok(isSensitive('WXPAY_API_V3_KEY'));
  assert.ok(isSensitive('RC84_V6_SHADOW_ALLOWLIST'));
  assert.ok(isSensitive('FOO_OPENID'));
  assert.strictEqual(isSensitive('AI_MODEL_FLASH'), false);
});
t('report diagnostics never contain a secret VALUE', () => {
  // Reconstruct the diagnostics line the CLI emits and assert no value leaks.
  const remote = parseRemoteVariables(REMOTE_DETAIL);
  const { merged, overriddenKeys, addedKeys, lostKeys } = mergeFunctionEnv(remote, LOCAL);
  const v = validateLocalEnv(LOCAL);
  const line = [
    'remote_env_key_count=' + Object.keys(remote).length,
    'merged_env_key_count=' + Object.keys(merged).length,
    'remote_env_key_loss_count=' + lostKeys.length,
    'overlay_overridden_keys=' + overriddenKeys.slice().sort().join(','),
    'overlay_added_keys=' + addedKeys.slice().sort().join(','),
    'mode=' + v.mode,
    'allowlist_entry_count=' + v.allowlistEntryCount,
  ].join(' | ');
  assert.ok(!line.includes(LOCAL.AI_API_KEY), 'AI key value leaked');
  assert.ok(!line.includes(LOCAL.RC84_V6_SHADOW_ALLOWLIST), 'allowlist value leaked');
  assert.ok(line.includes('mode=OFF'));
  assert.ok(line.includes('allowlist_entry_count=1'));
});

// ── pickLocalDeploymentValues ─────────────────────────────────────────
t('pickLocalDeploymentValues selects exactly the 6 keys', () => {
  const picked = pickLocalDeploymentValues(Object.assign({}, LOCAL, { UNRELATED: 'x' }));
  assert.deepStrictEqual(
    Object.keys(picked).sort(),
    ['AI_API_BASE_URL', 'AI_API_KEY', 'AI_MODEL_FLASH', 'AI_MODEL_PRO',
      'RC84_V6_SHADOW_ALLOWLIST', 'RC84_V6_WORLDVIEW_MODE'].sort()
  );
  assert.ok(!('UNRELATED' in picked));
});

// ── PAYMENT_ENV_NOT_TOUCHED ───────────────────────────────────────────
t('PAYMENT_ENV_NOT_TOUCHED (no WXPAY_* key ever added/overlaid)', () => {
  const remote = parseRemoteVariables(REMOTE_DETAIL);
  const { merged, addedKeys } = mergeFunctionEnv(remote, LOCAL);
  for (const k of Object.keys(merged)) {
    assert.ok(!/^WXPAY_/.test(k), 'payment key present: ' + k);
  }
  for (const k of addedKeys) {
    assert.ok(!/^WXPAY_/.test(k), 'payment key added: ' + k);
  }
});

// ── summary ───────────────────────────────────────────────────────────
console.log('[deploy-env-merge] tests_passed=' + pass + ' tests_failed=' + fail);
if (fail > 0) {
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('[deploy-env-merge] PASS');
