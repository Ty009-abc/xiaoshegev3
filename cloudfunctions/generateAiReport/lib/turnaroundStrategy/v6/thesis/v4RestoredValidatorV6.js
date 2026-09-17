'use strict'
/**
 * turnaroundStrategy/v6/thesis/v4RestoredValidatorV6.js
 *
 * RC8.4 V6 R70 — MINIMAL hard-ban validator for the V4-restored path.
 *
 * Restores high-freedom inference: ONLY true safety violations block. Every
 * lexical / keyword / world-rule-id / migration-id / style / budget rule from
 * the R6x guarded path is REMOVED (absent here), so a bold but truthful report
 * is NEVER rejected.
 *
 * BLOCKING (hard) — only these:
 *   FABRICATED_OCCUPATION      invented a specific occupation the user did not give
 *   FABRICATED_INCOME          invented an income figure the user did not give
 *   FABRICATED_CUSTOMER        asserted existing customers the user did not give
 *   FABRICATED_CREDENTIAL      asserted credentials/资历 the user did not give
 *   FABRICATED_HISTORY         asserted a fabricated past experience
 *   GUARANTEED_OUTCOME         guaranteed earnings/success
 *   ILLEGAL_CONTENT            illegal instruction
 *
 * TELEMETRY (non-blocking) — recorded but NEVER rejects:
 *   NO_SHARED_THESIS, ANSWER_PARAPHRASE_DOMINANT, INTERNAL_TOKEN_LEAK, BUDGET_SOFT
 *
 * CONSUMER LAYER ONLY. Deterministic. No AI. No I/O. No network.
 */

const { normalizeV4RestoredOutput, visibleTextOf } = require('./v4RestoredAdapterV6.js')

const BLOCKING_REASON_CODES = Object.freeze([
  'FABRICATED_OCCUPATION',
  'FABRICATED_INCOME',
  'FABRICATED_CUSTOMER',
  'FABRICATED_CREDENTIAL',
  'FABRICATED_HISTORY',
  'GUARANTEED_OUTCOME',
  'ILLEGAL_CONTENT'
])
const TELEMETRY_REASON_CODES = Object.freeze([
  'NO_SHARED_THESIS',
  'ANSWER_PARAPHRASE_DOMINANT',
  'INTERNAL_TOKEN_LEAK',
  'BUDGET_SOFT'
])

// ── Guaranteed-outcome patterns (asserted, not hypothetical) ──
const GUARANTEE_PAT = /(一定|必定|保准|保证|稳赚|包赚|肯定)能(赚|赚到|挣|月入|年入)|保证(收益|赚钱|成功|盈利)|稳赚不赔|包你(赚|成功)|必然会成功|一定(成功|发财|暴富)|保底(收入|收益)|躺着(赚|挣钱)/

// ── Illegal-content patterns ──
const ILLEGAL_PAT = /(洗钱|诈骗|赌博|赌场|博彩|传销|贩毒|走私|非法集资|套现|刷单|黄牛倒卖|行贿|受贿)/

// ── Fabrication cues: identity markers that assert a SPECIFIC unearned fact ──
// A fabricated occupation is only flagged when the user did NOT provide one.
const OCCUPATION_CUE = /(作为|身为|你是|你是一个|你是一名|作为一名)[^，。；\n]{0,10}(程序员|工程师|教师|老师|医生|护士|律师|会计|厨师|司机|销售|设计师|运营|产品经理|公务员|销售员|客服|美工|文案|编导|主播|理发师|美容师|店主|老板)/
const INCOME_CUE = /(你的?(月薪|年薪|月收入|年收入|工资)是|月薪(达|到|有)?\s*[0-9]|年薪(达|到|有)?\s*[0-9]|月入\s*[0-9]+|年入\s*[0-9]+)/
const CUSTOMER_CUE = /(你已经有一批|你的客户(群)?(已经|都)|你手上(已经)?有一群稳定客户|你已经有(了)?(稳定)?(的)?客户|你的老客户)/
const CREDENTIAL_CUE = /(你(持有|拥有|取得)(了)?[^，。\n]{0,12}(证书|资格证|学位|学历|牌照|执照)|你(是|有)[^，。\n]{0,6}(专业认证|注册))/
const HISTORY_CUE = /(你过去(曾|在)[^，。\n]{0,14}(工作过|做过|任职|供职)|你(曾经|以前)(是|在)[^，。\n]{0,10}(公司|单位|企业))/

// ── Paraphrase signal: card02 dominated by fact labels (identity interpretation missing) ──
const FACT_LABEL_PAT = /(人生阶段|每月结余|存款能撑|负债|试错成本|每周自由时间|收入结构|执行力)/g

function classifySeverity (code) {
  if (BLOCKING_REASON_CODES.indexOf(code) !== -1) return 'BLOCKING'
  if (TELEMETRY_REASON_CODES.indexOf(code) !== -1) return 'TELEMETRY'
  // Unknown code -> fail closed ONLY for the caller to decide; here treat as
  // telemetry (the R70 path never blocks on unknown/lexical codes).
  return 'TELEMETRY'
}

/**
 * Detect minimal hard-ban violations.
 * @param {Object} output normalized/raw output
 * @param {Object} payload { userContext, diagnosticContext, hasUserOccupation }
 * @returns {{blocking:string[], telemetry:string[], detail:Object}}
 */
function validateV4Restored (output, payload) {
  const text = visibleTextOf(output)
  const p = payload || {}
  const uc = p.userContext || {}
  const blocking = []
  const detail = {}

  // Occupation: only a violation when the user did NOT provide occupation AND
  // the report asserts a SPECIFIC occupation identity.
  if (!uc.occupationDetail && OCCUPATION_CUE.test(text)) { blocking.push('FABRICATED_OCCUPATION'); detail.occupation = (text.match(OCCUPATION_CUE) || [])[0] }

  if (!/(月薪|年薪|月收入|年收入|工资|月入|年入)/.test(JSON.stringify(uc)) && INCOME_CUE.test(text)) { blocking.push('FABRICATED_INCOME'); detail.income = (text.match(INCOME_CUE) || [])[0] }
  if (CUSTOMER_CUE.test(text)) { const m = text.match(CUSTOMER_CUE); blocking.push('FABRICATED_CUSTOMER'); detail.customer = m[0] }
  if (CREDENTIAL_CUE.test(text)) { const m = text.match(CREDENTIAL_CUE); blocking.push('FABRICATED_CREDENTIAL'); detail.credential = m[0] }
  if (HISTORY_CUE.test(text)) { const m = text.match(HISTORY_CUE); blocking.push('FABRICATED_HISTORY'); detail.history = m[0] }
  if (GUARANTEE_PAT.test(text)) { const m = text.match(GUARANTEE_PAT); blocking.push('GUARANTEED_OUTCOME'); detail.guarantee = m[0] }
  if (ILLEGAL_PAT.test(text)) { const m = text.match(ILLEGAL_PAT); blocking.push('ILLEGAL_CONTENT'); detail.illegal = m[0] }

  // ── TELEMETRY (never blocks) ──
  const telemetry = []
  const o = normalizeV4RestoredOutput(output)
  const st = o.strategicThesis
  // shared thesis: card-level coherence -> at least a thesis identity + contradiction
  if (!st.identityInterpretation || !st.coreContradiction) telemetry.push('NO_SHARED_THESIS')
  // paraphrase-dominant CARD02: many fact labels, no value-position words
  const c2 = o.cards.card02 || ''
  const factHits = (c2.match(FACT_LABEL_PAT) || []).length
  const valueWords = /(位置|资产|身份|价值|可交易|议价|被需要|替代|杠杆|瓶颈|结构)/
  if (factHits >= 3 && !valueWords.test(c2)) telemetry.push('ANSWER_PARAPHRASE_DOMINANT')
  // internal-token leak (telemetry only in the restored path)
  const INTERNAL_PAT = /(DIRECTION_GAP|ACTION_GAP|CONSISTENCY_GAP|VALIDATION_GAP|REPEATABILITY_GAP|BELIEF_MATCH|BELIEF_PARTIAL|BELIEF_REALITY_GAP|RC84V6|envelope|ENVELOPE|THINKING|TESTING|STARTED|世界模型)/
  if (INTERNAL_PAT.test(text)) telemetry.push('INTERNAL_TOKEN_LEAK')

  return { blocking, telemetry, detail, valid: blocking.length === 0 }
}

const HARD_BAN_COUNT = BLOCKING_REASON_CODES.length

module.exports = {
  validateV4Restored,
  classifySeverity,
  BLOCKING_REASON_CODES,
  TELEMETRY_REASON_CODES,
  HARD_BAN_COUNT,
  GUARANTEE_PAT,
  ILLEGAL_PAT
}
