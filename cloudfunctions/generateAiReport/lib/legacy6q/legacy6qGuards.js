'use strict'
/**
 * cloudfunctions/generateAiReport/lib/legacy6q/legacy6qGuards.js
 *
 * RC8.8 Stage2 (§10) — MINIMAL non-negotiable safety guards.
 *
 * Deliberately SMALL. No semantic evidence gate, no grounding taxonomy, no
 * trend/quality/benchmark assertions, no field-repair pipeline: those belong to
 * the FROZEN RC8.8 hybrid experiment and are NOT in the primary revival path.
 *
 * Kept guards (clearly necessary only):
 *   - valid / recoverable JSON shape (5 fields, advice array)
 *   - no internal enum leakage
 *   - no illegal / gambling / gray-industry instruction
 *   - no guaranteed-rich / guaranteed-success promise
 *
 * The guard block result is REPAIRED AT FIELD LEVEL, never used to replace a
 * strong interpretation. A merely STRONG interpretation is NEVER a rejection.
 *
 * @version legacy6q_v1
 */

const { OUTPUT_FIELDS } = require('./legacy6qContract.js')

const PROHIBITED_INDUSTRY_RE = /(赌博|赌场|博彩|洗钱|刷单|灰产|黑产|色情|代开发票|诈骗|传销|薅羊毛工作室|外挂|开挂)/
const GUARANTEE_RE = /(保证你?(一定)?(发财|翻身|暴富|变富|成功|赚到)|包你(发财|翻身|赚)|稳赚不赔|100%?(能|会)?(成功|翻身|发财)|必定(成功|发财|翻身))/
const ENUM_LEAK_SRC = '(\\bworld_model_\\w+|\\bNO_PRIMARY\\b|\\bPRIMARY\\b|\\bsystem_loop\\b|\\bpath_from\\b|\\bpath_to\\b|\\breasonCode\\b|\\bMISSING_FACT_GROUNDING\\b|\\bUNSUPPORTED_[A-Z_]+\\b|\\bexperiment\\b|\\bdiagnosticVersion\\b)'
const ENUM_LEAK_RE = new RegExp(ENUM_LEAK_SRC)
const ENUM_LEAK_RE_G = new RegExp(ENUM_LEAK_SRC, 'g')

// The four text fields scanned for prohibited content / enum leakage.
const TEXT_FIELDS = ['system_trap', 'core_problem', 'fatal_sentence', 'strategy_path']

// Deterministic safe replacements (field-level only).
const SAFE_REPLACE = {
  industry: '这里给不了冒险或灰色的路子，只谈你真正能走稳的那条。',
  guarantee: '没有人能保证结果，但你可以把成功概率一点点做高。',
}

/**
 * Inspect a (already field-filled) 5-field report.
 * @returns {{ok:boolean, violations:string[], safeReport:object}}
 */
function inspectLegacy6QReport (report) {
  const r = report && typeof report === 'object' ? report : {}
  const violations = []
  const safeReport = {
    system_trap: String(r.system_trap || ''),
    core_problem: String(r.core_problem || ''),
    fatal_sentence: String(r.fatal_sentence || ''),
    strategy_path: String(r.strategy_path || ''),
    advice: Array.isArray(r.advice) ? r.advice.slice() : [],
  }

  for (const field of TEXT_FIELDS) {
    const v = safeReport[field]
    if (!v) continue
    if (PROHIBITED_INDUSTRY_RE.test(v)) { violations.push('PROHIBITED_INDUSTRY:' + field); safeReport[field] = SAFE_REPLACE.industry }
    else if (GUARANTEE_RE.test(v)) { violations.push('GUARANTEE_PROMISE:' + field); safeReport[field] = SAFE_REPLACE.guarantee }
    if (ENUM_LEAK_RE.test(v)) { violations.push('ENUM_LEAK:' + field); safeReport[field] = v.replace(ENUM_LEAK_RE_G, '').replace(/\s{2,}/g, ' ').trim() }
  }

  // advice: scan each item; drop only the offending item (never the whole field).
  safeReport.advice = safeReport.advice
    .map((a) => String(a || '').trim())
    .filter((a) => a.length > 0)
    .map((a) => {
      if (PROHIBITED_INDUSTRY_RE.test(a)) { violations.push('PROHIBITED_INDUSTRY:advice'); return SAFE_REPLACE.industry }
      if (GUARANTEE_RE.test(a)) { violations.push('GUARANTEE_PROMISE:advice'); return SAFE_REPLACE.guarantee }
      if (ENUM_LEAK_RE.test(a)) { violations.push('ENUM_LEAK:advice'); return a.replace(ENUM_LEAK_RE_G, '').replace(/\s{2,}/g, ' ').trim() }
      return a
    })
    .filter((a) => a.length > 0)

  // §10: never reject merely for a strong interpretation — only for empty
  // required fields or a non-array advice (structural shape).
  if (!safeReport.system_trap || !safeReport.core_problem || !safeReport.fatal_sentence || !safeReport.strategy_path) {
    violations.push('MISSING_REQUIRED_FIELD')
  }
  if (!Array.isArray(safeReport.advice) || safeReport.advice.length === 0) {
    violations.push('ADVICE_NOT_ARRAY')
  }

  const blocking = violations.filter((v) => v === 'MISSING_REQUIRED_FIELD' || v === 'ADVICE_NOT_ARRAY')
  return { ok: blocking.length === 0, violations, safeReport }
}

module.exports = {
  PROHIBITED_INDUSTRY_RE,
  GUARANTEE_RE,
  ENUM_LEAK_RE,
  inspectLegacy6QReport,
}
