#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/secret-clobber-guard.test.js
 *
 * RC8.9B_P0_SECRET_CLOBBER_GUARD — deploy-gate contract.
 *
 *  1. placeholder secret in config => guard FAILS (blocks deploy)
 *  2. committed real secret in config => guard FAILS
 *  3. partial secret env block => guard FAILS (would delete live secret)
 *  4. secret-managed (no env block) config => guard PASSES
 *  5. shipped cloudbaserc.json carries NO placeholder/committed secrets
 *  6. secret-bearing functions ship NO envVariables block (cloud-side secrets)
 *  7. guard diagnostics never echo secret VALUES (key names only)
 *  8. guard CLI + deploy wrapper exist and are wired fail-closed
 *
 * Node built-ins only. Runnable from repo root.
 */

const path = require('path')
const fs = require('fs')
const { execFileSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..', '..')
const guard = require(path.join(ROOT, 'scripts', 'lib', 'secret-guard.js'))

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const read = (p) => fs.readFileSync(p, 'utf8')

console.log('RC8.9B_P0 secret-clobber guard')

// ── 1: placeholder secret → BLOCK ─────────────────────────────────────────
{
  const issues = guard.scanFunction({ name: 'generateAiReport', envVariables: { AI_API_KEY: '<YOUR_AI_API_KEY>' } })
  ok(issues.length === 1 && issues[0].reason === 'PLACEHOLDER_SECRET_VALUE', '1: <YOUR_AI_API_KEY> flagged PLACEHOLDER_SECRET_VALUE')
  ok(guard.scanFunction({ name: 'x', envVariables: { AI_API_KEY: 'YOUR_API_KEY' } }).length === 1, '1b: YOUR_API_KEY flagged')
  ok(guard.scanFunction({ name: 'x', envVariables: { AI_API_KEY: 'placeholder' } }).length === 1, '1c: "placeholder" flagged')
  ok(guard.scanFunction({ name: 'x', envVariables: { AI_API_KEY: 'changeme' } }).length === 1, '1d: "changeme" flagged')
  ok(guard.scanFunction({ name: 'x', envVariables: { AI_API_KEY: '' } }).length === 1, '1e: empty secret flagged')
  ok(guard.scanFunction({ name: 'createOrder', envVariables: { WXPAY_PRIVATE_KEY: '<NEED_PRIVATE_KEY>' } }).some((i) => i.reason === 'PLACEHOLDER_SECRET_VALUE'), '1f: <NEED_PRIVATE_KEY> flagged placeholder')
}

// ── 2: committed real secret → BLOCK ──────────────────────────────────────
{
  const issues = guard.scanFunction({ name: 'generateAiReport', envVariables: { AI_API_KEY: 'sk-' + 'a'.repeat(32) } })
  ok(issues.length === 1 && issues[0].reason === 'COMMITTED_SECRET_VALUE', '2: committed real secret flagged COMMITTED_SECRET_VALUE')
}

// ── 3: partial secret env → BLOCK (wholesale replace would delete the key) ─
{
  const issues = guard.scanFunction({ name: 'generateAiReport', envVariables: { AI_MODEL_PRO: 'deepseek-chat' } })
  ok(issues.some((i) => i.reason === 'PARTIAL_SECRET_ENV'), '3: partial secret env flagged PARTIAL_SECRET_ENV')
  const okFn = guard.scanFunction({ name: 'generateAiReport', envVariables: { AI_API_KEY: 'sk-' + 'b'.repeat(30), AI_MODEL_PRO: 'deepseek-chat' } })
  ok(!okFn.some((i) => i.reason === 'PARTIAL_SECRET_ENV'), '3b: full secret env not partial (but still COMMITTED)')
}

// ── 4: secret-managed config (no env block) → PASS ────────────────────────
{
  const clean = { functions: [{ name: 'generateAiReport', timeout: 60 }, { name: 'adminGetDashboard' }] }
  ok(guard.scanConfig(clean).length === 0, '4: env-free config scans clean (deploy allowed)')
  // non-secret env on a NON-secret-bearing function is allowed
  const pub = { functions: [{ name: 'getProductList', envVariables: { SOME_BASE_URL: 'https://x', MODEL: 'y' } }] }
  ok(guard.scanConfig(pub).length === 0, '4b: public non-secret env on non-secret fn allowed')
  // a non-secret-ONLY block on a SECRET-BEARING fn is STILL blocked (wholesale replace would delete the secret)
  ok(guard.scanConfig({ functions: [{ name: 'generateAiReport', envVariables: { AI_API_BASE_URL: 'https://api.deepseek.com/v1' } }] }).some((i) => i.reason === 'PARTIAL_SECRET_ENV'), '4c: non-secret-only block on secret fn blocked (would delete AI_API_KEY)')
}

// ── 5: SHIPPED config carries no placeholder/committed secret ─────────────
{
  const cfg = JSON.parse(read(path.join(ROOT, 'cloudbaserc.json')))
  const issues = guard.scanConfig(cfg)
  ok(issues.length === 0, `5: shipped cloudbaserc.json clean (${issues.length} issues)`)
  ok(!/YOUR_|NEED_|FILL_ME|placeholder|changeme/i.test(read(path.join(ROOT, 'cloudbaserc.json'))), '5b: no placeholder tokens remain in config')
}

// ── 6: secret-bearing functions ship NO envVariables block ────────────────
{
  const cfg = JSON.parse(read(path.join(ROOT, 'cloudbaserc.json')))
  const names = Object.keys(guard.SECRET_BEARING)
  let withEnv = 0
  for (const n of names) {
    const fn = (cfg.functions || []).find((f) => f.name === n)
    if (fn && fn.envVariables) withEnv++
  }
  ok(withEnv === 0, `6: no secret-bearing function ships an envVariables block (${withEnv})`)
}

// ── 7: guard never echoes secret VALUES ───────────────────────────────────
{
  const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'check-secrets.js'), '--config', path.join(ROOT, 'cloudbaserc.json')], { encoding: 'utf8' })
  ok(/deploy allowed/.test(out), '7: clean config → CLI prints deploy-allowed')
  // build a temp config with a sentinel secret value and confirm it is NOT echoed
  const os = require('os')
  const tmp = path.join(os.tmpdir(), 'guard-echo-test.json')
  const SENTINEL = 'sk-' + 'z'.repeat(40)
  fs.writeFileSync(tmp, JSON.stringify({ functions: [{ name: 'generateAiReport', envVariables: { AI_API_KEY: SENTINEL } }] }))
  let cliOut = '', code = 0
  try {
    cliOut = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'check-secrets.js'), '--config', tmp], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e) {
    code = e.status
    cliOut = (e.stdout || '') + (e.stderr || '')
  }
  fs.unlinkSync(tmp)
  ok(code === 1, `7b: guard CLI exits 1 on committed secret (${code})`)
  ok(!cliOut.includes(SENTINEL), '7c: guard CLI NEVER echoes the secret value')
  ok(/AI_API_KEY/.test(cliOut), '7d: guard CLI reports the key NAME')
}

// ── 8: guard CLI + deploy wrapper wired fail-closed ───────────────────────
{
  ok(fs.existsSync(path.join(ROOT, 'scripts', 'check-secrets.js')), '8: check-secrets.js present')
  const wrapper = path.join(ROOT, 'scripts', 'deploy-generateAiReport.sh')
  ok(fs.existsSync(wrapper), '8b: deploy-generateAiReport.sh present')
  const w = read(wrapper)
  ok(/check-secrets\.js/.test(w), '8c: wrapper calls secret guard BEFORE deploy')
  ok(/generateAiReport/.test(w), '8d: wrapper targets generateAiReport')
  // guard must run before any `tcb fn deploy`
  const guardIdx = w.indexOf('check-secrets.js')
  const deployIdx = w.indexOf('tcb fn deploy "$FN_NAME"')
  ok(guardIdx > 0 && deployIdx > 0 && guardIdx < deployIdx, '8e: guard runs before tcb fn deploy')
}

console.log(`  _TEST pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
