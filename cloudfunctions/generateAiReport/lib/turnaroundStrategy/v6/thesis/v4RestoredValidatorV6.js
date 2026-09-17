'use strict'
/**
 * turnaroundStrategy/v6/thesis/v4RestoredValidatorV6.js
 *
 * RC8.4 V6 R70 — MINIMAL hard-ban validator for the V4-restored path.
 * RC8.4 V6 R73 — NARROW REPAIR of three hard-ban weaknesses ONLY
 *   (FABRICATED_INCOME / GUARANTEED_OUTCOME / FABRICATED_CUSTOMER).
 *
 * PHILOSOPHY (UNCHANGED — R70 §2):
 *   Restores high-freedom inference: ONLY true safety violations block. Every
 *   lexical / keyword / world-rule-id / migration-id / style / budget rule from
 *   the R6x guarded path is ABSENT here, so a bold but truthful report is NEVER
 *   rejected. Bold language, identity interpretation, career inference,
 *   commercial hypotheses, world-rule language, migration language, card
 *   alignment, tone, absolute-sounding style, NO_PRIMARY wording and keyword
 *   mismatch are NOT blocking (STYLE_BLOCKING_RULE_COUNT = 0).
 *
 * BLOCKING (hard) — exactly the same 7 categories:
 *   FABRICATED_OCCUPATION      invented a specific occupation the user did not give
 *   FABRICATED_INCOME          asserted a specific income AMOUNT the user did not give
 *   FABRICATED_CUSTOMER        asserted the user ALREADY HAS customers (history)
 *   FABRICATED_CREDENTIAL      asserted credentials/资历 the user did not give
 *   FABRICATED_HISTORY         asserted a fabricated past experience
 *   GUARANTEED_OUTCOME         guaranteed the user's success / earnings / outcome
 *   ILLEGAL_CONTENT            illegal instruction
 *
 * TELEMETRY (non-blocking) — recorded but NEVER rejects:
 *   NO_SHARED_THESIS, ANSWER_PARAPHRASE_DOMINANT, INTERNAL_TOKEN_LEAK, BUDGET_SOFT
 *
 * IMPLEMENTATION NOTE (R73 §11): NOT one giant regex. For income / guarantee /
 * customer we normalize the text into CLAUSES, detect the CLAIM CLASS + the
 * ASSERTION modality (present/past fact vs future/hypothesis), and compare
 * against the ACTUAL user facts. Deterministic. NO second LLM call. No I/O.
 *
 * FACT vs HYPOTHESIS boundary (R73 §10, frozen):
 *   BLOCK "你已经有 X" / "你赚 X"   ALLOW "你可以面向 X" / "下一步做到 X"
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

// ── Illegal-content patterns ──
// ALWAYS illegal OPERATIONS (unambiguous).
const ILLEGAL_OP_PAT = /(洗钱|诈骗|传销|贩毒|走私|非法集资|套现|刷单|黄牛倒卖|行贿|受贿|做假账|虚开发票|偷税|逃税|跑分)/
// GAMBLING words: illegal ONLY as an instruction/advocacy; a SIMILE / negation
// ("把变现当成一场赌博" / "不要赌博") is advice, not illegal content.
const GAMBLING_PAT = /(赌博|赌场|博彩)/
// An instruction/advocacy cue immediately before (<=3) or after (<=4) the token.
const GAMBLING_INSTR_BEFORE = /(去|靠|通过|用|拿来|建议|选择|不如|干脆|参与)$/
const GAMBLING_INSTR_AFTER = /^(去|靠|赚钱|赢钱|来钱|发财|回本|翻本|下注|押注|赚|赢)/
const ILLEGAL_PAT = ILLEGAL_OP_PAT
// Broadcast negation / contrast / simile guard (applied before a matched token).
const ILLEGAL_NEG_BEFORE = /(不是|并非|不在|别|不要|远离|避免|拒绝|反对|禁止|像|如同|似的|当成|当作|一场|一种)/

// ── Fabrication cues: identity markers that assert a SPECIFIC unearned fact ──
// A fabricated occupation is only flagged when the user did NOT provide one.
const OCCUPATION_CUE = /(作为|身为|你是|你是一个|你是一名|作为一名)[^，。；\n]{0,10}(程序员|工程师|教师|老师|医生|护士|律师|会计|厨师|司机|销售|设计师|运营|产品经理|公务员|销售员|客服|美工|文案|编导|主播|理发师|美容师|店主|老板)/
const CREDENTIAL_CUE = /(你(持有|拥有|取得)(了)?[^，。\n]{0,12}(证书|资格证|学位|学历|牌照|执照)|你(是|有)[^，。\n]{0,6}(专业认证|注册))/
const HISTORY_CUE = /(你过去(曾|在)[^，。\n]{0,14}(工作过|做过|任职|供职)|你(曾经|以前)(是|在)[^，。\n]{0,10}(公司|单位|企业))/

// ── Guaranteed-outcome tokens + outcome classes ──
// The ban is GUARANTEED USER OUTCOME, never strong wording by itself.
const GUARANTEE_TOKENS = ['稳赚不赔', '稳赚', '保证', '确保', '保准', '包你', '保你', '管保', '肯定会', '肯定能', '必定', '必然', '一定']
const OUTCOME_TOKEN = /(成功|赚到|挣到|赚钱|挣到钱|月入|年入|月收入|年收入|收入达到|收入翻|翻身|发财|暴富|盈利|收益|实现收入|变现成功|赚)/
const GUARANTEE_PAT = /稳赚不赔|稳赚|保证|确保|保准|包你|保你|管保|肯定会|肯定能|必定|必然|一定/
const NEG_CUE = /[不没无别非]/

// ── Income: amount claim semantics ──
// Generic income TYPE evidence ("主要靠一份工资") NEVER authorizes a specific
// income AMOUNT claim ("你月薪30000").
const INCOME_WORD = /(月薪|月收入|月入|年薪|年收入|年入|工资|净收入|到手|收入|赚|挣)/g
const AMOUNT_ARABIC = /([0-9]+(?:\.[0-9]+)?)\s*(万|w|W|k|K|千|亿)?/g
const AMOUNT_CN = /[零一二三四五六七八九十百千万亿两廿]{1,8}/g

// ── Customer: existence/history assertion of ALREADY-HAVE customers ──
const CUSTOMER_NOUN = /(客户|客户群|付费客户|稳定客户|回头客|复购客户|长期客户|固定客户|企业客户|老客户|种子客户)/
const EXIST_CUE = /(你现在有|你目前有|你如今有|你现在拥有|你已经拥有|你现在已经有|你已经有|你已拥有|你拥有|你手上有|你手头有|你积累了|你已积累|你服务过|你已服务|你发展出|你维护着|你有一批|你有一群|服务过(?!程)|发展出|已经拥有|已经有一批|已经有一群|目前有一批|手上有一批)/

// ── Modality cues ──
// ASSERTION = a present/past FACT about the user; FUTURE = a plan/goal/hypothesis.
// Only genuine PLANNING words count as future modality — bare goal-verbs
// (达到/做到/提升/变成…) can describe an achieved state and MUST NOT be treated
// as forward-looking on their own (§10 boundary).
const ASSERTION_CUE = /(你现在|你目前|你如今|你当下|你已经|你已|现在的你)/
const FUTURE_CUE = /(目标|争取|希望|打算|计划|下一步|未来|想要|准备|试图|尝试|可以|能够|应该|如果|若|假设|建议|试着|面向|针对)/

const CN_DIGIT = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 百: 100, 千: 1000, 万: 10000, 亿: 100000000, 廿: 20 }

/** Parse a Chinese numeral string (三万 / 两万五 / 三十六万 / 一万二 / 三千). */
function cnToNum (s) {
  let total = 0; let section = 0; let num = 0; let lastUnit = 0
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]; const d = CN_DIGIT[ch]
    if (d == null) continue
    if (ch === '万' || ch === '亿') {
      const unit = ch === '万' ? 10000 : 100000000
      if (num === 0 && section === 0) num = 1
      section = (section + num) * unit
      total += section; section = 0; num = 0; lastUnit = unit
    } else if (d >= 10) {
      if (num === 0) num = 1
      section += num * d; num = 0
    } else {
      num = d
    }
  }
  let val = total + section + num
  // trailing bare digit after 万 (colloquial): 两万五 => 25000, 一万二 => 12000
  if (num > 0 && num < 10 && lastUnit === 10000 && section === 0 && total > 0) {
    val = total + num * 1000
  }
  return val
}

/** Find amount tokens (arabic + unit, or Chinese numeral) with value + unit info. */
function findAmounts (sentence) {
  const out = []
  let m
  AMOUNT_ARABIC.lastIndex = 0
  while ((m = AMOUNT_ARABIC.exec(sentence)) !== null) {
    const unit = m[2] || ''
    let val = parseFloat(m[1])
    if (unit === '万' || unit === 'w' || unit === 'W') val *= 10000
    else if (unit === 'k' || unit === 'K' || unit === '千') val *= 1000
    else if (unit === '亿') val *= 100000000
    out.push({ index: m.index, length: m[0].length, value: val, hasUnit: !!unit, raw: m[0] })
    if (m[0].length === 0) AMOUNT_ARABIC.lastIndex++
  }
  AMOUNT_CN.lastIndex = 0
  while ((m = AMOUNT_CN.exec(sentence)) !== null) {
    const val = cnToNum(m[0])
    const hasUnit = /[万千亿]/.test(m[0])
    out.push({ index: m.index, length: m[0].length, value: val, hasUnit, raw: m[0], cn: true })
  }
  return out
}

/** True when an amount is a meaningful income figure (has unit or ≥ 1000). */
function isMeaningfulAmount (a) { return a.hasUnit || a.value >= 1000 }

/** Nearest edge distance between an income word and an amount token. */
function near (aIdx, aLen, bIdx, bLen, max) {
  const d = aIdx <= bIdx ? bIdx - (aIdx + aLen) : aIdx - (bIdx + bLen)
  return d <= max
}

// Non-income NUMERIC fields — an amount belonging to one of these must NOT be
// read as income (R73 §5 CROSS_FIELD_NUMERIC_AUTHORITY_LEAK = 0).
const NON_INCOME_FIELD = /(结余|存款|储蓄|存下|存了|留出|省出|攒|预算|试错|备用|负债|房贷|欠款|信用卡|花呗|月供|开支|支出|房租|生活费|现金流|本金)/

function detectIncome (sentence) {
  // FABRICATED_INCOME is about asserting THE USER'S income. A goal/target phrase
  // without a user subject ("月收入达到3000-5000元") is a plan, not a claim (§10).
  if (!/[你您]/.test(sentence)) return null
  let m
  INCOME_WORD.lastIndex = 0
  const words = []
  while ((m = INCOME_WORD.exec(sentence)) !== null) {
    words.push({ index: m.index, length: m[0].length, word: m[0] })
    if (m[0].length === 0) INCOME_WORD.lastIndex++
  }
  if (!words.length) return null
  const amounts = findAmounts(sentence).filter(isMeaningfulAmount)
  if (!amounts.length) return null
  for (const w of words) {
    for (const a of amounts) {
      // Tight adjacency (income word + optional small connector only) — a mere
      // nearby amount in the same sentence is NOT an income claim.
      if (!near(w.index, w.length, a.index, a.length, 3)) continue
      // Guard: if the amount is owned by a non-income numeric field
      // (surplus / budget / safety / debt), it is NOT an income claim.
      const pre = sentence.slice(Math.max(0, a.index - 3), a.index)
      if (NON_INCOME_FIELD.test(pre)) continue
      const lo = Math.min(w.index + w.length, a.index + a.length)
      const hi = Math.max(w.index, a.index)
      const between = sentence.slice(lo, hi)
      if (NON_INCOME_FIELD.test(between)) continue
      return { income: w, amount: a }
    }
  }
  return null
}

function detectIllegal (text) {
  const scan = (pat) => {
    const g = new RegExp(pat.source, 'g')
    let m
    while ((m = g.exec(text)) !== null) {
      const before = text.slice(Math.max(0, m.index - 8), m.index)
      if (ILLEGAL_NEG_BEFORE.test(before)) continue
      return m[0]
    }
    return null
  }
  const op = scan(ILLEGAL_OP_PAT)
  if (op) return op
  // Gambling: block only when framed as an instruction/advocacy, not a simile.
  const g = new RegExp(GAMBLING_PAT.source, 'g')
  let m
  while ((m = g.exec(text)) !== null) {
    const before = text.slice(Math.max(0, m.index - 8), m.index)
    if (ILLEGAL_NEG_BEFORE.test(before)) continue
    const immBefore = text.slice(Math.max(0, m.index - 3), m.index)
    const immAfter = text.slice(m.index + m[0].length, m.index + m[0].length + 4)
    if (GAMBLING_INSTR_BEFORE.test(immBefore) || GAMBLING_INSTR_AFTER.test(immAfter)) return m[0]
  }
  return null
}

function detectGuarantee (sentence) {
  for (const tok of GUARANTEE_TOKENS) {
    let from = 0
    while (true) {
      const idx = sentence.indexOf(tok, from)
      if (idx < 0) break
      const before = sentence.slice(Math.max(0, idx - 2), idx)
      const negated = NEG_CUE.test(before)
      if (!negated) {
        const window = sentence.slice(Math.max(0, idx - 12), idx + tok.length + 14)
        const om = window.match(OUTCOME_TOKEN)
        if (om) return { token: tok, outcome: om[0] }
      }
      from = idx + tok.length
    }
  }
  return null
}

function detectCustomer (sentence) {
  if (!/(你|您)/.test(sentence)) return null
  const om = sentence.match(EXIST_CUE)
  if (!om) return null
  const nm = sentence.match(CUSTOMER_NOUN)
  if (!nm) return null
  return { cue: om[0], noun: nm[0] }
}

/** Split visible text into clauses (punctuation-delimited), preserving order. */
function clauses (text) {
  return String(text).split(/[。！？；\n]+/).map((s) => s.trim()).filter(Boolean)
}

function classifySeverity (code) {
  if (BLOCKING_REASON_CODES.indexOf(code) !== -1) return 'BLOCKING'
  if (TELEMETRY_REASON_CODES.indexOf(code) !== -1) return 'TELEMETRY'
  // Unknown code -> telemetry (the R70 path never blocks on unknown/lexical codes).
  return 'TELEMETRY'
}

/**
 * Detect minimal hard-ban violations.
 * @param {Object} output normalized/raw output
 * @param {Object} payload { userContext, diagnosticContext, hasUserOccupation }
 * @returns {{blocking:string[], telemetry:string[], detail:Object, valid:boolean}}
 */
function validateV4Restored (output, payload) {
  const text = visibleTextOf(output)
  const p = payload || {}
  const uc = p.userContext || {}
  const blocking = []
  const detail = {}
  const add = (code, d) => { if (blocking.indexOf(code) === -1) blocking.push(code); if (d != null) detail[code] = d }

  // ── Occupation: violation only when the user did NOT provide occupation ──
  if (!uc.occupationDetail && OCCUPATION_CUE.test(text)) add('FABRICATED_OCCUPATION', (text.match(OCCUPATION_CUE) || [])[0])

  // ── Credential / history (unchanged) ──
  if (CREDENTIAL_CUE.test(text)) add('FABRICATED_CREDENTIAL', (text.match(CREDENTIAL_CUE) || [])[0])
  if (HISTORY_CUE.test(text)) add('FABRICATED_HISTORY', (text.match(HISTORY_CUE) || [])[0])

  // ── Income amount: specific numeric claim vs. supported qualitative reading ──
  // The provided profile has NO specific income amount (income STRUCTURE + surplus
  // RANGE only), so an asserted amount is unsupported BY CONSTRUCTION. Surplus /
  // trial budget / safety months / debt are NOT income (cross-field leak = 0).
  const incomeClauses = clauses(text)
  for (const cl of incomeClauses) {
    const hit = detectIncome(cl)
    if (!hit) continue
    const hasAssertion = ASSERTION_CUE.test(cl)
    const hasFuture = FUTURE_CUE.test(cl)
    if (!hasFuture || hasAssertion) {
      add('FABRICATED_INCOME', { raw: hit.amount.raw, word: hit.income.word, clause: cl })
      break
    }
  }

  // ── Guaranteed outcome: guarantee token + outcome class in the same window ──
  for (const cl of incomeClauses) {
    const g = detectGuarantee(cl)
    if (g) { add('GUARANTEED_OUTCOME', { token: g.token, outcome: g.outcome, clause: cl }); break }
  }

  // ── Guarantee via a standalone pattern (稳赚不赔 style handled by tokens) ──

  // ── Customer: existence/history assertion (NOT forward-looking hypothesis) ──
  for (const cl of incomeClauses) {
    const hit = detectCustomer(cl)
    if (!hit) continue
    const hasAssertion = ASSERTION_CUE.test(cl) || /已经有|已拥有|拥有|服务过/.test(cl)
    const hasFuture = FUTURE_CUE.test(cl)
    if (!hasFuture || hasAssertion) { add('FABRICATED_CUSTOMER', { cue: hit.cue, noun: hit.noun, clause: cl }); break }
  }

  // ── Illegal content (negation/contrast/instruction-aware) ──
  const illegal = detectIllegal(text)
  if (illegal) {
    const cl = clauses(text).find((c) => c.indexOf(illegal) !== -1) || illegal
    add('ILLEGAL_CONTENT', { token: illegal, clause: cl })
  }

  // ── TELEMETRY (never blocks) ──
  const telemetry = []
  const o = normalizeV4RestoredOutput(output)
  const st = o.strategicThesis
  if (!st.identityInterpretation || !st.coreContradiction) telemetry.push('NO_SHARED_THESIS')
  const c2 = o.cards.card02 || ''
  const FACT_LABEL_PAT = /(人生阶段|每月结余|存款能撑|负债|试错成本|每周自由时间|收入结构|执行力)/g
  const factHits = (c2.match(FACT_LABEL_PAT) || []).length
  const valueWords = /(位置|资产|身份|价值|可交易|议价|被需要|替代|杠杆|瓶颈|结构)/
  if (factHits >= 3 && !valueWords.test(c2)) telemetry.push('ANSWER_PARAPHRASE_DOMINANT')
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
