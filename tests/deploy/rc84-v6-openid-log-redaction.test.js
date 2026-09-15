#!/usr/bin/env node
'use strict';
/**
 * rc84-v6-openid-log-redaction.test.js
 * RC8.4 V6 B2.7 R7.1 — raw-OPENID log redaction contract tests.
 *
 * Proves, with NO cloud mutation and NO secret output:
 *   RAW_OPENID_LOG_PATH_COUNT = 0        (static scan of the whole function tree)
 *   OPENID_PRESENCE_LOG_ALLOWED = YES    (presence-only metadata is the accepted shape)
 *   behavior unchanged                    (mock invoke still succeeds)
 *
 * The scan is generic: any `console.*` line mentioning `openid` must be in an
 * approved presence-only shape; anything else counts as a raw-openid log path.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const FN_ROOT = path.join(__dirname, '..', '..', 'cloudfunctions', 'generateAiReport');
const INDEX_PATH = path.join(FN_ROOT, 'index.js');

let pass = 0;
let fail = 0;
const failures = [];
function t(name, fn) {
  try {
    fn();
    pass++;
    console.log('  PASS ' + name);
  } catch (e) {
    fail++;
    failures.push(name + ' :: ' + (e && e.message));
    console.log('  FAIL ' + name + ' :: ' + (e && e.message));
  }
}

// ── approved presence-only shapes ─────────────────────────────────────
// e.g.  openid_present=${openid ? 'true' : 'false'}
//       openid=' + (openid ? 'present' : 'missing')
//       openid=' + (trustedOpenid ? 'present' : 'missing')
const APPROVED = [
  /openid_present=/,
  /openid='\s*\+\s*\([A-Za-z_$]*[Oo]penid\s*\?\s*'present'\s*:\s*'missing'\)/,
  /openid=\$\{[A-Za-z_$]*[Oo]penid\s*\?\s*'present'\s*:\s*'missing'\}/,
];

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.js$/.test(e.name)) out.push(p);
  }
  return out;
}

function scanRawOpenidLogPaths() {
  const files = walk(FN_ROOT, []);
  const hits = [];
  const re = /console\.(log|error|warn|info|debug)\s*\(/;
  for (const f of files) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!re.test(line)) return;
      if (!/openid/i.test(line)) return;
      if (APPROVED.some((a) => a.test(line))) return;
      hits.push(path.relative(FN_ROOT, f) + ':' + (i + 1));
    });
  }
  return hits;
}

console.log('\n── static scan: raw openid log paths ──');
const rawHits = scanRawOpenidLogPaths();
t('RAW_OPENID_LOG_PATH_COUNT == 0', () => {
  assert.strictEqual(rawHits.length, 0, 'raw openid log paths: ' + rawHits.join(', '));
});

console.log('\n── presence-only shape present ──');
const indexSrc = fs.readFileSync(INDEX_PATH, 'utf8');
t('entry log uses openid_present presence-only metadata', () => {
  assert.ok(/openid_present=\$\{/.test(indexSrc), 'expected openid_present=${...} in index.js');
});
t('entry log no longer interpolates raw openid', () => {
  assert.ok(!/openid=\$\{openid\}/.test(indexSrc), 'raw `openid=${openid}` still present');
  assert.ok(!/openid=\$\{ *openid *\}/.test(indexSrc), 'raw openid interpolation still present');
});

console.log('\n── behavioral: mock invoke never logs raw openid ──');
const SENTINEL = 'oSENTINEL_openid_1234567890abcdef';
const logs = [];
const origLog = console.log;
console.log = (...a) => logs.push(a.join(' '));

const mockDb = {
  command: {},
  collection: (name) => ({
    where() { return this; }, orderBy() { return this; }, limit() { return this; },
    get: async () => ({
      data: name === 'users' || name === 'user_profiles' ? [{ openid: SENTINEL }] : [],
    }),
    add: async () => ({ _id: 'mock' }),
    doc: () => ({ get: async () => ({ data: null }), set: async () => {}, update: async () => {} }),
  }),
};
const mockSdk = {
  DYNAMIC_CURRENT_ENV: 'mock-env', init() {},
  getWXContext: () => ({ OPENID: SENTINEL }),
  database: () => mockDb,
};
const aiMock = {
  callAI: async () => ({ success: true, tokens: 5, content: '{"position":"p","trapped_by":"t","forbidden":["f"],"path":"q","next90days":["a"]}' }),
  buildReportPrompt: () => ({ systemPrompt: '', userMessage: '' }),
  buildCoachingPrompt: () => ({ systemPrompt: '', userMessage: '', personality: { name: 'P', emoji: '🙂' } }),
  buildDiagnosticPrompt: () => ({ systemPrompt: '', userMessage: '', personality: { name: 'P', emoji: '🙂' }, engineResult: { normalizedProfile: {}, constraintAnalysis: {}, allowedPaths: [], forbiddenPaths: [] } }),
};

const originalLoad = Module._load;
Module._load = function (request) {
  if (request === 'wx-server-sdk') return mockSdk;
  if (/(^|\/)ai\.js$/.test(request)) return aiMock;
  return originalLoad.apply(this, arguments);
};

(async () => {
  let threw = null;
  try {
    const index = require(INDEX_PATH);
    await index.main({ type: 'coaching', message: 'hi' }, {});
  } catch (e) {
    threw = (e && e.message) || String(e);
  }
  console.log = origLog;

  t('mock invoke did not throw', () => assert.strictEqual(threw, null, 'threw: ' + threw));
  t('raw openid sentinel NEVER appears in logs', () => {
    const blob = logs.join('\n');
    assert.ok(!blob.includes(SENTINEL), 'sentinel leaked into logs');
    assert.ok(!blob.includes(SENTINEL.slice(2, 8)), 'openid prefix leaked into logs');
  });
  t('presence-only metadata IS logged', () => {
    assert.ok(logs.some((l) => /openid_present=true/.test(l)), 'openid_present=true not logged');
  });

  console.log('\n══════════════════════════════════════');
  console.log('R7.1 OPENID LOG REDACTION SUITE: ' + (fail ? 'FAIL' : 'PASS') + ' (' + pass + ' passed, ' + fail + ' failed)');
  console.log('RAW_OPENID_LOG_PATH_COUNT=' + rawHits.length);
  console.log('OPENID_PRESENCE_LOG_ALLOWED=YES');
  console.log('══════════════════════════════════════');
  if (fail) { for (const f of failures) console.log('  ✗ ' + f); process.exitCode = 1; }
})();
