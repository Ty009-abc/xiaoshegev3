'use strict'
/**
 * turnaroundStrategy/v6/thesis/thesisValidatorV6.js
 *
 * RC8.4 V6 R57 — DETERMINISTIC THESIS VALIDATOR.
 *
 * Validates an AI thesis output against the envelope:
 *   FACT SUPPORT · THESIS COHERENCE · WORLD RULE · MIGRATION ·
 *   CROSS AXIS SCOPE · EXPERIMENT ALIGNMENT · FORBIDDEN CLAIMS.
 *
 * Any hard failure => the caller must return the R53 deterministic report
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
// signal structurally overflows the old 220 (R58 finding).
const BUDGET = {
  card01: 50,
  card02: 160,
  card03: 235,
  card03MaxBullets: 5,
  card04: 175,
  card05: 280
}

// ── §6 absolute / fateful claim patterns (rejected unless definitional) ──
// Negated forms (不一定 / 未必 / 不必然) are NOT absolute claims and must pass.
const ABSOLUTE_PATTERNS = [
  /(?<![不未])永远/, /(?<![不未])一定/, /(?<![不未])必然/, /(?<![不未])注定/,
  /(?<![不未])迟早/, /肯定会/, /百分百/, /稳赚/, /包赚/,
  /一定赚不到/, /必然失败/, /一定会被淘汰/
]
// Fateful individualized/industry predictions (age/industry determinism).
const FATE_PATTERNS = [
  /(?:会|将|要)被淘汰/, /没人要/, /一定没人/, /找不到工作/
]
// §16 — a report may NOT assert market validation the envelope does not have.
const MARKET_PROOF_PAT = /已经被市场验证|已被市场验证|市场已经为|让市场.{0,6}付过|市场反复验证|反复验证过|已经让市场|已经能被市场验证/
// Precise invented price numbers (R57: numeric pricing DISABLED).
const PRICE_PATTERN = /(?:￥|¥|\$|RMB|人民币)?\s*\d{2,6}\s*(?:元|块|万|k|K)/
// R59 — the user's own financial facts (surplus / trial budget) are echoed
// back by the model as numbers; that is NOT an invented price. If the ~12
// chars before a number+unit carry one of these fact contexts, it is an echo.
const FACT_ECHO_PAT = /(结余|预算|成本|储蓄|存款|月收入|工资|承受|试错|现金流|支出|花销|每月|攒|存|可承受|最多)/

const len = (s) => (s == null ? 0 : [...String(s)].length)

/** Collect the flattened visible text. */
function collectText (out) {
  return visibleTextOf(out)
}

/** §6/§15 checks: absolute / fate / price / forbidden tokens. */
function scanClaims (text) {
  const findings = { absolute: [], fate: [], price: [], forbiddenTokens: [] }
  for (const re of ABSOLUTE_PATTERNS) { const m = text.match(re); if (m) findings.absolute.push(m[0]) }
  for (const re of FATE_PATTERNS) { const m = text.match(re); if (m) findings.fate.push(m[0]) }
  // Price scan with fact-echo exclusion (R59): skip numbers that are part of
  // the user's own supplied financial facts.
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
 * A bare pronoun + article ("你是一个…的人") is NOT an occupation claim; only
 * flag when the text BOTH asserts the user IS something AND names an actual
 * occupation the user did not supply. Occupation nouns are explicit roles.
 */
const OCCUPATION_NOUN_PAT = /(程序员|软件工程师|工程师|开发者|设计师|自由职业|接活|接单|打工|上班|写代码|做开发|做设计|创业者|开公司|带团队|管人|做销售|产品经理|运营|会计|教师|律师|医生|护士|司机|厨师)/
const ASSERTION_PAT = /(你是|你是一个|你一直是|你是那个|你身为|作为一(?:名|个)|你既?是|身份是)/
const BIO_VERB_PAT = /(一直|长期|十年|多年|已经|曾经|一向)\s*(在)?\s*(接活|接项目|接单|打工|上班|写代码|做开发|做设计|创业|开公司|带团队|管人|做销售)/

function detectFabricatedOccupation (text, envelope) {
  const hasOccupation = (envelope.facts || []).some((f) => f.field === 'occupationDetail')
  const assertedRole = OCCUPATION_NOUN_PAT.test(text) && ASSERTION_PAT.test(text)
  return { assertedRole: assertedRole, hasOccupationFact: hasOccupation }
}

/**
 * Validate an AI thesis output against the envelope.
 * @returns {{valid:boolean, hardFailures:string[], softFindings:Object, findings:Object}}
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
    // link-first only: reject any scale/repeat/systematize language.
    if (/(扩大|放大|复制|系统化|标准化|规模化|多接|接更多|做成方法|照搬|重复做)/.test(migBlob)) hard.push('UNPROVEN_PATH_OVERREACH')
  }
  if (allowedMig.length && allowedMig.indexOf('TEST_ASSET_TO_GOAL_LINK') !== -1) {
    // envelope is link-first: migration must not claim the asset IS the path.
    if (/(这项能力就是|能力就是你的方向|直接把它当成|这条路就是)/.test(migBlob)) hard.push('MIGRATION_OUTSIDE_ENVELOPE')
  }

  // ── text scans ──
  const text = collectText(o)
  const scan = scanClaims(text)

  // §6 — absolute/fateful claims are hard failures (§6 UNSUPPORTED_ABSOLUTE_CLAIM=0).
  if (scan.absolute.length) hard.push('UNSUPPORTED_ABSOLUTE_CLAIM:' + scan.absolute.join(','))
  if (scan.fate.length) hard.push('UNSUPPORTED_AGE_OR_INDUSTRY_CLAIM:' + scan.fate.join(','))
  // §14 — numeric price forbidden.
  if (scan.price.length) hard.push('INVENTED_PRICE:' + scan.price.join(','))
  // internal ontology leakage
  if (scan.forbiddenTokens.length) hard.push('INTERNAL_TOKEN_LEAK:' + scan.forbiddenTokens.join(','))

  // §3/§5 — fabricated occupation/identity
  const fab = detectFabricatedOccupation(text, env)
  if (fab.assertedRole && !fab.hasOccupationFact) hard.push('UNSUPPORTED_IDENTITY_FACT')
  if (BIO_VERB_PAT.test(text)) {
    // biography verbs that assert history the user did not supply
    const supplied = (env.facts || []).some((f) => ['occupationDetail', 'incomeStructure'].indexOf(f.field) !== -1)
    if (!supplied || /(十年|多年|一直|长期)/.test(text)) hard.push('UNSUPPORTED_IDENTITY_FACT:biography')
  }

  // ── §16 marketProof consistency — report must not INVENT market validation. ──
  if (env.marketProof && env.marketProof.validated === false) {
    const m = text.match(MARKET_PROOF_PAT)
    if (m) hard.push('MARKET_PROOF_MISMATCH:' + m[0])
  }

  // ── §10 NO_PRIMARY must not claim a primary bottleneck ──
  if (env.diagnosisState === 'NO_PRIMARY') {
    if (/(真正的瓶颈|你的瓶颈就是|根本瓶颈|你最大的瓶颈就是)/.test(text)) hard.push('NO_PRIMARY_BOTTLENECK_CLAIM')
  }

  // ── §18 word budgets ──
  if (len(c.card01) > BUDGET.card01) hard.push('CARD01_OVER_BUDGET')
  if (len(c.card02) > BUDGET.card02) hard.push('CARD02_OVER_BUDGET')
  if (c.card03.length > BUDGET.card03MaxBullets) hard.push('CARD03_OVER_BULLETS')
  if (len(c.card03.join('')) > BUDGET.card03) hard.push('CARD03_OVER_BUDGET')
  if (len(c.card04.from + c.card04.to + c.card04.logic) > BUDGET.card04) hard.push('CARD04_OVER_BUDGET')
  if (len(c.card05.primary + c.card05.supporting.join('') + c.card05.target + c.card05.timebox + c.card05.successSignal) > BUDGET.card05) hard.push('CARD05_OVER_BUDGET')

  // ── §17 THESIS DRIFT — cards must express the SAME thesis ──
  // Heuristic: card01 vs card04 must reference a common theme token.
  const drift = detectThesisDrift(o, env)
  if (drift) hard.push('CROSS_CARD_THESIS_DRIFT:' + drift)

  // ── §19 CARD05 experiment alignment (must reference the experiment class intent) ──
  const c05 = (c.card05.primary + ' ' + c.card05.supporting.join(' ') + ' ' + c.card05.successSignal)
  if (!c.card05.target || !c.card05.timebox || !c.card05.successSignal) hard.push('CARD05_MISSING_EXPERIMENT_FIELDS')
  if (env.crossAxisScope === 'UNPROVEN' && env.diagnosisState === 'NO_PRIMARY') {
    if (!/(连接|连不连|用得上|用不上|同一个问题|目标方向|这条路)/.test(c05)) hard.push('CARD05_TEST_UNRELATED_TO_CARD04')
  }

  return {
    valid: hard.length === 0,
    hardFailures: hard,
    softFindings: { price: scan.price, absolute: scan.absolute, fate: scan.fate },
    findings: { forbiddenTokens: scan.forbiddenTokens, fabricatedOccupation: fab }
  }
}

/**
 * §17 explicit drift detection. Returns a reason string or null.
 * Card01 theme vs card04 theme must not imply different strategies.
 */
function detectThesisDrift (o, env) {
  const c1 = o.cards.card01
  const c4 = o.cards.card04.from + ' ' + o.cards.card04.to + ' ' + o.cards.card04.logic
  // theme vocabularies (mutually-exclusive strategy families)
  const COMMERCIAL = /(卖成|成交|付费|买单|收入|变现|客户|报价|服务)/
  const CAREER_SWITCH = /(转行|换赛道|进入新领域|换个行业|辞职)/
  const CONTENT = /(内容|流量|涨粉|短视频|直播|写作变现)/
  const fam = (s) => [COMMERCIAL.test(s), CAREER_SWITCH.test(s), CONTENT.test(s)].map((x, i) => x ? i : -1).filter((i) => i >= 0)
  const f1 = fam(c1)
  const f4 = fam(c4)
  if (f1.length && f4.length && f1.every((x) => f4.indexOf(x) === -1)) {
    // card01 and card04 point at different strategy families
    return 'CARD01_CARD04_STRATEGY_MISMATCH'
  }
  return null
}

module.exports = {
  validateThesisV6,
  detectThesisDrift,
  scanClaims,
  BUDGET,
  ABSOLUTE_PATTERNS,
  PRICE_PATTERN,
  FACT_ECHO_PAT,
  OCCUPATION_NOUN_PAT,
  MARKET_PROOF_PAT
}
