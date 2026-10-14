/**
 * 珠澳小事哥 · 认知操作系统 v3.0 — stagingIdentityProbe
 *
 * RC8_14 Part 四 — TRUSTED IDENTITY PROBE (STAGING-ONLY, deployed to the staging
 * env exclusively; never part of production).
 *
 * PURPOSE
 *   Prove that a genuine WeChat caller identity actually reaches a cloud function
 *   server-side — independent of whether startChallenge succeeds — without any
 *   client-supplied identity surface.
 *
 * HARD RULES (non-negotiable)
 *   - Identity is read ONLY from cloud.getWXContext().OPENID (platform-native).
 *     The payload / event / headers are IGNORED for identity — passing an openid
 *     in `event` has NO effect.
 *   - NEVER writes to the database (no add/update/create/delete here).
 *   - No identity → 401 (fail-closed).
 *   - Runtime environment must match the declared staging env; a mismatch (or the
 *     production env) is REFUSED before any identity is returned.
 *
 * This function does NOT change the 3 business functions or any auth logic.
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const EXPECTED_ENV = 'fanshen002-d9g0rjr3b6e313af5'   // staging (this function's home)
const PROD_ENV = 'fanshex-d2g0adgv7dfbc9bdc'          // production — must never match

function resolveEnv (wxContext) {
  const candidates = [
    wxContext && wxContext.ENV,
    wxContext && wxContext.ENV_ID,
    process.env.TCB_ENV,
    process.env.SCF_NAMESPACE,
    process.env.TCB_CONTEXT_ENV,
  ]
  for (const c of candidates) if (c && typeof c === 'string' && c.trim()) return c.trim()
  return ''
}

function mask (openid) {
  if (!openid || openid.length < 8) return openid ? '****' : ''
  return openid.slice(0, 4) + '…' + openid.slice(-3)
}

function fingerprint (openid) {
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(String(openid)).digest('hex').slice(0, 12)
}

exports.main = async (event /*, context*/) => {
  const wxContext = cloud.getWXContext() || {}
  const env = resolveEnv(wxContext)

  // ── env guard (fail-closed) — refuse before revealing any identity ──
  if (env && env !== EXPECTED_ENV) {
    console.warn('[stagingIdentityProbe] ENV_MISMATCH runtime=' + env + ' expected=' + EXPECTED_ENV)
    return { code: 401, message: '环境不匹配，已拒绝', data: { code: 'ENV_MISMATCH', expected: EXPECTED_ENV } }
  }
  if (env === PROD_ENV) {
    return { code: 401, message: '生产环境禁止调用', data: { code: 'ENV_MISMATCH' } }
  }

  const openid = wxContext.OPENID
  // ── identity guard (fail-closed) — no WeChat context => no identity ──
  if (!openid) {
    console.warn('[stagingIdentityProbe] no OPENID in WX context (server-side/CLI call?)')
    return { code: 401, message: '登录态失效，请重新登录', data: null }
  }

  // NOTE: `event` is deliberately NOT read for identity. Any payload openid is ignored.
  console.log('[stagingIdentityProbe] identity present env=' + (env || '(unresolved)') + ' fp=' + fingerprint(openid))

  return {
    code: 0,
    message: 'success',
    data: {
      identityPresent: true,
      openid,                 // the CALLER's own identity (same contract as login)
      openidMasked: mask(openid),
      openidFingerprint: fingerprint(openid),
      appid: wxContext.APPID || '',
      unionid: wxContext.UNIONID || '',
      env: env || '',
      envVerified: env === EXPECTED_ENV,
      source: wxContext.SOURCE || '',
    },
  }
}
