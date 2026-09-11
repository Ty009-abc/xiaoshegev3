'use strict'
/**
 * turnaroundStrategy/v6/experimental/runtime/worldviewValidatorV6.js
 *
 * ISOLATED worldview output validator (B2.4).
 *
 * Implements the accepted validator spec
 *   docs/design/RC8.4_V6_WORLDVIEW_OUTPUT_VALIDATOR_SPEC.md
 * (VALIDATOR_VERSION = turnaround_strategy_v6_worldview_validator_v1) as a
 * deterministic, self-contained module. No AI, no I/O, no network, no /tmp deps.
 *
 * The runtime treats this as a HARD gate: model output can NEVER bypass it.
 * FAIL_CLOSED_ON_VALIDATION_ERROR = YES.
 */

const VALIDATOR_VERSION = 'turnaround_strategy_v6_worldview_validator_v1'
const WORLDVIEW_REPORT_VERSION = 'turnaround_strategy_v6_worldview_v1'

const TITLES = {
  fatalInsight: '致命一句话',
  coreProblem: '核心问题',
  systemLoop: '系统困局',
  turnaroundPath: '翻身路径',
  firstAction: '现在就做'
}
const CARD_KEYS = ['fatalInsight', 'coreProblem', 'systemLoop', 'turnaroundPath', 'firstAction']
const CARD01_MAX = 60

// Internal vocabulary that must NEVER surface in user-visible copy.
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

// Unambiguous single-token guarantees.
const WEALTH_PROMISE_DIRECT = [
  '成功率', '财富概率', '未来收入', '稳赚', '包赚', '包你', '百分百', '100%',
  '一定翻身', '一定赚钱', '一定成功', '一定获得资源', '收入必然增长', '财富会增加', '财富会增长'
]
// Combined rule: a guarantee term AND an outcome noun in the SAME sentence.
const GUARANTEE_TERM = /(一定|必然|保证|肯定|必定|稳赚|包赚|包你|百分百|100%)/
const OUTCOME_NOUN = /(赚钱|赚到钱|发财|翻身|成功|财富|收入|资源|回报|获利|盈利|变现|增长|增加)/

const GENERIC_WORLDVIEW = [
  '现在是AI时代', '流量很重要', '要使用杠杆', '建立个人IP', '打造自己的系统',
  '风口', '时代变了', '普通人逆袭', '认知升级', '底层逻辑'
]
const REALITY_DENIAL_PATTERNS = [
  /你不是没时间[，,。]/, /你不是缺资源[，,。]/, /问题根本不在环境/,
  /不是没时间[，,]?只是/, /不是缺资源[，,]?只是/
]

// FIRST_ACTION_TYPE preservation signatures (subset needed for drift detection).
const ACTION_SIGS = {
  CASHFLOW_SAFE_EXPERIMENT: t => /(不花钱|零|低成本|成本足够低|成本可以是零)/.test(t) && /(反馈|真实结果|真实)/.test(t),
  SMALLEST_EXTERNAL_TEST: t => /(最小|极小|24小时内|一步)/.test(t) && /(外部|真实反馈|反馈|真实结果)/.test(t),
  BUYER_FEEDBACK_COLLECTION: t => /(真实用户|用户|买的人|没买|为什么不买|没买单)/.test(t) && /(问|反馈|原话|记下)/.test(t),
  REPEAT_SUCCESS_PATH: t => /(成交|做成|成功)/.test(t) && /(步骤|照搬|复制|清单|流程)/.test(t),
  DIRECTION_NARROWING: t => /(方向|选一个)/.test(t) && /(一句话|反馈|问题)/.test(t),
  MINIMAL_REAL_EXPERIMENT: t => /(最小|真实|测试)/.test(t),
  LOCK_RECURRING_SLOT: t => /(固定|时段|每天)/.test(t),
  REUSABLE_OUTPUT_SLOT: t => /(复用|可重复|产出|固定)/.test(t),
  MINIMAL_DELIVERY_TO_REAL_PERSON: t => /(交付|真实|反馈)/.test(t),
  ZERO_COST_USE_ONCE: t => /(零成本|不花钱|成本)/.test(t),
  ASK_BUYERS_DEMAND_QUESTION: t => /(问|用户|买)/.test(t),
  ASK_USERS_PAYBEHAVIOUR: t => /(问|付钱|买)/.test(t)
}

const OTHER_BOTTLENECKS = ['DIRECTION_GAP', 'ACTION_GAP', 'CONSISTENCY_GAP', 'VALIDATION_GAP', 'REPEATABILITY_GAP']

/** Collect every user-visible string from a worldview report. */
function visibleText (report) {
  if (!report || !report.cards) return ''
  const c = report.cards
  const parts = [
    c.fatalInsight && c.fatalInsight.text,
    c.coreProblem && c.coreProblem.text,
    c.systemLoop && (c.systemLoop.steps || []).join(' '),
    c.turnaroundPath && c.turnaroundPath.from,
    c.turnaroundPath && c.turnaroundPath.to,
    c.turnaroundPath && c.turnaroundPath.logic,
    c.firstAction && c.firstAction.action,
    c.firstAction && (c.firstAction.checks || []).join(' ')
  ]
  return parts.filter(Boolean).join('\n')
}

/**
 * Validate a model-produced worldview report against the frozen diagnosis.
 * @returns {{ valid:boolean, hardFailures:string[], findings:Object }}
 */
function validateWorldviewV6 (report, diagnosis) {
  const f = {
    jsonParseOk: true, cardCount: 0, titleMismatch: 0, systemLoopStepCount: 0,
    card01Len: 0, card01Over: false,
    ontologyLeak: [], wealthPromise: [], genericWorldview: [], buzzwordStuffing: [],
    realityDenial: [], unsupportedClaims: [],
    bottleneckDrift: false, actionTypeDrift: false, shapeInvalid: false
  }
  const diag = diagnosis || {}

  // ── V-1 shape ────────────────────────────────────────────────
  if (!report || typeof report !== 'object' || !report.cards) {
    f.shapeInvalid = true
    return { valid: false, hardFailures: ['SHAPE_INVALID'], findings: f }
  }
  if (report.reportVersion !== WORLDVIEW_REPORT_VERSION) {
    f.shapeInvalid = true
    return { valid: false, hardFailures: ['VERSION_MISMATCH'], findings: f }
  }
  const c = report.cards

  // ── V-2 five-card completeness ───────────────────────────────
  for (const k of CARD_KEYS) if (c[k]) f.cardCount++
  for (const k of CARD_KEYS) if (!c[k] || c[k].title !== TITLES[k]) f.titleMismatch++
  if (f.cardCount !== 5 || f.titleMismatch !== 0) {
    f.shapeInvalid = true
    return { valid: false, hardFailures: ['CARD_SHAPE_INVALID'], findings: f }
  }

  // ── V-9 Card03 == 5 steps; Card05 has >=1 check ──────────────
  f.systemLoopStepCount = Array.isArray(c.systemLoop.steps) ? c.systemLoop.steps.length : 0
  const checksOk = Array.isArray(c.firstAction.checks) && c.firstAction.checks.length >= 1
  if (f.systemLoopStepCount !== 5 || !checksOk) {
    f.shapeInvalid = true
    return { valid: false, hardFailures: ['LOOP_OR_ACTION_SHAPE'], findings: f }
  }

  // ── V-10 Card01 length ───────────────────────────────────────
  f.card01Len = [...String(c.fatalInsight.text || '')].length
  f.card01Over = f.card01Len > CARD01_MAX

  const text = visibleText(report)
  const textLC = text.toLowerCase()

  // ── V-6 ontology leak (case-insensitive; incl. obvious enum phrasing) ──
  for (const tok of FORBIDDEN_USER_TOKENS) {
    const t = tok.toLowerCase()
    if (t.length <= 3) { if (text.includes(tok)) f.ontologyLeak.push(tok) } else if (textLC.includes(t)) f.ontologyLeak.push(tok)
  }
  for (const re of [/瓶颈是\s*[A-Z_]{3,}/g, /瓶颈是[Ａ-Ｚ_]/g]) {
    if (re.test(text)) f.ontologyLeak.push('RX:' + re.source)
  }

  // ── V-5 wealth / guaranteed outcome ──────────────────────────
  for (const tok of WEALTH_PROMISE_DIRECT) if (text.includes(tok)) f.wealthPromise.push(tok)
  for (const sent of text.split(/(?<=[。！？!?\n])/)) {
    if (GUARANTEE_TERM.test(sent) && OUTCOME_NOUN.test(sent)) f.wealthPromise.push('联合保证:' + sent.trim().slice(0, 24))
  }

  // ── V-7 generic worldview insertion ──────────────────────────
  for (const tok of GENERIC_WORLDVIEW) if (text.includes(tok)) f.genericWorldview.push(tok)

  // ── V-12 reality denial ──────────────────────────────────────
  for (const re of REALITY_DENIAL_PATTERNS) if (re.test(text)) f.realityDenial.push(re.source)

  // ── V-3 diagnosis integrity: no OTHER bottleneck named ───────
  const others = OTHER_BOTTLENECKS.filter(x => x !== diag.primaryBottleneck)
  for (const b of others) if (text.includes(b)) f.bottleneckDrift = true

  // ── V-4 unsupported personal-history numeric claim ───────────
  // Numerals in CARD01/02/03/04 flag ONLY inside a personal-history context.
  const claimText = [
    c.fatalInsight.text, c.coreProblem.text, (c.systemLoop.steps || []).join(' '),
    c.turnaroundPath.from, c.turnaroundPath.to, c.turnaroundPath.logic
  ].join('\n')
  const allowedNums = new Set(['24', '48', '3', '2', '1', '1k', '1000', '5000', '10000'])
  const HISTORY_MARKER = /(了|已经|曾经|一直|过去|以前|之前|每天|工作|欠|还|存|做过|干了|试过|坚持|失败|收入|债务|工资)/
  const HISTORY_UNIT = /(次|遍|回|年|个月|岁|元|块|万|小时|天)/
  const numRe = /\d+(?:\.\d+)?/g
  let nm
  while ((nm = numRe.exec(claimText)) !== null) {
    const n = nm[0]
    const win = claimText.slice(Math.max(0, nm.index - 8), nm.index + n.length + 8)
    if (HISTORY_MARKER.test(win) && HISTORY_UNIT.test(win)) { f.unsupportedClaims.push(n); continue }
    if (allowedNums.has(n)) continue
  }

  // ── V-8 buzzword stuffing (co-occurrence guard) ──────────────
  const DIAG_LINK = /(反馈|真实结果|市场|用户|买|卖|成交|复制|流程|不确定|阶段|准备|动手|方向|结果)/
  for (const tok of GENERIC_WORLDVIEW) {
    if (text.includes(tok) && !DIAG_LINK.test(text)) f.buzzwordStuffing.push(tok)
  }

  // ── V-3b FIRST_ACTION_TYPE preservation ──────────────────────
  const declared = diag.firstActionType
  if (declared && ACTION_SIGS[declared]) {
    const actionBlob = [c.firstAction.action, (c.firstAction.checks || []).join(' ')].join(' ')
    if (!ACTION_SIGS[declared](actionBlob)) f.actionTypeDrift = true
  }

  // ── assemble hard failures ───────────────────────────────────
  const hardFailures = []
  if (f.ontologyLeak.length) hardFailures.push('ONTOLOGY_LEAK')
  if (f.wealthPromise.length) hardFailures.push('WEALTH_PROMISE')
  if (f.genericWorldview.length) hardFailures.push('GENERIC_WORLDVIEW')
  if (f.buzzwordStuffing.length) hardFailures.push('BUZZWORD_STUFFING')
  if (f.realityDenial.length) hardFailures.push('REALITY_DENIAL')
  if (f.unsupportedClaims.length) hardFailures.push('UNSUPPORTED_USER_CLAIM')
  if (f.bottleneckDrift) hardFailures.push('DIAGNOSIS_DRIFT')
  if (f.actionTypeDrift) hardFailures.push('ACTION_TYPE_DRIFT')
  if (f.card01Over) hardFailures.push('CARD01_TOO_LONG')

  return { valid: hardFailures.length === 0, hardFailures, findings: f }
}

module.exports = {
  VALIDATOR_VERSION,
  WORLDVIEW_REPORT_VERSION,
  TITLES,
  CARD_KEYS,
  CARD01_MAX,
  FORBIDDEN_USER_TOKENS,
  ACTION_SIGS,
  visibleText,
  validateWorldviewV6
}
