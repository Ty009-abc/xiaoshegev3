'use strict'
/**
 * turnaroundStrategy/v6/experimental/draft/draftValidatorV6.js
 *
 * R11_V2 — DRAFT semantic/safety validator.
 *
 * SCOPE (§4): checks ONLY semantic/safety authority over the AI draft material:
 *   DIAGNOSIS_DRIFT, ACTION_TYPE_DRIFT, UNSUPPORTED_CLAIM,
 *   ONTOLOGY_LEAK, WEALTH_PROMISE, REALITY_DENIAL
 *
 * It must NOT reject merely because a card01 candidate exceeds the final UI
 * length, the mechanism is verbose, or the transition needs compression.
 * Those are EDITOR responsibilities.
 *
 * The SAME scanner is used for the whole draft and per field, so the editor can
 * apply FIELD-LEVEL fallback (§7) for exactly the fields that are unsafe.
 */

const DRAFT_VERSION = 'turnaround_strategy_v6_worldview_draft_v1'

const OTHER_BOTTLENECKS = ['DIRECTION_GAP', 'ACTION_GAP', 'CONSISTENCY_GAP', 'VALIDATION_GAP', 'REPEATABILITY_GAP']

const FORBIDDEN_USER_TOKENS = [
  'DIRECTION_GAP', 'ACTION_GAP', 'CONSISTENCY_GAP', 'VALIDATION_GAP', 'REPEATABILITY_GAP',
  'BELIEF_MATCH', 'BELIEF_PARTIAL', 'BELIEF_REALITY_GAP',
  'THINKING', 'RESEARCHING', 'LEARNING', 'STARTED', 'TESTING', 'EARLY_TRACTION', 'STABLE_TRACTION',
  '世界模型', 'world model', '盲区', 'blind spot', '认知维度', '模型候选',
  'MULTIPLE', 'UNIQUE', 'evidence strength', 'rule id', 'RC84V6',
  'CASHFLOW_SAFE_EXPERIMENT', 'SMALLEST_EXTERNAL_TEST', 'BUYER_FEEDBACK_COLLECTION',
  'REPEAT_SUCCESS_PATH', 'DIRECTION_NARROWING', 'CONSISTENCY_PROTECTION',
  'CASHFLOW_PRESSURE', 'LOW_SURPLUS', 'UNSTABLE_INCOME', 'TIME_PRESSURE_POSSIBLE', 'FAMILY_ENVIRONMENT_CONSTRAINT',
  'primaryBottleneck', 'diagnosisState', 'realityConstraint'
]

const WEALTH_PROMISE_DIRECT = [
  '成功率', '财富概率', '未来收入', '稳赚', '包赚', '包你', '百分百', '100%',
  '一定翻身', '一定赚钱', '一定成功', '一定获得资源', '收入必然增长', '财富会增加', '财富会增长'
]
const GUARANTEE_TERM = /(一定|必然|保证|肯定|必定|稳赚|包赚|包你|百分百|100%)/
const OUTCOME_NOUN = /(赚钱|赚到钱|发财|翻身|成功|财富|收入|资源|回报|获利|盈利|变现|增长|增加)/

const REALITY_DENIAL_PATTERNS = [
  /你不是没时间[，,。]/, /你不是缺资源[，,。]/, /问题根本不在环境/,
  /不是没时间[，,]?只是/, /不是缺资源[，,]?只是/
]

// FIRST_ACTION_TYPE preservation signatures (mirror of the frozen validator).
const CASHFLOW_SAFE_COST_SIG = /(不花钱|零成本|零额外投入|低成本|成本足够低|成本可以是零|不需要追加资金|不追加资金|(?:(?:不|不会)伤到?现金流))/
const CASHFLOW_SAFE_EXPERIMENT_SIG = /(反馈|真实结果|真实|验证|测试)/
const ACTION_SIGS = {
  CASHFLOW_SAFE_EXPERIMENT: (t) => CASHFLOW_SAFE_COST_SIG.test(t) && CASHFLOW_SAFE_EXPERIMENT_SIG.test(t),
  SMALLEST_EXTERNAL_TEST: (t) => /(最小|极小|24小时内|一步)/.test(t) && /(外部|真实反馈|反馈|真实结果)/.test(t),
  BUYER_FEEDBACK_COLLECTION: (t) => /(真实用户|用户|买的人|没买|为什么不买|没买单)/.test(t) && /(问|反馈|原话|记下)/.test(t),
  REPEAT_SUCCESS_PATH: (t) => /(成交|做成|成功)/.test(t) && /(步骤|照搬|复制|清单|流程)/.test(t),
  DIRECTION_NARROWING: (t) => /(方向|选一个)/.test(t) && /(一句话|反馈|问题)/.test(t)
}

const ALLOWED_NUMS = new Set(['24', '48', '3', '2', '1', '1000', '5000', '10000'])
const HISTORY_MARKER = /(了|已经|曾经|一直|过去|以前|之前|每天|工作|欠|还|存|做过|干了|试过|坚持|失败|收入|债务|工资)/
const HISTORY_UNIT = /(次|遍|回|年|个月|岁|元|块|万|小时|天)/

/**
 * Single source of truth: scan one text blob for all semantic/safety issues.
 * Used both for the whole draft and per field.
 */
function scanText (text, diagnosis) {
  const t = String(text == null ? '' : text)
  const tlc = t.toLowerCase()
  const out = { ontologyLeak: [], wealthPromise: [], realityDenial: [], unsupportedClaims: [], bottleneckDrift: false }

  for (const tok of FORBIDDEN_USER_TOKENS) {
    const lower = tok.toLowerCase()
    if (lower.length <= 3 ? t.includes(tok) : tlc.includes(lower)) out.ontologyLeak.push(tok)
  }
  for (const tok of WEALTH_PROMISE_DIRECT) if (t.includes(tok)) out.wealthPromise.push(tok)
  for (const sent of t.split(/(?<=[。！？!?\n])/)) {
    if (GUARANTEE_TERM.test(sent) && OUTCOME_NOUN.test(sent)) out.wealthPromise.push('联合保证:' + sent.trim().slice(0, 24))
  }
  for (const re of REALITY_DENIAL_PATTERNS) if (re.test(t)) out.realityDenial.push(re.source)

  const others = OTHER_BOTTLENECKS.filter((x) => x !== (diagnosis && diagnosis.primaryBottleneck))
  for (const b of others) if (t.includes(b)) out.bottleneckDrift = true

  const numRe = /\d+(?:\.\d+)?/g
  let nm
  while ((nm = numRe.exec(t)) !== null) {
    const n = nm[0]
    const win = t.slice(Math.max(0, nm.index - 8), nm.index + n.length + 8)
    if (HISTORY_MARKER.test(win) && HISTORY_UNIT.test(win)) { out.unsupportedClaims.push(n); continue }
    if (ALLOWED_NUMS.has(n)) continue
  }
  return out
}

function reasonsOf (scan) {
  const bad = []
  for (const tok of scan.ontologyLeak) bad.push('ONTOLOGY_LEAK:' + tok)
  for (const tok of scan.wealthPromise) bad.push('WEALTH_PROMISE:' + tok)
  for (const re of scan.realityDenial) bad.push('REALITY_DENIAL')
  for (const n of scan.unsupportedClaims) bad.push('UNSUPPORTED_USER_CLAIM:' + n)
  if (scan.bottleneckDrift) bad.push('DIAGNOSIS_DRIFT')
  return bad
}

function actionBlobOf (draft) { return String(draft && draft.actionExplanation || '') }

function draftVisibleText (draft) {
  const d = draft || {}
  return [
    (d.insightCandidates || []).join('\n'),
    d.mechanismExplanation,
    d.transitionExplanation,
    d.actionExplanation
  ].filter(Boolean).join('\n')
}

/**
 * Validate the draft material against the frozen diagnosis.
 * @returns {{valid, hardFailures, findings, fieldVerdicts}}
 */
function validateDraftV6 (draft, diagnosis) {
  const diag = diagnosis || {}
  const empty = { valid: false, hardFailures: ['SHAPE_INVALID'], findings: buildFindings(), fieldVerdicts: {} }

  if (!draft || typeof draft !== 'object') return empty

  const hasAnyMaterial = (Array.isArray(draft.insightCandidates) && draft.insightCandidates.length > 0) ||
    draft.mechanismExplanation || draft.transitionExplanation || draft.actionExplanation
  if (!hasAnyMaterial) return { valid: false, hardFailures: ['NO_MATERIAL'], findings: buildFindings(), fieldVerdicts: {} }

  const text = draftVisibleText(draft)
  const scan = scanText(text, diag)
  const findings = buildFindings()
  findings.ontologyLeak = scan.ontologyLeak
  findings.wealthPromise = scan.wealthPromise
  findings.realityDenial = scan.realityDenial
  findings.unsupportedClaims = scan.unsupportedClaims
  findings.bottleneckDrift = scan.bottleneckDrift

  // ACTION_TYPE_DRIFT — actionExplanation must stay consistent with firstActionType.
  const declared = diag.firstActionType
  if (declared && ACTION_SIGS[declared]) findings.actionTypeDrift = !ACTION_SIGS[declared](actionBlobOf(draft))

  const hardFailures = []
  if (findings.ontologyLeak.length) hardFailures.push('ONTOLOGY_LEAK')
  if (findings.wealthPromise.length) hardFailures.push('WEALTH_PROMISE')
  if (findings.realityDenial.length) hardFailures.push('REALITY_DENIAL')
  if (findings.unsupportedClaims.length) hardFailures.push('UNSUPPORTED_USER_CLAIM')
  if (findings.bottleneckDrift) hardFailures.push('DIAGNOSIS_DRIFT')
  if (findings.actionTypeDrift) hardFailures.push('ACTION_TYPE_DRIFT')

  const fieldVerdicts = {
    insightCandidates: (draft.insightCandidates || []).map((c, i) => fieldVerdict(c, i, diag)),
    mechanismExplanation: fieldVerdict(draft.mechanismExplanation, null, diag),
    transitionExplanation: fieldVerdict(draft.transitionExplanation, null, diag),
    actionExplanation: declared && ACTION_SIGS[declared]
      ? (ACTION_SIGS[declared](actionBlobOf(draft)) ? { ok: true, reasons: [] } : { ok: false, reasons: ['ACTION_TYPE_DRIFT'] })
      : { ok: true, reasons: [] }
  }

  return { valid: hardFailures.length === 0, hardFailures, findings, fieldVerdicts }
}

function buildFindings () {
  return { shapeOk: true, ontologyLeak: [], wealthPromise: [], realityDenial: [], unsupportedClaims: [], bottleneckDrift: false, actionTypeDrift: false }
}

function fieldVerdict (text, i, diag) {
  const scan = scanText(text, diag)
  const reasons = reasonsOf(scan)
  const v = { ok: reasons.length === 0, reasons }
  if (i !== null && i !== undefined) v.i = i
  return v
}

module.exports = {
  DRAFT_VERSION,
  OTHER_BOTTLENECKS,
  FORBIDDEN_USER_TOKENS,
  WEALTH_PROMISE_DIRECT,
  ACTION_SIGS,
  scanText,
  reasonsOf,
  draftVisibleText,
  validateDraftV6
}
