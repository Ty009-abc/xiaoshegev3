'use strict'
/**
 * virtualPayEnvLock.js — RC8_14_D12_R6C_R6_8 · MINIMAL_VIRTUAL_PAYMENT_SECURITY
 *
 * 沙箱环境锁（fail-closed）——把「沙箱模式」绑定到【字面量 staging envId】，
 * 使 staging 上的虚拟支付路径【不可能】选择生产（现网）provider / 生产 AppKey。
 *
 * 权威来源：云函数运行时环境标识（wxContext.ENV / TCB_ENV / SCF_NAMESPACE），
 * 由平台注入，客户端不可提供、不可伪造。绝不读取 event 中的任何环境字段。
 *
 * 规则（仅对 staging env 施加；生产 env 行为保持不变）：
 *   staging envId（fanshen002-d9g0rjr3b6e313af5）:
 *     1. 必须有可解析的运行环境标识 —— 缺失 = 歧义身份 → 拒绝（fail-closed）。
 *     2. 运行环境必须在已知允许集合内 —— 否则拒绝。
 *     3. 环境标识歧义（多个来源给出不同 envId）→ 拒绝。
 *     4. VIRTUAL_PAY_ENV 畸形（'undefined'/'null'/'NaN'/非 0-1 字面量）→ 拒绝。
 *     5. 生产模式（VIRTUAL_PAY_ENV 显式非沙箱）→ 拒绝。
 *     6. 存在生产 AppKey（VIRTUAL_PAY_PROD_APP_KEY）→ 拒绝。
 *     7. appKeyRequired 且缺沙箱 AppKey → 拒绝。
 *     ⇒ 通过后锁定 envFlag=1（sandbox），provider='sandbox'。绝不回退生产。
 *   生产 envId（fanshex-d2g0adgv7dfbc9bdc）:
 *     行为保持 = 现有 resolveEnvFlag（'0'→现网 provider，否则沙箱）。本锁不新增约束。
 *
 * 绝不返回 / 记录任何密钥值；只返回存在性事实。
 * 本文件为 canonical；createVirtualOrder / verifyVirtualPayment 各持一份字节一致副本。
 */

// 字面量环境身份（与 staging 隔离标记 staging.envId 一致）
const STAGING_ENV_ID = 'fanshen002-d9g0rjr3b6e313af5'
const PRODUCTION_ENV_ID = 'fanshex-d2g0adgv7dfbc9bdc'

// 已知环境集合（未来新增环境必须显式登记；未登记 → fail-closed）
const ALLOWED_ENV_IDS = new Set([STAGING_ENV_ID, PRODUCTION_ENV_ID])

// 沙箱锁适用范围：这些 env 只允许沙箱
const SANDBOX_ONLY_ENV_IDS = new Set([STAGING_ENV_ID])

// 畸形环境标志哨兵（防止 String(undefined)/String(null) 被当作有效输入）
const MALFORMED_FLAGS = new Set(['undefined', 'null', 'nan', 'none'])

const REASONS = {
  ENV_IDENTITY_MISSING: 'SANDBOX_ENV_IDENTITY_MISSING',
  ENV_IDENTITY_AMBIGUOUS: 'SANDBOX_ENV_IDENTITY_AMBIGUOUS',
  ENV_NOT_ALLOWED: 'SANDBOX_ENV_NOT_ALLOWED',
  MALFORMED_ENV_FLAG: 'SANDBOX_MALFORMED_ENV_FLAG',
  PROD_MODE_FORBIDDEN: 'SANDBOX_PROD_MODE_FORBIDDEN',
  PROD_KEY_FORBIDDEN: 'SANDBOX_PROD_KEY_FORBIDDEN',
  SANDBOX_KEY_MISSING: 'SANDBOX_KEY_MISSING',
}

function _nonEmpty (v) { return typeof v === 'string' && v.trim().length > 0 }

function normalizeEnvId (v) {
  if (v == null) return ''
  return String(v).trim()
}

/**
 * 收集运行环境标识候选（平台注入；客户端不可控）。返回 { envId, ambiguous }。
 * 只在【同一来源体系】内比较：任两个非空候选不一致 → 歧义。
 */
function resolveRuntimeEnvId (wxContext, env) {
  const e = env || (typeof process !== 'undefined' ? process.env : {}) || {}
  const candidates = [
    wxContext && wxContext.ENV,
    wxContext && wxContext.ENV_ID,
    e.TCB_ENV,
    e.SCF_NAMESPACE,
    e.TCB_CONTEXT_ENV,
  ].map(normalizeEnvId).filter(Boolean)
  if (candidates.length === 0) return { envId: '', ambiguous: false }
  const first = candidates[0]
  const ambiguous = candidates.some((c) => c !== first)
  return { envId: first, ambiguous }
}

function isMalformedFlag (v) {
  if (v == null) return false                     // 缺失 = 采用默认（沙箱），非畸形
  const raw = String(v).trim()
  if (raw === '') return false                     // 空串 = 默认，非畸形
  if (MALFORMED_FLAGS.has(raw.toLowerCase())) return true
  return !(raw === '0' || raw === '1')             // 只有 '0'/'1' 是合法字面量
}

function isSandboxOnlyEnv (envId) { return SANDBOX_ONLY_ENV_IDS.has(envId) }

function _deny (reason, extra) {
  return Object.assign({
    ok: false,
    envId: (extra && extra.envId) || '',
    envFlag: null,
    provider: null,
    locked: false,
    reason,
    issues: [reason],
  }, extra || {})
}

/**
 * resolveVirtualPayEnv — 解析并锁定虚拟支付运行环境。
 *
 * @param {object} opts { wxContext, env, appKeyRequired }
 * @returns {{ok, envId, envFlag, provider, locked, reason, issues}}
 */
function resolveVirtualPayEnv (opts) {
  opts = opts || {}
  const env = opts.env || (typeof process !== 'undefined' ? process.env : {}) || {}
  const resolved = resolveRuntimeEnvId(opts.wxContext, env)
  const envId = resolved.envId
  const appKeyRequired = opts.appKeyRequired === true
  const hasSandboxKey = _nonEmpty(env.VIRTUAL_PAY_SANDBOX_APP_KEY)
  const hasProdKey = _nonEmpty(env.VIRTUAL_PAY_PROD_APP_KEY)

  // 1. 必须有环境身份（staging 锁不允许歧义/缺失）
  if (!envId) return _deny(REASONS.ENV_IDENTITY_MISSING, { envId: '' })
  // 2. 身份歧义 → 拒绝
  if (resolved.ambiguous) return _deny(REASONS.ENV_IDENTITY_AMBIGUOUS, { envId })
  // 3. 未知/未登记环境 → 拒绝（fail-closed）
  if (!ALLOWED_ENV_IDS.has(envId)) return _deny(REASONS.ENV_NOT_ALLOWED, { envId })

  // 4. 非 staging-only 环境（生产）：保持现有行为，不新增约束
  if (!isSandboxOnlyEnv(envId)) {
    const prodFlag = env.VIRTUAL_PAY_ENV === '0' ? 0 : 1
    return {
      ok: true,
      envId,
      envFlag: prodFlag,
      provider: prodFlag === 0 ? 'prod' : 'sandbox',
      locked: false,
      reason: null,
      issues: [],
    }
  }

  // ── 5. staging 沙箱锁 ──
  // 5a. 畸形 flag → 拒绝（绝不把 'undefined' 等当作合法输入）
  if (isMalformedFlag(env.VIRTUAL_PAY_ENV)) return _deny(REASONS.MALFORMED_ENV_FLAG, { envId, locked: true })
  // 5b. 生产模式显式声明 → 拒绝（缺失/空 → 默认沙箱，允许）
  const raw = env.VIRTUAL_PAY_ENV == null ? '' : String(env.VIRTUAL_PAY_ENV).trim()
  if (raw !== '' && raw !== '1') return _deny(REASONS.PROD_MODE_FORBIDDEN, { envId, locked: true })
  // 5c. 存在生产 AppKey → 拒绝（staging 绝不使用生产密钥）
  if (hasProdKey) return _deny(REASONS.PROD_KEY_FORBIDDEN, { envId, locked: true })
  // 5d. 需要 AppKey 但缺沙箱 AppKey → 拒绝
  if (appKeyRequired && !hasSandboxKey) return _deny(REASONS.SANDBOX_KEY_MISSING, { envId, locked: true })

  return {
    ok: true,
    envId,
    envFlag: 1,          // 锁定沙箱
    provider: 'sandbox',
    locked: true,
    reason: null,
    issues: [],
  }
}

module.exports = {
  STAGING_ENV_ID,
  PRODUCTION_ENV_ID,
  ALLOWED_ENV_IDS,
  SANDBOX_ONLY_ENV_IDS,
  REASONS,
  normalizeEnvId,
  resolveRuntimeEnvId,
  isMalformedFlag,
  isSandboxOnlyEnv,
  resolveVirtualPayEnv,
}
