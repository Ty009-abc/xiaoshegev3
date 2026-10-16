'use strict'
/**
 * RC8_14_D12_R6C_R6_3 — shared freeze-guard helper (TEST-ONLY).
 *
 * Closes the M9 gap: `git diff --name-only <base> -- <scope>` only sees TRACKED
 * changes. A NEW (untracked, non-ignored) payment file, a staged addition, or a
 * dropped safety module would previously slip through. This helper unions:
 *   - tracked modifications AND deletions  (git diff <base>)   [M1..M7]
 *   - staged additions/deletions           (git diff --cached HEAD)
 *   - untracked non-ignored files          (git ls-files --others --exclude-standard) [M9]
 *   - ignored files under scope (excl. node_modules) revealed as an exclusion-risk signal [M11]
 *
 * Protection is preserved (never weakened):
 *   - the SAME <base> and the SAME protected scope are used as before;
 *   - an explicit, exact APPROVED_WRITER allow-list is the ONLY permitted delta;
 *   - any other change (JS module, config file, deletion, signature/amount/CAS/
 *     anti-fraud/signing edit) still fails.
 *
 * This module performs READ-ONLY git queries. It never writes business source.
 */
const { execSync } = require('child_process')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')

// Canonical payment-critical modules that must ALSO be frozen. These live under
// cloudfunctions/common/ and were previously OUTSIDE every rc8.13 guardrail scope
// (order-CAS finalizer, anti-fraud, payment core, payment log, order authority),
// so a modification there would not have tripped any guardrail. Appended
// automatically to every guardrail scope. All are baseline-clean (verified
// unchanged vs 612f1b9 / dec9196 / b19a05d / rc8.11-stage2d-owner-accepted).
const PAYMENT_CRITICAL = [
  'cloudfunctions/common/paymentFinalizer.js',
  'cloudfunctions/common/antiFraud.js',
  'cloudfunctions/common/payment.js',
  'cloudfunctions/common/paymentLog.js',
  'cloudfunctions/common/order.js',
]

// Exact approved writer exception (RC8_14_D12_R6C_R5) — canonical + 5 mirrors.
const APPROVED_WRITER = new Set([
  'cloudfunctions/common/entitlementService.js',
  'cloudfunctions/payCallback/lib/entitlementService.js',
  'cloudfunctions/verifyPayment/lib/entitlementService.js',
  'cloudfunctions/createVirtualOrder/lib/entitlementService.js',
  'cloudfunctions/verifyVirtualPayment/lib/entitlementService.js',
  'cloudfunctions/virtualPayCallback/lib/entitlementService.js',
])

function _git (args, cwd) {
  return execSync('git ' + args, { cwd: cwd || ROOT, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }).toString()
}

// Pathspec magic: never traverse dependency trees (they are not source).
const EXCLUDE_DEPS = "':(exclude,glob)**/node_modules/**' ':(exclude,glob)**/miniprogram_npm/**'"

function _lines (out) {
  return out.split('\n').map((s) => s.trim()).filter(Boolean)
}

/**
 * Collect every in-scope changed path across all three git channels.
 * @param {string} base  commit/tag/sha
 * @param {string[]} scope  protected path prefixes
 */
function collect (base, scope, cwd) {
  const sc = [...scope, ...PAYMENT_CRITICAL].join(' ')
  const tracked = _lines(_git(`diff --name-only ${base} -- ${sc} ${EXCLUDE_DEPS}`, cwd))
  const staged = _lines(_git(`diff --name-only --cached HEAD -- ${sc} ${EXCLUDE_DEPS}`, cwd))
  const untracked = _lines(_git(`ls-files --others --exclude-standard -- ${sc} ${EXCLUDE_DEPS}`, cwd))
  const ignored = _lines(_git(`ls-files --others --ignored --exclude-standard -- ${sc} ${EXCLUDE_DEPS}`, cwd))
    .filter((f) => !/node_modules\//.test(f) && !/miniprogram_npm\//.test(f))
  return { tracked, staged, untracked, ignored }
}

/**
 * In-scope files that are NOT on the approved allow-list. Empty array == PASS.
 */
function unexpectedFiles (base, scope, approved = APPROVED_WRITER, cwd) {
  const { tracked, staged, untracked, ignored } = collect(base, scope, cwd)
  const all = [...new Set([...tracked, ...staged, ...untracked, ...ignored])]
  return all.filter((f) => !approved.has(f)).sort()
}

module.exports = { ROOT, APPROVED_WRITER, PAYMENT_CRITICAL, collect, unexpectedFiles }
