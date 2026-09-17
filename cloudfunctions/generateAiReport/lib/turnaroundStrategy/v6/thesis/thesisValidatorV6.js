'use strict'
/**
 * turnaroundStrategy/v6/thesis/thesisValidatorV6.js
 *
 * RC8.4 V6 R57 — DETERMINISTIC THESIS VALIDATOR.
 * RC8.4 V6 R65 — VALIDATOR SEVERITY MODEL (context-aware) + repairable split.
 *
 * Validates an AI thesis output against the envelope:
 *   FACT SUPPORT · THESIS COHERENCE · WORLD RULE · MIGRATION ·
 *   CROSS AXIS SCOPE · EXPERIMENT ALIGNMENT · FORBIDDEN CLAIMS.
 *
 * R65 SEVERITY (§2)
 *   Every finding is classified BLOCKING or REPAIRABLE.
 *     BLOCKING  -> the AI report is rejected; the caller returns R53 fallback.
 *     REPAIRABLE-> the caller may apply ONE deterministic local repair
 *                  (thesisRepairV6) and re-run THIS validator.
 *   A bare lexical absolute token is NO LONGER a full-report failure: absolute
 *   language is BLOCKING only when it asserts an unsupported factual/predictive
 *   OUTCOME; otherwise it is REPAIRABLE (§3).
 *
 * Any blocking failure => the caller must return the R53 deterministic report
 * (never a partial AI output). CONSUMER LAYER ONLY. Deterministic. No AI.
 */

const { FORBIDDEN_TOKENS } = require('./thesisPromptV6.js')
const { normalizeThesisOutput, visibleTextOf } = require('./thesisAdapterV6.js')

// ── §18 card word budgets (Chinese chars) ──
// R59: sized from a real-provider 30-call study (all finish=stop, 0 truncation).
// Observed maxima: card01=49, card02=158, card03=221, card04=168, card05=316.
// Budgets are set just above observed p95/max so genuinely-verbose drafts are
// still caught, but bold, complete drafts are not rejected on length alone.
// card03: up to 4 mechanism items + 1 conclusion line (matches the prompt
// "4条以内 + 1句结论"). card05: primary + 2–3 supporting + target + timebox +
// signal structurally overflows the old 220 (R58 finding). R65 leaves these
// frozen (the R64 owner-class failure was the absolute-claim rule, not length).
const BUDGET = {
  card01: 50,
  card02: 160,
  card03: 235,
  card03MaxBullets: 5,
  card04: 175,
  card05: 280
}

// ── §6 absolute / fateful claim patterns ──
// R65: these detect TOKENS only. Whether a token is BLOCKING is decided by
// classifyAbsoluteClaims() — context, not bare presence.
// Negated forms (不一定 / 未必 / 不必然) are NOT absolute claims and must pass.
const ABSOLUTE_TOKEN_RE = /(?<![不未])永远|(?<![不未])一定|(?<![不未])必然|(?<![不未])注定|(?<![不未])迟早|肯定|百分百|稳赚|包赚/g
// Fateful individualized/industry predictions (age/industry determinism). These
// stay BLOCKING unconditionally — they assert a determinate fateful outcome.
const FATE_PATTERNS = [
  /(?:会|将|要)被淘汰/, /没人要/, /一定没人/, /找不到工作/
]
// R65 §3 — an absolute token is BLOCKING only when the CLAUSE asserts an
// unsupported determinate factual/predictive outcome (a fate/guarantee).
const ABSOLUTE_OUTCOME_PAT = [
  // token -> (within a short clause) a determinate outcome noun/verb
  /(?:永远|一定|必然|注定|迟早|肯定)[^。！？\n]{0,12}(?:被淘汰|失业|找不到工作|没人要|没人买|卖不出去|赚不到|破产|完蛋|翻身|成功|赚钱|发财|暴富|盈利|变现)/,
  // token -> modal -> outcome (e.g. 肯定能让你赚钱)
  /(?:永远|一定|必然|注定|迟早|肯定)[^。！？\n]{0,4}(?:会|能)[^。！？\n]{0,6}(?:成功|赚钱|赚到|发财|暴富|翻身|盈利|变现|暴利)/,
  // unconditional guarantee idioms
  /(?:百分百|稳赚|包赚)/
]
// §16 — a report may NOT assert market validation the envelope does not have.
const MARKET_PROOF_PAT = /已经被市场验证|已被市场验证|市场已经为|让市场.{0,6}付过|市场反复验证|反复验证过|已经让市场|已经能被市场验证/
// Precise invented price numbers (R57: numeric pricing DISABLED).
const PRICE_PATTERN = /(?:￥|¥|\$|RMB|人民币)?\s*\d{2,6}\s*(?:元|块|万|k|K)/
// R62 §11 — CROSS-OBJECT COLLAPSE guard.
const CROSS_OBJECT_CONTRADICTION_PAT = /(你的回答|你这两处|两处回答|前后两处|上面两处|这两处信息|两处信息|你填的|你选的)[^。！？\n]{0,6}(矛盾|对不上|冲突|不一致|自相矛盾|打架)|自相矛盾|答案互相矛盾|回答互相矛盾|信息互相矛盾/
// R59 — the user's own financial facts (surplus / trial budget) are echoed
// back by the model as numbers; that is NOT an invented price.
const FACT_ECHO_PAT = /(结余|预算|成本|储蓄|存款|月收入|工资|承受|试错|现金流|支出|花销|每月|攒|存|可承受|最多)/

const len = (s) => (s == null ? 0 : [...String(s)].length)

// ── §2 R65 — severity registry ──────────────────────────────────────────
// BLOCKING: reject the AI report (R53 fallback).
const BLOCKING_REASON_CODES = [
  'MISSING_THESIS_FIELD', 'MISSING_CARD',
  'UNSUPPORTED_IDENTITY_FACT', 'SKILL_TO_OCCUPATION_INFERENCE',
  'MARKET_PROOF_MISMATCH', 'B1_AUTHORITY_MUTATION',
  'WORLD_RULE_OUTSIDE_ENVELOPE', 'MIGRATION_OUTSIDE_ENVELOPE',
  'UNPROVEN_PATH_OVERREACH', 'CROSS_CARD_THESIS_DRIFT',
  'NO_PRIMARY_BOTTLENECK_CLAIM', 'INVENTED_PRICE', 'GUARANTEED_OUTCOME',
  'FABRICATED_USER_HISTORY', 'FABRICATED_CUSTOMER_FACT', 'FABRICATED_INCOME_FACT',
  'UNSUPPORTED_AGE_OR_INDUSTRY_CLAIM', 'INTERNAL_TOKEN_LEAK',
  'CROSS_OBJECT_CONTRADICTION_CLAIM',
  'CARD01_OVER_BUDGET', 'CARD02_OVER_BUDGET', 'CARD03_OVER_BUDGET', 'CARD03_OVER_BULLETS',
  'CARD04_OVER_BUDGET', 'CARD05_OVER_BUDGET',
  'CARD05_MISSING_EXPERIMENT_FIELDS', 'CARD05_TEST_UNRELATED_TO_CARD04'
]
// REPAIRABLE: may be deterministically repaired locally, then re-validated.
const REPAIRABLE_REASON_CODES = ['UNSUPPORTED_ABSOLUTE_CLAIM']

/** True when a failure string's leading code is a BLOCKING code. */
function isBlockingReasonCode (failure) {
  const code = String(failure || '').split(':')[0]
  return BLOCKING_REASON_CODES.indexOf(code) !== -1
}

/**
 * §2 — classify every failure string into {blocking, repairable}.
 * Unknown codes fail closed (treated as BLOCKING).
 */
function classifySeverity (failures) {
  const blocking = []
  const repairable = []
  for (const f of (failures || [])) {
    if (isBlockingReasonCode(f)) blocking.push(f)
    else if (String(f || '').split(':')[0] && REPAIRABLE_REASON_CODES.indexOf(String(f).split(':')[0]) !== -1) repairable.push(f)
    else blocking.push(f) // unknown => fail closed
  }
  return { blocking, repairable }
}

/** Collect the flattened visible text. */
function collectText (out) {
  return visibleTextOf(out)
}

/**
 * R65 §3 — context-aware absolute-claim classification.
 * Returns { absolute: tokens found, blocking: [codes], repairable: [codes] }.
 * A token is BLOCKING only when its CLAUSE asserts an unsupported outcome.
 */
function classifyAbsoluteClaims (text) {
  const tokens = []
  const re = new RegExp(ABSOLUTE_TOKEN_RE.source, 'g')
  let m
  while ((m = re.exec(text))) tokens.push(m[0])
  if (!tokens.length) return { tokens: [], blocking: [], repairable: [] }

  // Clause-level outcome assertion (structural/rhetorical uses are repairable).
  const blocking = []
  for (const re2 of ABSOLUTE_OUTCOME_PAT) {
    const bm = text.match(re2)
    if (bm) {
      const code = /稳赚|包赚|百分百|赚钱|赚到|成功|发财|暴富/.test(bm[0]) ? 'GUARANTEED_OUTCOME' : 'UNSUPPORTED_ABSOLUTE_CLAIM'
      blocking.push(code + ':' + bm[0])
      break
    }
  }
  if (blocking.length) return { tokens: tokens, blocking: blocking, repairable: [] }
  return { tokens: tokens, blocking: [], repairable: ['UNSUPPORTED_ABSOLUTE_CLAIM:' + tokens.join(',')] }
}

/** §6/§15 checks: absolute / fate / price / forbidden tokens. */
function scanClaims (text) {
  const findings = { absolute: [], fate: [], price: [], forbiddenTokens: [] }
  const abs = classifyAbsoluteClaims(text)
  findings.absolute = abs.tokens
  for (const re of FATE_PATTERNS) { const m = text.match(re); if (m) findings.fate.push(m[0]) }
  // Price scan with fact-echo exclusion (R59).
  const priceRe = new RegExp(PRICE_PATTERN.source, 'g')
  let pm
  while ((pm = priceRe.exec(text))) {
    const before = text.slice(Math.max(0, pm.index - 12), pm.index)
    if (FACT_ECHO_PAT.test(before)) continue
    findings.price.push(pm[0].trim())
  }
  for (const tok of FORBIDDEN_TOKENS) { if (text.includes(tok)) findings.forbiddenTokens.push(tok) }
  return findings
}

/**
 * §3/§5 — detect fabricated occupation facts (R59 fix).
 */
const OCCUPATION_NOUN_PAT = /(程序员|软件工程师|工程师|开发者|设计师|自由职业|接活|接单|打工|上班|写代码|做开发|做设计|创业者|开公司|带团队|管人|做销售|产品经理|运营|会计|教师|律师|医生|护士|司机|厨师)/
const ASSERTION_PAT = /(你是|你是一个|你一直是|你是那个|你身为|作为一(?:名|个)|你既?是|身份是)/
const BIO_VERB_PAT = /(一直|长期|十年|多年|已经|曾经|一向)\s*(在)?\s*(接活|接项目|接单|打工|上班|写代码|做开发|做设计|创业|开公司|带团队|管人|做销售)/

// R65 §13 — explicit fabrication detectors (evidence not in the envelope).
const FABRICATED_CUSTOMER_PAT = /(有|拥有|积累|维护)[^。！？\n]{0,6}(付费客户|付费用户|付费的客户|付费的人|稳定客户|老客户|回头客|很多客户|大量客户|一批客户|一群客户)/
const FABRICATED_HISTORY_PAT = /(?<![不未])(一直|长期|多年|常年|一向)[^。！？\n]{0,8}(接项目|接单|接活|打工|上班|靠它赚钱|靠这个赚钱|靠接|收费变现|稳定成交|持续成交)/
const FABRICATED_INCOME_PAT = /(已经|早就|一直)[^。！？\n]{0,6}(赚到|拿到|有了一份|有稳定的|稳定的)[^。！？\n]{0,4}(收入|钱|工资外的钱|进账)/

function detectFabricatedFacts (text, envelope) {
  const codes = []
  if (FABRICATED_CUSTOMER_PAT.test(text)) codes.push('FABRICATED_CUSTOMER_FACT')
  if (FABRICATED_HISTORY_PAT.test(text)) codes.push('FABRICATED_USER_HISTORY')
  if (FABRICATED_INCOME_PAT.test(text)) codes.push('FABRICATED_INCOME_FACT')
  return codes
}

function detectFabricatedOccupation (text, envelope) {
  const hasOccupation = (envelope.facts || []).some((f) => f.field === 'occupationDetail')
  const assertedRole = OCCUPATION_NOUN_PAT.test(text) && ASSERTION_PAT.test(text)
  return { assertedRole: assertedRole, hasOccupationFact: hasOccupation }
}

/**
 * Validate an AI thesis output against the envelope.
 * @returns {{valid:boolean, hardFailures:string[], blockingFailures:string[],
 *   repairableFailures:string[], softFindings:Object, findings:Object}}
 */
function validateThesisV6 (output, envelope) {
  const hard = []
  const o = normalizeThesisOutput(output)
  const st = o.strategicThesis
  const c = o.cards
  const env = envelope || {}

  // ── presence of all thesis fields + five cards ──
  const thesisFields = ['identityInterpretation', 'coreContradiction', 'structuralMechanism', 'commercialHypothesis', 'actionThesis']
  for (const f of thesisFields) if (!st[f]) hard.push('MISSING_THESIS_FIELD:' + f)
  if (!st.worldRule.id || !st.worldRule.expression) hard.push('MISSING_THESIS_FIELD:worldRule')
  if (!st.strategicMigration.from || !st.strategicMigration.to) hard.push('MISSING_THESIS_FIELD:strategicMigration')
  if (!c.card01) hard.push('MISSING_CARD:card01')
  if (!c.card02) hard.push('MISSING_CARD:card02')
  if (!c.card03.length) hard.push('MISSING_CARD:card03')
  if (!c.card04.from || !c.card04.to) hard.push('MISSING_CARD:card04')
  if (!c.card05.primary) hard.push('MISSING_CARD:card05')

  // ── §12 WORLD RULE — must be one of the allowed ids ──
  const allowedRules = env.allowedWorldRules || []
  if (st.worldRule.id && allowedRules.indexOf(st.worldRule.id) === -1) hard.push('WORLD_RULE_OUTSIDE_ENVELOPE')

  // ── §11 MIGRATION — must be within allowed positions ──
  const allowedMig = (env.allowedTargetPositions || []).map((m) => m.id)
  const migBlob = (st.strategicMigration.logic + ' ' + c.card04.logic + ' ' + c.card04.to)
  if (env.diagnosisState === 'NO_PRIMARY' && env.crossAxisScope === 'UNPROVEN') {
    if (/(扩大|放大|复制|系统化|标准化|规模化|多接|接更多|做成方法|照搬|重复做)/.test(migBlob)) hard.push('UNPROVEN_PATH_OVERREACH')
  }
  // §7/§8 R65 — an UNPAID-PROOF envelope must not let copy claim paid validation
  // or jump to stable/repeat/systematized income.
  if (env.marketProof && env.marketProof.validated === false && env.currentValuePosition !== 'VALUE_REPEATABLE_PAID') {
    if (/(稳定收入|可重复的收入|重复收入|已经能收|系统化收入|一份稳定的收入)/.test(migBlob)) hard.push('MIGRATION_OUTSIDE_ENVELOPE')
  }
  if (allowedMig.length && allowedMig.indexOf('TEST_ASSET_TO_GOAL_LINK') !== -1) {
    if (/(这项能力就是|能力就是你的方向|直接把它当成|这条路就是)/.test(migBlob)) hard.push('MIGRATION_OUTSIDE_ENVELOPE')
  }

  // ── text scans ──
  const text = collectText(o)
  const scan = scanClaims(text)
  const abs = classifyAbsoluteClaims(text)

  // §3 R65 — context-aware absolute claims: BLOCKING only on outcome assertion.
  for (const code of abs.blocking) hard.push(code)
  // fateful individualized/industry predictions stay BLOCKING.
  if (scan.fate.length) hard.push('UNSUPPORTED_AGE_OR_INDUSTRY_CLAIM:' + scan.fate.join(','))
  // §14 — numeric price forbidden.
  if (scan.price.length) hard.push('INVENTED_PRICE:' + scan.price.join(','))
  // R62 §11 — must never claim the user's own two answers contradict.
  const collapse = detectCrossObjectCollapse(text)
  if (collapse) hard.push('CROSS_OBJECT_CONTRADICTION_CLAIM:' + collapse)
  // internal ontology leakage
  if (scan.forbiddenTokens.length) hard.push('INTERNAL_TOKEN_LEAK:' + scan.forbiddenTokens.join(','))

  // §3/§5 — fabricated occupation/identity
  const fab = detectFabricatedOccupation(text, env)
  if (fab.assertedRole && !fab.hasOccupationFact) hard.push('UNSUPPORTED_IDENTITY_FACT')
  if (BIO_VERB_PAT.test(text)) {
    const supplied = (env.facts || []).some((f) => ['occupationDetail', 'incomeStructure'].indexOf(f.field) !== -1)
    if (!supplied || /(十年|多年|一直|长期)/.test(text)) hard.push('UNSUPPORTED_IDENTITY_FACT:biography')
  }

  // ── §16 marketProof consistency — report must not INVENT market validation. ──
  if (env.marketProof && env.marketProof.validated === false) {
    const m = text.match(MARKET_PROOF_PAT)
    if (m) hard.push('MARKET_PROOF_MISMATCH:' + m[0])
  }

  // ── §13 R65 — fabricated customer / history / income facts (evidence absent). ──
  // These patterns assert evidence the envelope never carries as a fact (paid
  // clients / a history of earning from it / already-stable income); they are
  // BLOCKING unconditionally.
  for (const code of detectFabricatedFacts(text, env)) hard.push(code)

  // ── §10 NO_PRIMARY must not claim a primary bottleneck ──
  if (env.diagnosisState === 'NO_PRIMARY') {
    if (/(真正的瓶颈|你的瓶颈就是|根本瓶颈|你最大的瓶颈就是)/.test(text)) hard.push('NO_PRIMARY_BOTTLENECK_CLAIM')
  }

  // §5 R65 — REPAIRABLE absolute intensity is appended as a repairable finding
  // (only when not already blocking via outcome assertion).
  for (const code of abs.repairable) hard.push(code)

  // ── §18 word budgets ──
  if (len(c.card01) > BUDGET.card01) hard.push('CARD01_OVER_BUDGET')
  if (len(c.card02) > BUDGET.card02) hard.push('CARD02_OVER_BUDGET')
  if (c.card03.length > BUDGET.card03MaxBullets) hard.push('CARD03_OVER_BULLETS')
  if (len(c.card03.join('')) > BUDGET.card03) hard.push('CARD03_OVER_BUDGET')
  if (len(c.card04.from + c.card04.to + c.card04.logic) > BUDGET.card04) hard.push('CARD04_OVER_BUDGET')
  if (len(c.card05.primary + c.card05.supporting.join('') + c.card05.target + c.card05.timebox + c.card05.successSignal) > BUDGET.card05) hard.push('CARD05_OVER_BUDGET')

  // ── §17 THESIS DRIFT — cards must express the SAME thesis ──
  const drift = detectThesisDrift(o, env)
  if (drift) hard.push('CROSS_CARD_THESIS_DRIFT:' + drift)

  // ── §19 CARD05 experiment alignment ──
  const c05 = (c.card05.primary + ' ' + c.card05.supporting.join(' ') + ' ' + c.card05.successSignal)
  if (!c.card05.target || !c.card05.timebox || !c.card05.successSignal) hard.push('CARD05_MISSING_EXPERIMENT_FIELDS')
  if (env.crossAxisScope === 'UNPROVEN' && env.diagnosisState === 'NO_PRIMARY') {
    if (!/(连接|连不连|用得上|用不上|同一个问题|目标方向|这条路)/.test(c05)) hard.push('CARD05_TEST_UNRELATED_TO_CARD04')
  }

  const sev = classifySeverity(hard)
  return {
    valid: hard.length === 0,
    hardFailures: hard,
    blockingFailures: sev.blocking,
    repairableFailures: sev.repairable,
    softFindings: { price: scan.price, absolute: scan.absolute, fate: scan.fate },
    findings: { forbiddenTokens: scan.forbiddenTokens, fabricatedOccupation: fab }
  }
}

/**
 * R62 §11 — detect a CROSS-OBJECT COLLAPSE.
 */
function detectCrossObjectCollapse (text) {
  const s = text == null ? '' : String(text)
  const m = s.match(CROSS_OBJECT_CONTRADICTION_PAT)
  return m ? m[0] : null
}

/**
 * §17 explicit drift detection. Returns a reason string or null.
 */
function detectThesisDrift (o, env) {
  const c1 = o.cards.card01
  const c4 = o.cards.card04.from + ' ' + o.cards.card04.to + ' ' + o.cards.card04.logic
  const COMMERCIAL = /(卖成|成交|付费|买单|收入|变现|客户|报价|服务)/
  const CAREER_SWITCH = /(转行|换赛道|进入新领域|换个行业|辞职)/
  const CONTENT = /(内容|流量|涨粉|短视频|直播|写作变现)/
  const fam = (s) => [COMMERCIAL.test(s), CAREER_SWITCH.test(s), CONTENT.test(s)].map((x, i) => x ? i : -1).filter((i) => i >= 0)
  const f1 = fam(c1)
  const f4 = fam(c4)
  if (f1.length && f4.length && f1.every((x) => f4.indexOf(x) === -1)) {
    return 'CARD01_CARD04_STRATEGY_MISMATCH'
  }
  return null
}

module.exports = {
  validateThesisV6,
  classifySeverity,
  isBlockingReasonCode,
  classifyAbsoluteClaims,
  detectFabricatedFacts,
  detectThesisDrift,
  detectCrossObjectCollapse,
  scanClaims,
  BUDGET,
  ABSOLUTE_TOKEN_RE,
  ABSOLUTE_OUTCOME_PAT,
  FATE_PATTERNS,
  PRICE_PATTERN,
  FACT_ECHO_PAT,
  OCCUPATION_NOUN_PAT,
  MARKET_PROOF_PAT,
  CROSS_OBJECT_CONTRADICTION_PAT,
  FABRICATED_CUSTOMER_PAT,
  FABRICATED_HISTORY_PAT,
  FABRICATED_INCOME_PAT,
  BLOCKING_REASON_CODES,
  REPAIRABLE_REASON_CODES
}
