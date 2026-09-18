'use strict'
/**
 * turnaroundStrategy/v6/thesis/v4RestoredGroundingV6.js
 *
 * RC8.4 V6 R84-D — CAUSAL GROUNDING + EVIDENCE DISCIPLINE (deterministic, defect-only).
 *
 * R84-C made the report personal but let strong sentences invent causality:
 *   - a financial instrument (房贷/负债) used as "safety net / buffer / anesthetic"
 *   - psychological complacency asserted from a cash cushion ("所以失败不疼")
 *   - mind-reading (attributing beliefs / luck-attribution / avoidance as fact)
 *   - absolute market claims ("市场只认第二次…") and certainty overstatement
 *     ("证明第一次不是运气")
 *
 * This module FREEZES four evidence classes and DETECTS those defects, then
 * safely REPAIRS them: DROP the unsupported sentence (or DOWNSHIFT an
 * overclaimed phrase) — never by inventing a new fact. It is NOT a second model
 * and NOT broad lexical censorship.
 *
 *   OBSERVED   directly answered / actual known event
 *   DERIVED    deterministic transformation of observed evidence
 *   INFERRED   interpretation supported by multiple relevant signals
 *   HYPOTHESIS plausible explanation requiring reality test
 *
 * MODEL CALLS = 0. Pure. No I/O. No AI.
 */

const { charLen, fitTextTo } = require('./v4RestoredCompressV6.js')

const GROUNDING_VERSION = 'r84d_grounding_v1'
const EVIDENCE_CLASSES = Object.freeze(['OBSERVED', 'DERIVED', 'INFERRED', 'HYPOTHESIS'])

// ── financial instrument vs cushion vs safety-net vs complacency vocabulary ──
// A financial OBLIGATION (mortgage / debt / loan) is NEVER a safety net/buffer.
const MORTGAGE_TERM = /(房贷|按揭|月供|车贷)/
const DEBT_TERM = /(负债|债务|欠款|信用卡|消费贷|花呗|借贷|外债|贷款)/
const FIN_INSTRUMENT = /(房贷|按揭|月供|车贷|贷款|负债|债务|欠款|信用卡|消费贷|花呗|借贷|外债)/
// A cushion (salary / savings / safety months) MAY lower short-term cash-flow
// pressure — it may NOT be turned into psychological complacency.
const CUSHION_TERM = /(工资|薪水|月薪|收入|存款|储蓄|结余|现金流|稳定收入|上班|有份工作)/
const SAFETY_NET_TERM = /(安全网|安全垫|安全区|安全感|兜底|托底|垫底|缓冲|保障|保护伞|底气|退路|后路|依靠|垫着|撑腰)/
const COMPLACENCY_TERM = /(麻醉|麻木|不疼|不痛|不怕|不着急|不急|敢拖|一直拖|继续拖|可以拖|拖着|拖延|无所谓|没压力|没有压力|没有代价|不会有代价|不当回事|迟钝|不会真的疼|不会真疼|失败也不疼)/

// ── mind-reading: attributing internal states as fact ──
const MINDREAD_INNER = /(内心深处|内心其实|潜意识里|潜意识|骨子里|明明知道|其实知道|其实明白|心里其实)/
const MINDREAD_PAT = /(你|您)(就是|就|一直|始终|从来|其实|根本|早就|总是)*(认为|以为|觉得|相信|心里想|知道|明白)/
const MINDREAD_LUCK = /(把|将|视)(那|这|它|其)?(一|第|首)?次?[^。，,；！？]{0,6}(当成|当作|看成|视为|归为|归结为)(只是|仅仅)?(运气|偶然|侥幸|巧合)/
const MINDREAD_AVOID = /(你|您)(一直|总是|其实|在|故意)?(逃避|回避|躲避|不敢面对|拒绝面对|不愿面对)/

// ── absolutism + certainty overstatement ──
const ABSOLUTE_MARKET_PAT = /(市场|世界|买家|客户|人群|钱)(?:(?![。！？]).){0,14}?(只认|只看|只为|只给|只奖励|只承认|只接受|只买单|仅认|仅看|从来只|永远只|一律)/
const ABSOLUTE_STRONG_PAT = /(必然|必定|绝对|铁定|百分之百|100%|永远不会|永远只|从来不会|一定会|一定能|绝对不会)/
const CERTAINTY_PAT = /(证明|说明|表明|意味着)[^。，,；！？]{0,10}(不是运气|一定|必然|肯定|绝对)/
const NOT_LUCK_PAT = /不是运气/

// ── universalising thresholds masquerading as evidence (vs experiment design) ──
const ARBITRARY_THRESHOLD_PAT = /(至少|必须|只有|才算|才能算|得需要|需要有|要凑够|达到)\s*([0-9]{1,4}|[一二三四五六七八九十]+)\s*(个人|位|家|个客户|个买家|个用户|单|笔|次)/

// ── R85-B §20/§21 — OCCUPATION MARKET CLAIMS (no external market database) ──
// Occupation ALONE may never support: AI displacement · income ceiling · job-loss
// probability · career outlook · a destiny stereotype. These require external
// market evidence this system does NOT have → always unsupported → dropped.
// NOTE: deliberate occupation-grounding ADDITION (R84-D semantics untouched).
const OCCUPATION_AI_PAT = /(AI|人工智能|算法|机器|自动化)[^。，,；！？]{0,8}(淘汰|取代|替代|抢走|干掉)|被(AI|人工智能|机器|算法|自动化)[^。，,；！？]{0,4}(淘汰|取代|替代|干掉)/
const OCCUPATION_CEILING_PAT = /(收入|薪资|工资|赚钱|前景|未来)[^。，,；！？]{0,6}(天花板|封顶|上限)|天花板(很|太|特别)?低|(收入|薪资|工资)上限(很|太|特别)?低|赚不了大钱|没有(大|高)?前途|没什么前途|前景(很|太)?差/
const OCCUPATION_STEREOTYPE_PAT = /(只能|只配|一辈子只|永远只)(靠|用|出卖)(体力|时间|青春)|吃(的)?青春饭|青春饭|没什么技术含量|没有技术含量/
const OCCUPATION_DESTINY_PAT = /(注定|天生|一辈子|生来)(只能|就|注定是|适合)|(做|当|作为|干)(程序员|厨师|销售|外卖|骑手|司机|设计师|老师|医生|导购|客服|美发师|美甲师)[^。，,；！？]{0,10}(一定|必然|注定|肯定|只能)|(程序员|厨师|销售|外卖|骑手|司机|设计师|老师|医生)[^。，,；！？]{0,6}(一定|必然|注定|肯定)(会|能|适合|被)/
const OCCUPATION_JOB_SECURITY_PAT = /(一定|必然|迟早|早晚|终究)(会|要)?(失业|下岗|被裁|被优化|没饭吃)/

// ── R85-B §10/§21 — EXACT INCOME FORECAST (system has NO authority for a number) ──
const EXACT_INCOME_FORECAST_PAT = /(月入|年入|收入|工资|薪水|赚|挣)[^。，,；！？]{0,6}[0-9]+\s*[万千]?\s*[元块]|(月入|年入|收入|赚)[^。，,；！？]{0,4}[0-9]+\s*万|(月入|年入|收入|工资|赚)[^。，,；！？]{0,4}[一两三四五六七八九十]+万|(月入|年入|收入)[^。，,；！？]{0,3}(过万|上万|破万)/

// ── R85-C §20 — UNSUPPORTED GAME CLAIM (assert a pricing party the evidence contradicts) ──
// A card may NAME a pricing authority (雇主/平台/客户) — the IP needs it. It is a
// DEFECT only when it asserts a pricing/settlement party that CONTRADICTS the
// computed game model. USER / MARKET / MIXED / UNKNOWN → no conflict is possible.
const GAME_EMPLOYER_PRC = /(雇主|公司|老板|单位|企业)[^。，,；！？]{0,6}(定价|发工资|发薪|结算|给工资|给薪水|给钱|发钱)/
const GAME_PLATFORM_PRC = /(平台)[^。，,；！？]{0,6}(定价|派单|分配|抽成|结算|分单|定你的价|给你派)/
const GAME_CLIENT_PRC = /(客户|买家|顾客|甲方)[^。，,；！？]{0,6}(定价|给钱|付钱|报价|买单|说了算|定这个价)/
// A HYPOTHETICAL / aspirational clause describes a DIRECTION to move toward
// (the SWITCH), not a claim about who prices the user NOW — never a conflict.
const GAME_HYPOTHETICAL = /(能不能|能否|可以|能够|应该|如果|若|假设|取决于|方向|目标|想|希望|打算|计划|试着|下一步|变成|成为|验证|会不会|值不值得)/

/** Detect a game/pricing claim that contradicts the computed game model. */
function detectGameConflict (text, ctx) {
  const g = (ctx && ctx.gameModel) || null
  const auth = g && g.pricingAuthority && g.pricingAuthority.value
  if (!auth || auth === 'USER' || auth === 'MARKET' || auth === 'MIXED' || auth === 'UNKNOWN') return null
  const t = String(text || '')
  if (GAME_HYPOTHETICAL.test(t)) return null
  const claims = []
  if (GAME_EMPLOYER_PRC.test(t)) claims.push('EMPLOYER')
  if (GAME_PLATFORM_PRC.test(t)) claims.push('PLATFORM')
  if (GAME_CLIENT_PRC.test(t)) claims.push('CLIENT')
  if (!claims.length) return null
  // A conflict exists only when the text asserts a DIFFERENT pricing party than
  // the one the model computed (and never flags a claim that merely mentions the
  // correct one alongside).
  const wrong = claims.filter((c) => c !== auth)
  if (wrong.length && claims.length === wrong.length) return wrong.join('/')
  return null
}

// ── deterministic DOWNSHIFTS (introduce NO new fact, only hedge) ──
function downshift (text) {
  let t = String(text || '')
  t = t.replace(/证明([^。，,；！？]{0,10})不是运气/g, '验证$1是否具备可重复性')
  t = t.replace(/不是运气/g, '是否具备可重复性')
  t = t.replace(/证明了?([^。，,；！？]{0,12}?)(一定|必然|绝对|肯定)(能|会|是|成立|成功)?/g, '需要用现实检验$1是否$3')
  t = t.replace(/一定保证|保证一定/g, '更有机会')
  t = t.replace(/市场只认/g, '市场更看重')
  t = t.replace(/市场只看/g, '市场更看重')
  t = t.replace(/市场只为/g, '市场往往为')
  t = t.replace(/市场只给/g, '市场往往给')
  t = t.replace(/市场只奖励/g, '市场更倾向于奖励')
  t = t.replace(/只认/g, '更看重')
  t = t.replace(/只奖励/g, '更倾向于奖励')
  t = t.replace(/只承认/g, '更看重')
  t = t.replace(/只接受/g, '更倾向于接受')
  t = t.replace(/只买单/g, '更倾向于买单')
  t = t.replace(/只看/g, '更看重')
  t = t.replace(/仅为(?=买家|客户|用户|人)/g, '往往为')
  t = t.replace(/仅认/g, '更看重')
  t = t.replace(/仅看/g, '更看重')
  t = t.replace(/从来只/g, '通常只')
  t = t.replace(/一律/g, '往往')
  t = t.replace(/必然/g, '很可能')
  t = t.replace(/必定/g, '很可能')
  t = t.replace(/铁定/g, '大概率')
  t = t.replace(/百分之百|100%/g, '大概率')
  t = t.replace(/绝对不会/g, '未必会')
  t = t.replace(/永远不会/g, '未必会')
  t = t.replace(/从来不会/g, '未必会')
  t = t.replace(/永远只/g, '通常只')
  t = t.replace(/一定会/g, '有机会')
  t = t.replace(/一定能/g, '有机会能')
  t = t.replace(/绝对(会|能)/g, '很可能$1')
  return t
}

function oneLine (s) { return String(s == null ? '' : s).replace(/\s+/g, '') }

/** Split into SENTENCES keeping the delimiter (context preserved for causality). */
function sentences (t) {
  return String(t || '').split(/(?<=[。！？!?])/).map((s) => s.trim()).filter(Boolean)
}

/**
 * Classify ONE sentence/claim into a defect type (first match wins) — or null.
 * @returns {{type:string, evidenceClass:string}|null}
 */
function classifyClause (cl, ctx) {
  const c = String(cl == null ? '' : cl)
  if (!c.trim()) return null
  const g = ctx || {}
  // 1) a financial OBLIGATION used as safety net / anesthesia — NEVER grounded
  if (MORTGAGE_TERM.test(c) && (SAFETY_NET_TERM.test(c) || COMPLACENCY_TERM.test(c))) return { type: 'MORTGAGE_SAFETY', evidenceClass: 'HYPOTHESIS' }
  if (DEBT_TERM.test(c) && (SAFETY_NET_TERM.test(c) || COMPLACENCY_TERM.test(c))) return { type: 'DEBT_BUFFER', evidenceClass: 'HYPOTHESIS' }
  // 2) psychological complacency — NEVER automatically supported, even with a cushion
  if (COMPLACENCY_TERM.test(c)) return { type: 'COMPLACENCY', evidenceClass: 'HYPOTHESIS' }
  // 3) mind-reading an internal state as fact
  if (MINDREAD_LUCK.test(c)) return { type: 'MINDREAD', evidenceClass: 'INFERRED' }
  if (MINDREAD_INNER.test(c)) {
    if (/知道|明白/.test(c) && g.selfBelief === 'BELIEF_KNOW_NO_ACTION') return null
    return { type: 'MINDREAD', evidenceClass: 'INFERRED' }
  }
  const mm = c.match(MINDREAD_PAT)
  if (mm) {
    const tok = mm[0]
    const supportedKnow = /知道|明白/.test(tok) && g.selfBelief === 'BELIEF_KNOW_NO_ACTION'
    const supportedFear = /害怕|怕/.test(c) && g.selfBelief === 'BELIEF_FEAR'
    if (!supportedKnow && !supportedFear) return { type: 'MINDREAD', evidenceClass: 'INFERRED' }
  }
  if (MINDREAD_AVOID.test(c) && g.selfBelief !== 'BELIEF_FEAR') return { type: 'MINDREAD', evidenceClass: 'INFERRED' }
  // 4) absolute market claim
  if (ABSOLUTE_MARKET_PAT.test(c)) return { type: 'ABSOLUTE_MARKET', evidenceClass: 'OBSERVED' }
  if (ABSOLUTE_STRONG_PAT.test(c)) return { type: 'ABSOLUTE_MARKET', evidenceClass: 'OBSERVED' }
  // 5) certainty overstatement
  if (NOT_LUCK_PAT.test(c)) return { type: 'CERTAINTY', evidenceClass: 'OBSERVED' }
  if (CERTAINTY_PAT.test(c)) return { type: 'CERTAINTY', evidenceClass: 'OBSERVED' }
  // 6) R85-B §20/§21 — occupation market claim (no external market evidence)
  if (OCCUPATION_AI_PAT.test(c) || OCCUPATION_CEILING_PAT.test(c) || OCCUPATION_STEREOTYPE_PAT.test(c) ||
      OCCUPATION_DESTINY_PAT.test(c) || OCCUPATION_JOB_SECURITY_PAT.test(c)) return { type: 'OCCUPATION_MARKET', evidenceClass: 'HYPOTHESIS' }
  // 7) R85-B §10/§21 — exact income forecast (no authority for a number)
  if (EXACT_INCOME_FORECAST_PAT.test(c)) return { type: 'EXACT_INCOME', evidenceClass: 'HYPOTHESIS' }
  // 8) R85-C §20 — a pricing/game claim contradicting the computed game model
  if (detectGameConflict(c, ctx)) return { type: 'GAME_CONFLICT', evidenceClass: 'HYPOTHESIS' }
  return null
}

/** Count arbitrary universalising thresholds (a MEASURE, not always a repair). */
function countArbitraryNumbers (text) {
  const g = new RegExp(ARBITRARY_THRESHOLD_PAT.source, 'g')
  let m, n = 0
  while ((m = g.exec(String(text || ''))) !== null) n++
  return n
}

/**
 * Deterministically inventory every causal statement in a block of text.
 * @returns {Array<{claim,type,evidenceClass,supported}>}
 */
function auditClaims (text, slot, ctx) {
  const out = []
  for (const cl of sentences(text)) {
    const v = classifyClause(cl, ctx)
    if (v) out.push({ slot: slot, claim: cl, type: v.type, evidenceClass: v.evidenceClass, supported: false })
    else if (/[→>]|所以|因此|于是|导致|从而|因而|进而/.test(cl)) out.push({ slot: slot, claim: cl, type: 'CAUSAL', evidenceClass: 'DERIVED', supported: true })
  }
  return out
}

const ZERO_COUNTS = () => ({
  MORTGAGE_AS_SAFETY_NET_COUNT: 0, DEBT_AS_BUFFER_COUNT: 0, COMPLACENCY_CAUSALITY_COUNT: 0,
  CARD01_UNSUPPORTED_MINDREAD_COUNT: 0, UNSUPPORTED_CAUSAL_CLAIM_COUNT: 0,
  ABSOLUTE_MARKET_CLAIM_COUNT: 0, CERTAINTY_OVERSTATEMENT_COUNT: 0, ARBITRARY_NUMBER_COUNT: 0,
  OWNER_MORTGAGE_CAUSAL_BUG_COUNT: 0,
  // R85-B §20/§10 — occupation-market + exact-income-forecast (both must be 0)
  UNSUPPORTED_OCCUPATION_MARKET_CLAIM_COUNT: 0, EXACT_INCOME_FORECAST_COUNT: 0,
  // R85-C §20 — game claim contradicting the computed game model (must be 0)
  UNSUPPORTED_GAME_CLAIM_COUNT: 0
})

/** Count defects on a FINAL (already-repaired) text — expected 0. */
function countGroundingDefects (text, ctx, slot) {
  const counts = ZERO_COUNTS()
  for (const cl of sentences(text)) {
    const v = classifyClause(cl, ctx)
    if (!v) continue
    if (v.type === 'MORTGAGE_SAFETY') counts.MORTGAGE_AS_SAFETY_NET_COUNT++
    else if (v.type === 'DEBT_BUFFER') counts.DEBT_AS_BUFFER_COUNT++
    else if (v.type === 'COMPLACENCY') counts.COMPLACENCY_CAUSALITY_COUNT++
    else if (v.type === 'MINDREAD') { if (slot === 'card01') counts.CARD01_UNSUPPORTED_MINDREAD_COUNT++; else counts.UNSUPPORTED_CAUSAL_CLAIM_COUNT++ }
    else if (v.type === 'ABSOLUTE_MARKET') counts.ABSOLUTE_MARKET_CLAIM_COUNT++
    else if (v.type === 'CERTAINTY') counts.CERTAINTY_OVERSTATEMENT_COUNT++
    else if (v.type === 'OCCUPATION_MARKET') counts.UNSUPPORTED_OCCUPATION_MARKET_CLAIM_COUNT++
    else if (v.type === 'EXACT_INCOME') counts.EXACT_INCOME_FORECAST_COUNT++
    else if (v.type === 'GAME_CONFLICT') counts.UNSUPPORTED_GAME_CLAIM_COUNT++
  }
  counts.UNSUPPORTED_CAUSAL_CLAIM_COUNT += counts.MORTGAGE_AS_SAFETY_NET_COUNT + counts.DEBT_AS_BUFFER_COUNT + counts.COMPLACENCY_CAUSALITY_COUNT + counts.CARD01_UNSUPPORTED_MINDREAD_COUNT
  counts.ARBITRARY_NUMBER_COUNT = countArbitraryNumbers(text)
  return counts
}

function cleanupConnectors (t) {
  return String(t || '')
    .replace(/^(所以|因此|于是|因而|而后|而|但|可是|不过|就是|就|进而|从而|因为|由于)+[，,]?\s*/, '')
    .replace(/[，,；;、]\s*$/, '')
    .trim()
}

/**
 * §4/§5 — the ALLOWED grounded framing of a financial OBLIGATION. A mortgage /
 * debt is a fixed cash-flow constraint (obs/derived). This is a targeted
 * PREDICATE SWAP on the model's own subject term — it introduces NO new fact
 * beyond the debt semantics the questionnaire already observed.
 */
const CONSTRAINT_FRAME = {
  mortgage: '房贷是每月固定支出，会抬高试错成本。',
  debt: '债务是每月固定的现金支出，会抬高试错成本。'
}

/**
 * Last-resort grounded lines (mission-sanctioned directions, §13/§16). Used
 * ONLY when a required field would otherwise go empty after dropping an
 * unsupported causal sentence. They assert no user-specific fact.
 */
const NEUTRAL_FALLBACK = {
  card01: '现实已经给过一次答案，你还没把第二次验证做出来。',
  card02: '你是被市场付过一次钱、却还没把一次成交变成重复验证的人。',
  card03: '缺的不是再准备，而是第二次真实市场反馈。',
  card03rule: '缺的不是再准备，而是第二次真实市场反馈。',
  card04: '把价值主动摆到市场，让陌生人用钱投票。',
  card04rule: '一次付费只说明有人愿意买；重复付费才开始说明这件事可复制。',
  card05: '对真实潜在买家完成一次明确报价与交付。',
  card05accept: '出现第二个与你没有人情关系的人真实付费。'
}

/**
 * Repair ONE field: drop unsupported causal sentences, downshift overclaims.
 * Deterministic, text-preserving (never invents a user fact; a mortgage/debt
 * predicate swap re-uses the model's own subject under the ALLOWED framing).
 * Falls back to `fallbackText` (model-authored thesis source), then to a
 * mission-sanctioned neutral grounded line, if the field would go empty.
 */
function fixField (text, slot, ctx, fallbackText, audit, repaired) {
  const parts = sentences(text)
  if (!parts.length) return String(text || '')
  const g = ctx || {}
  const kept = []
  for (const s of parts) {
    const v = classifyClause(s, g)
    if (!v) { kept.push(s); continue }
    audit.push({ slot: slot, claim: s, type: v.type, evidenceClass: v.evidenceClass, supported: false })
    if (v.type === 'ABSOLUTE_MARKET' || v.type === 'CERTAINTY') {
      const d = downshift(s)
      if (v.type === 'ABSOLUTE_MARKET') repaired.absoluteMarket++; else repaired.certainty++
      if (!classifyClause(d, g)) kept.push(d)
      continue
    }
    if (v.type === 'MORTGAGE_SAFETY' || v.type === 'DEBT_BUFFER') {
      // Predicate swap ONLY when the instrument is actually in the profile's
      // debt context; otherwise the instrument itself is unsupported → drop.
      const isMortgage = MORTGAGE_TERM.test(s)
      const consistent = isMortgage ? (g.debtPressure === 'DEBT_MORTGAGE') : (g.debtPressure === 'DEBT_MORTGAGE' || g.debtPressure === 'DEBT_CONSUMER' || g.debtPressure === 'DEBT_HIGH')
      repaired.financial++
      if (consistent) kept.push(isMortgage ? CONSTRAINT_FRAME.mortgage : CONSTRAINT_FRAME.debt)
      continue
    }
    if (v.type === 'MINDREAD') repaired.mindread++
    else if (v.type === 'COMPLACENCY') repaired.complacency++
    else if (v.type === 'OCCUPATION_MARKET') repaired.occupationMarket++
    else if (v.type === 'EXACT_INCOME') repaired.exactIncome++
    else if (v.type === 'GAME_CONFLICT') repaired.gameConflict++
    else repaired.financial++
  }
  let out = kept.join('').trim()
  if (!oneLine(out)) {
    const fb = String(fallbackText || '')
    if (oneLine(fb) && !classifyClause(fb, g)) out = fb
    else out = NEUTRAL_FALLBACK[slot] || ''
  }
  return out
}

/**
 * Screen + safely repair the compressed cards for causal-grounding defects.
 * @param {Object} cmp   compressed visible cards
 * @param {Object} thesis strategicThesis (text-preserving fallback source)
 * @param {Object} ctx   grounding context (debtPressure / selfBelief / hasPaidProof …)
 * @param {Object} fb    optional per-field fallback strings
 * @returns {{cards, counts, repaired, audit}}
 */
function screenGrounding (cmp, thesis, ctx, fb) {
  const c = Object.assign({}, cmp || {})
  const g = ctx || {}
  const f = fb || {}
  const repaired = { financial: 0, complacency: 0, mindread: 0, absoluteMarket: 0, certainty: 0, occupationMarket: 0, exactIncome: 0, gameConflict: 0 }
  const audit = []

  c.card01 = fixField(c.card01, 'card01', g, f.card01, audit, repaired)
  c.card02 = fixField(c.card02, 'card02', g, f.card02, audit, repaired)
  const c3 = c.card03 || { steps: [], rule: '' }
  c.card03 = {
    steps: (Array.isArray(c3.steps) ? c3.steps : []).map((s, i) => fixField(s, 'card03', g, (f.card03Steps || [])[i] || f.card03Step, audit, repaired)),
    rule: fixField(c3.rule, 'card03rule', g, f.card03Rule, audit, repaired)
  }
  const c4 = c.card04 || { from: '', to: '', rule: '' }
  c.card04 = {
    from: fixField(c4.from, 'card04', g, f.card04From, audit, repaired),
    to: fixField(c4.to, 'card04', g, f.card04To, audit, repaired),
    rule: fixField(c4.rule, 'card04rule', g, f.card04Rule, audit, repaired)
  }
  const c5 = c.card05 || { goal: '', actions: [], acceptance: '' }
  c.card05 = {
    goal: fixField(c5.goal, 'card05', g, f.card05Goal, audit, repaired),
    actions: (Array.isArray(c5.actions) ? c5.actions : []).map((s, i) => fixField(s, 'card05', g, (f.card05Actions || [])[i] || f.card05Action, audit, repaired)),
    acceptance: fixField(c5.acceptance, 'card05accept', g, f.card05Acceptance, audit, repaired)
  }

  // Counts reflect the FINAL shipped text (0 once repaired).
  const finals = {
    card01: c.card01, card02: c.card02,
    card03: c.card03.steps.join('') + '\n' + c.card03.rule,
    card04: c.card04.from + c.card04.to + c.card04.rule,
    card05: c.card05.goal + c.card05.actions.join('') + c.card05.acceptance
  }
  const counts = ZERO_COUNTS()
  for (const slot of Object.keys(finals)) {
    const cc = countGroundingDefects(finals[slot], g, slot)
    counts.MORTGAGE_AS_SAFETY_NET_COUNT += cc.MORTGAGE_AS_SAFETY_NET_COUNT
    counts.DEBT_AS_BUFFER_COUNT += cc.DEBT_AS_BUFFER_COUNT
    counts.COMPLACENCY_CAUSALITY_COUNT += cc.COMPLACENCY_CAUSALITY_COUNT
    counts.CARD01_UNSUPPORTED_MINDREAD_COUNT += cc.CARD01_UNSUPPORTED_MINDREAD_COUNT
    counts.UNSUPPORTED_CAUSAL_CLAIM_COUNT += cc.UNSUPPORTED_CAUSAL_CLAIM_COUNT
    counts.ABSOLUTE_MARKET_CLAIM_COUNT += cc.ABSOLUTE_MARKET_CLAIM_COUNT
    counts.CERTAINTY_OVERSTATEMENT_COUNT += cc.CERTAINTY_OVERSTATEMENT_COUNT
    counts.ARBITRARY_NUMBER_COUNT += cc.ARBITRARY_NUMBER_COUNT
    counts.UNSUPPORTED_OCCUPATION_MARKET_CLAIM_COUNT += cc.UNSUPPORTED_OCCUPATION_MARKET_CLAIM_COUNT
    counts.EXACT_INCOME_FORECAST_COUNT += cc.EXACT_INCOME_FORECAST_COUNT
    counts.UNSUPPORTED_GAME_CLAIM_COUNT += cc.UNSUPPORTED_GAME_CLAIM_COUNT
  }
  counts.OWNER_MORTGAGE_CAUSAL_BUG_COUNT = (g.debtPressure === 'DEBT_MORTGAGE') ? counts.MORTGAGE_AS_SAFETY_NET_COUNT : 0

  // Re-clamp any field a repair may have lengthened (budgets stay frozen).
  c.card01 = fitTextTo(c.card01, 40)
  c.card02 = fitTextTo(c.card02, 140)
  c.card03 = { steps: (c.card03.steps || []).map((s) => fitTextTo(s, 72)), rule: fitTextTo(c.card03.rule, 64) }
  c.card04 = { from: fitTextTo(c.card04.from, 58), to: fitTextTo(c.card04.to, 58), rule: fitTextTo(c.card04.rule, 72) }
  c.card05 = { goal: fitTextTo(c.card05.goal, 54), actions: (c.card05.actions || []).map((s) => fitTextTo(s, 46)), acceptance: fitTextTo(c.card05.acceptance, 46) }

  return { cards: c, counts: counts, repaired: repaired, audit: audit }
}

module.exports = {
  GROUNDING_VERSION,
  EVIDENCE_CLASSES,
  CONSTRAINT_FRAME,
  NEUTRAL_FALLBACK,
  MORTGAGE_TERM,
  DEBT_TERM,
  FIN_INSTRUMENT,
  CUSHION_TERM,
  SAFETY_NET_TERM,
  COMPLACENCY_TERM,
  MINDREAD_INNER,
  MINDREAD_PAT,
  MINDREAD_LUCK,
  MINDREAD_AVOID,
  ABSOLUTE_MARKET_PAT,
  ABSOLUTE_STRONG_PAT,
  CERTAINTY_PAT,
  ARBITRARY_THRESHOLD_PAT,
  OCCUPATION_AI_PAT,
  OCCUPATION_CEILING_PAT,
  OCCUPATION_STEREOTYPE_PAT,
  OCCUPATION_DESTINY_PAT,
  OCCUPATION_JOB_SECURITY_PAT,
  EXACT_INCOME_FORECAST_PAT,
  GAME_EMPLOYER_PRC,
  GAME_PLATFORM_PRC,
  GAME_CLIENT_PRC,
  GAME_HYPOTHETICAL,
  detectGameConflict,
  classifyClause,
  downshift,
  cleanupConnectors,
  sentences,
  auditClaims,
  countArbitraryNumbers,
  countGroundingDefects,
  screenGrounding
}
