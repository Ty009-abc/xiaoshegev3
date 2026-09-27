#!/usr/bin/env node
'use strict'
/**
 * scripts/lib/secret-guard.js
 * ─────────────────────────────────────────────────────────────
 * RC8.9B_P0_SECRET_CLOBBER_GUARD — pure logic (no network, no mutation).
 *
 * WHY THIS EXISTS
 *   `tcb fn deploy` / `tcb config update` materialize the
 *   `functions[].envVariables` map from cloudbaserc.json into the cloud.
 *   SCF treats `Environment.Variables` as a FULL REPLACEMENT. A committed
 *   placeholder (e.g. "<YOUR_AI_API_KEY>") therefore OVERWRITES the live
 *   production secret → outage (the 11:04 RC8.9B incident: 6Q model 401).
 *
 * INVARIANT (fail-closed)
 *   1. A deploy MUST FAIL HARD when the config declares a PRODUCTION SECRET
 *      whose value is a placeholder / empty / obviously-not-a-real-secret.
 *   2. Production secrets are CLOUD-SIDE / runtime-managed. The repository
 *      must NEVER carry their real values — a committed real secret also FAILS.
 *   3. A secret-bearing function must NOT declare a PARTIAL env block: because
 *      the replace is wholesale, any omitted secret would be DELETED.
 *
 * SAFETY
 *   - This module never returns, logs or formats secret VALUES.
 *   - Diagnostics expose KEY NAMES + reason tokens only.
 */

// Values that are NOT a real secret (placeholders / fill-me / empty).
const PLACEHOLDER_PATTERNS = [
  /^<.*>$/,                 // <YOUR_AI_API_KEY>  <NEED_PRIVATE_KEY>  <FILL_ME>
  /your[_-]?/i,             // your_api_key  YOUR_API_KEY
  /placeholder/i,
  /changeme/i,
  /change[_-]?me/i,
  /^todo$/i,
  /^tbd$/i,
  /^none$/i,
  /^null$/i,
  /^undefined$/i,
  /^x{3,}$/i,               // xxx  xxxx
  /^\.{3,}$/,
  /^\*{3,}$/,
  /example/i,
  /dummy/i,
  /^sk-your/i,
]

// Key names that denote a PRODUCTION SECRET (value must never be committed).
const SECRET_KEY_RE = /(API_?KEY|SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE_?KEY|CREDENTIAL|V3_?KEY|OPENID|OPENIDS)/i

// Key names that look secret-ish but are actually public runtime config.
const NON_SECRET_ALLOW_RE = /(BASE_?URL|API_?URL|_URL$|MODEL|MODE|ALLOWLIST|NOTIFY_URL|MCHID|MCH_ID|APPID|APP_ID|SERIAL_NO|SERIAL_NUMBER)/i

/**
 * Functions that REQUIRE a production secret at runtime (cloud-side). Used to
 * detect a PARTIAL env block that would silently DELETE the live secret under
 * SCF's wholesale `Environment.Variables` replacement.
 * Keys listed here must be exactly the secret keys the function depends on.
 */
const SECRET_BEARING = {
  generateAiReport: ['AI_API_KEY'],
  startChallenge: ['AI_API_KEY'],
  submitChallengeChoice: ['AI_API_KEY'],
  getDailyInsight: ['AI_API_KEY'],
  summarizeConversation: ['AI_API_KEY'],
  runEvolutionCycle: ['AI_API_KEY'],
  createOrder: ['WXPAY_API_V3_KEY', 'WXPAY_PRIVATE_KEY'],
  payCallback: ['WXPAY_API_V3_KEY'],
  verifyPayment: ['WXPAY_API_V3_KEY', 'WXPAY_PRIVATE_KEY'],
  refundOrder: ['WXPAY_API_V3_KEY', 'WXPAY_PRIVATE_KEY'],
  checkPermission: ['ADMIN_OPENIDS'],
  adminCheckAccess: ['ADMIN_OPENIDS'],
  initKnowledgeEmbeddings: ['EMBEDDING_API_KEY'],
}

function isSecretKey (key) {
  const k = String(key || '')
  if (NON_SECRET_ALLOW_RE.test(k)) return false
  return SECRET_KEY_RE.test(k)
}

/** True when `value` is empty or a recognizable placeholder (never a real secret). */
function isPlaceholderValue (value) {
  if (value === undefined || value === null) return true
  const s = String(value).trim()
  if (s === '') return true
  return PLACEHOLDER_PATTERNS.some((re) => re.test(s))
}

/**
 * Scan one function config; returns issues with KEY NAMES + reason only.
 * Reasons: PLACEHOLDER_SECRET_VALUE | COMMITTED_SECRET_VALUE | PARTIAL_SECRET_ENV
 */
function scanFunction (fn) {
  const issues = []
  if (!fn || typeof fn !== 'object') return issues
  const name = String(fn.name || '')
  const env = fn.envVariables && typeof fn.envVariables === 'object' ? fn.envVariables : null
  const declaredSecretKeys = []
  if (env) {
    for (const key of Object.keys(env)) {
      if (!isSecretKey(key)) continue
      declaredSecretKeys.push(key)
      const v = env[key]
      if (isPlaceholderValue(v)) {
        issues.push({ function: name, key, reason: 'PLACEHOLDER_SECRET_VALUE' })
      } else {
        // A non-placeholder value for a secret key = a real secret committed.
        issues.push({ function: name, key, reason: 'COMMITTED_SECRET_VALUE' })
      }
    }
    // Partial-block detection for functions known to require secrets.
    const required = SECRET_BEARING[name]
    if (required) {
      const missing = required.filter((k) => !declaredSecretKeys.includes(k))
      if (missing.length > 0) {
        // The block will be sent wholesale → missing required secrets get DELETED.
        issues.push({ function: name, key: missing.join('+'), reason: 'PARTIAL_SECRET_ENV' })
      }
    }
  }
  return issues
}

/** Scan a whole cloudbaserc.json object. */
function scanConfig (config) {
  const fns = (config && Array.isArray(config.functions)) ? config.functions : []
  const issues = []
  for (const fn of fns) issues.push(...scanFunction(fn))
  return issues
}

module.exports = {
  PLACEHOLDER_PATTERNS,
  SECRET_KEY_RE,
  NON_SECRET_ALLOW_RE,
  SECRET_BEARING,
  isSecretKey,
  isPlaceholderValue,
  scanFunction,
  scanConfig,
}
