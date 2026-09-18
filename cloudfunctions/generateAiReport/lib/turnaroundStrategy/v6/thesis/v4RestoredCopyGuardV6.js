'use strict'
/**
 * turnaroundStrategy/v6/thesis/v4RestoredCopyGuardV6.js
 *
 * RC8.4 V6 R84-A §13/§16/§21 — DETERMINISTIC, DEFECT-ONLY copy guard.
 *
 * This is NOT a second AI validator and NOT broad style/lexical policing. It is
 * a small, deterministic check + SAFE REPAIR layer that runs AFTER thesis
 * formation and AFTER deterministic compression, on the user-visible five cards
 * ONLY. It targets exactly five clear defects (R84-A §21):
 *
 *   CARD05_90DAY_HORIZON_CONFLICT_COUNT        "90天目标" text carrying a
 *                                              contradictory horizon (12个月…)
 *   UNSUPPORTED_EXACT_PRICE_COUNT              an invented exact price range /
 *                                              figure inside a card05 action
 *   CARD04_FROM_TO_MISSING_COUNT               card04 missing FROM or TO
 *   CARD05_VALIDATION_STANDARD_MISSING_COUNT   card05 missing a validation standard
 *   CARD03_DUPLICATE_CONCLUSION_COUNT          card03 rule restates a mechanism step
 *
 * REPAIR is strictly text-preserving: it rewrites a horizon phrase, replaces a
 * precise-ish price with a generic price instruction, falls back to the thesis
 * migration, or drops a duplicated conclusion. It NEVER invents a new claim,
 * never adds facts, never touches strategicThesis.
 *
 * MODEL CALLS = 0. Pure. No I/O. No AI.
 */

const { charLen, fitTextTo, BUDGET } = require('./v4RestoredCompressV6.js')

// ── §13 — contradictory horizons for a 90-day card ──
const HORIZON_CONFLICT_PAT = /(12\s*个?月|十二\s*个?月|一年\s*(内|之内|内完成)?|1\s*年|两年|2\s*年|三年|3\s*年|半年内?完成?|12\s*month)/g
// Non-global twin for stateless .test() checks (a /g regex with .test() carries
// lastIndex state across calls — never use the global one for a boolean probe).
const HORIZON_CONFLICT_TEST = /(12\s*个?月|十二\s*个?月|一年\s*(内|之内|内完成)?|1\s*年|两年|2\s*年|三年|3\s*年|半年内?完成?|12\s*month)/
// Safe rewrite target (the card is explicitly a 90-day card).
const HORIZON_REWRITE = '90 天'

// ── §16 — invented exact price (range or standalone figure) ──
// A range: 500–2000元 / 500-2000 / 500到2000元
const PRICE_RANGE_PAT = /(\d{2,6})\s*(?:[-–—~至到]|起)\s*(\d{2,6})\s*(?:元|块|万)?/g
// A standalone price-ish figure: 1999元 / 9999 / 一块 299
const PRICE_SINGLE_PAT = /(\d{3,6})\s*(?:元|块|万)/g
// Context that means the number is a legitimate TRIAL BUDGET / cost constraint,
// NOT an invented product price — such figures are allowed to remain.
const BUDGET_CONTEXT = /(试错|预算|承受|成本|结余|存款|储蓄|负债|月供|开支|支出)/

// ── §12 — standalone generic actions (only banned when NOT tied to observable
// behavior). Deterministic guard flags ones that appear as a WHOLE action text.
const GENERIC_ACTION_EXACT = /^(多学习|坚持|提升认知|做好规划|多尝试|寻找机会|努力学习|多读书)[。.!！]?$/

function oneLine (s) { return String(s == null ? '' : s).replace(/\s+/g, '') }
const DANGLING_END = /[，,、；;→>]\s*$/

/** Split into punctuation/arrow delimited PHRASES (delimiters kept). */
function phrases (t) {
  return String(t || '').split(/(?<=[→>，,；;、。！？!?])/).map((s) => s.trim()).filter(Boolean)
}
function core (s) { return oneLine(s).replace(/[。，,；;、！？!?→>「」『』"'“”]/g, '') }

/**
 * §8 — a duplicated conclusion is a clear defect only when the conclusion
 * REPEATS the mechanism:
 *   (a) it contains a mechanism step (or vice versa) as a substantial phrase, OR
 *   (b) it re-lists the loop as an arrow chain (>=2 arrows) that overlaps >=2
 *       step phrases.
 * A genuinely ELEVATED conclusion (a principle, no arrow chain, no step
 * restatement) never triggers — no broad lexical policing.
 */
function isDuplicateConclusion (rule, steps) {
  const r = oneLine(rule)
  if (!r) return false
  const list = Array.isArray(steps) ? steps : []
  // (a) substantial verbatim phrase containment
  for (const st of list) {
    const n = core(st)
    if (n.length >= 6 && (core(r).includes(n) || n.includes(core(r)))) return true
  }
  // (b) arrow-chain re-listing the same steps
  const arrowCount = (String(rule).match(/[→>]/g) || []).length
  if (arrowCount >= 2) {
    let matched = 0
    for (const p of phrases(rule)) {
      const c = core(p)
      if (c.length < 3) continue
      if (list.some((st) => { const n = core(st); return n && (n.includes(c) || c.includes(n)) })) matched++
    }
    if (matched >= 2) return true
  }
  return false
}

/** A conclusion text is a §8 defect if it restates the mechanism or is broken. */
function isBadConclusion (rule, steps) {
  const r = String(rule || '')
  if (!oneLine(r)) return false
  if ((r.match(/[→>]/g) || []).length >= 2) return true // re-lists the loop
  if (DANGLING_END.test(r)) return true // truncated mid-chain
  return isDuplicateConclusion(r, steps)
}

/**
 * §8 — the ONE-LEVEL-UP conclusion. Prefer the thesis's own elevation: the last
 * sentence of systemTrap, which is a principle (no arrow chain, 6–64 chars).
 * Text-preserving: read from the thesis, never invented.
 */
function elevatedConclusion (thesis) {
  const trap = String((thesis || {}).systemTrap || '')
  const sents = trap.split(/(?<=[。！？!?])/).map((s) => s.trim()).filter(Boolean)
  for (let i = sents.length - 1; i >= 0; i--) {
    const s = sents[i]
    if ((s.match(/[→>]/g) || []).length === 0 && charLen(s) >= 6 && charLen(s) <= 64) return s
  }
  return ''
}

/** Count exact, unsupported price figures inside a block of text. */
function countUnsupportedPrices (text) {
  const t = String(text || '')
  let n = 0
  let m
  PRICE_RANGE_PAT.lastIndex = 0
  while ((m = PRICE_RANGE_PAT.exec(t)) !== null) {
    const before = t.slice(Math.max(0, m.index - 8), m.index)
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 8)
    if (BUDGET_CONTEXT.test(before) || BUDGET_CONTEXT.test(after)) continue
    n++
  }
  PRICE_SINGLE_PAT.lastIndex = 0
  while ((m = PRICE_SINGLE_PAT.exec(t)) !== null) {
    const before = t.slice(Math.max(0, m.index - 8), m.index)
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 8)
    if (BUDGET_CONTEXT.test(before) || BUDGET_CONTEXT.test(after)) continue
    // a range member already counted above would be caught by the single pat too;
    // avoid double counting by skipping when adjacent to a range separator.
    const prev = t.slice(Math.max(0, m.index - 1), m.index)
    const next = t.slice(m.index + m[0].length, m.index + m[0].length + 1)
    if (/[-–—~至到]/.test(prev) || /[-–—~至到]/.test(next)) continue
    n++
  }
  return n
}

/** Replace invented exact prices with a generic price instruction. */
function neutralizePrices (text) {
  let t = String(text || '')
  t = t.replace(PRICE_RANGE_PAT, (full, a, b, off, s) => {
    const before = s.slice(Math.max(0, off - 8), off)
    const after = s.slice(off + full.length, off + full.length + 8)
    if (BUDGET_CONTEXT.test(before) || BUDGET_CONTEXT.test(after)) return full
    return '一个真实价格'
  })
  t = t.replace(PRICE_SINGLE_PAT, (full, a, off, s) => {
    const before = s.slice(Math.max(0, off - 8), off)
    const after = s.slice(off + full.length, off + full.length + 8)
    if (BUDGET_CONTEXT.test(before) || BUDGET_CONTEXT.test(after)) return full
    const prev = s.slice(Math.max(0, off - 1), off)
    const next = s.slice(off + full.length, off + full.length + 1)
    if (/[-–—~至到]/.test(prev) || /[-–—~至到]/.test(next)) return full
    return '一个真实价格'
  })
  return t
}

/** Replace a contradictory horizon with the card's real 90-day horizon. */
function neutralizeHorizon (text) {
  return String(text || '').replace(HORIZON_CONFLICT_PAT, HORIZON_REWRITE)
}

// ═══════════════════════════════════════════════════════════════════
// R84-C — ONE-PERSON-ONE-CONTRADICTION personality guards (defect-only).
//
//   PAID_PROOF_HALLUCINATION  a paid-proof claim asserted when the profile
//                             has NO paid proof (marketValidated = false)
//   FAKE_PERSONALITY           an invented emotional/psych history claim with
//                             no profile support
//   GENERIC_CARD               a card carrying none of the profile's
//                             distinguishing signals (could be sent to anyone)
//
// Modality-aware like the R70 validator: a GOAL / hypothesis ("拿到第二次付费")
// is NOT a paid-proof assertion; only a present/past claim is.
// ═══════════════════════════════════════════════════════════════════

// Paid-proof tokens that assert the user ALREADY has paying customers / repeat
// sales / market validation. (Nouns like 复购/回头客 inherently imply history.)
const PAID_PROOF_PAT = /(第二次\s*(?:付费|付钱|成交|购买|有人付|交易)|第\s*[二三]\s*笔\s*(?:成交|付费)|复购|重复购买|重复付费|回头客|老客户|稳定客户|长期客户|固定客户|已有客户|有一批客户|被付过(?:钱|费)|(?:别人|有人|客户|买家|陌生人)(?:已经|已|曾)?为(?:你|您)付(?:过)?(?:钱|费)|(?:已经|已|曾经)(?:有过)?成交|有过(?:成交|付费|好几笔|一两笔)|市场(?:已经|已)?(?:验证过?|认可过?|给过)|被市场验证|被验证过|已经被验证)/

// Modality (local twins to avoid coupling): FUTURE = a plan, not a fact.
const R84C_FUTURE_CUE = /(目标|争取|希望|打算|计划|下一步|未来|想要|准备|试图|尝试|可以|能够|应该|如果|若|假设|建议|试着|面向|针对|验证标准|做到|达成|完成|拿到|得到|获得|取得|出现|建立|创造|制造|签下|接到|开始做|去)/
const R84C_ASSERT_CUE = /(已经|已|曾经|本来就|你都|你已|目前|现在有|积累了|服务过|其实|从来|一直|早就)/
// Negation cue: a NEGATED claim ("没有人为你付过钱" / "市场从没认可过你") is NOT
// an assertion — the substring "有人为你付过钱" must not be read as one.
const R84C_NEG_CUE = /(从没|从未|未曾|尚未|不曾|还没|没有|没人|无人|没有谁|没|无)/

// Fabricated emotional / psychological history. Only 你害怕失败 and 家里影响
// have a possible profile support path (selfBelief); the rest never do.
const FAKE_PERSONALITY_NEVER = /(你从小|你小时候|你童年|你内心自卑|你自卑|你内心脆弱|你内心敏感|你性格(?:有)?(?:问题|缺陷|障碍)|你骨子里|你天生|你与生俱来|你潜意识|你内心深处其实|你有心理阴影|你缺少安全感|你缺乏安全感)/
const FAKE_PERSONALITY_FEAR = /(你害怕失败|你怕失败|你害怕被拒绝|你怕被拒绝|你对失败的恐惧)/
const FAKE_PERSONALITY_FAMILY = /(你一直被家庭影响|你受家庭影响|你被家庭限制|原生家庭(?:影响|束缚)你)/

/** Split text into comma/semicolon-delimited clauses (keep whole clauses). */
function guardClauses (t) {
  return String(t || '').split(/(?<=[。！？；;，,、])/).map((s) => s.trim()).filter(Boolean)
}
/** The clause that contains an absolute character index. */
function clauseAt (text, index) {
  const parts = guardClauses(text)
  let off = 0
  for (const p of parts) {
    const i = text.indexOf(p, off)
    if (i < 0) continue
    if (index >= i && index < i + p.length) return p
    off = i + p.length
  }
  return String(text)
}

/**
 * §14 — detect a paid-proof ASSERTION when the profile has no paid proof.
 * @returns {string|null} the offending token
 */
function detectPaidProofHallucination (text, ctx) {
  const c = ctx || {}
  if (c.hasPaidProof === true) return null
  const t = String(text || '')
  const g = new RegExp(PAID_PROOF_PAT.source, 'g')
  let m
  while ((m = g.exec(t)) !== null) {
    const cl = clauseAt(t, m.index)
    // A NEGATED clause is not a claim ("没有人为你付过钱" ≠ "有人为你付过钱").
    if (R84C_NEG_CUE.test(cl)) continue
    // A future/hypothesis clause is a plan, not a claim (§10 boundary).
    if (R84C_FUTURE_CUE.test(cl) && !R84C_ASSERT_CUE.test(cl)) continue
    return m[0]
  }
  return null
}

/**
 * §11 — detect an invented emotional/psych history claim
 * (unless the profile's selfBelief directly supports it).
 * @returns {string|null}
 */
function detectFakePersonality (text, ctx) {
  const c = ctx || {}
  const t = String(text || '')
  let m = t.match(FAKE_PERSONALITY_NEVER)
  if (m) return m[0]
  if (c.selfBelief !== 'BELIEF_FEAR') {
    m = t.match(FAKE_PERSONALITY_FEAR)
    if (m) return m[0]
  }
  if (c.selfBelief !== 'BELIEF_FAMILY') {
    m = t.match(FAKE_PERSONALITY_FAMILY)
    if (m) return m[0]
  }
  return null
}

/**
 * §10/§15 — the profile's ACTIVE distinguishing signals (markers that could not
 * equally apply to 80% of users), derived only from the user's own evidence.
 * @returns {Array<{id:string, re:RegExp}>}
 */
function activeProfileSignals (ctx) {
  const c = ctx || {}
  const out = []
  if (c.hasPaidProof === true || c.proofLevel === 'PAID_ONCE' || c.proofLevel === 'OCCASIONAL_PAID' || c.proofLevel === 'REPEATABLE_PAID') out.push({ id: 'PAID_ONCE', re: /(付过(?:钱|费)|被付|付费|成交|被(?:人?|市场)?买|收入管道|变现|换钱|市场(?:也已经|已)?(?:认可过?|给过|选中|验证过?)|给过(?:你|您).{0,4}(?:答案|信号|机会)|(?:认过|认)你|已(?:经)?(?:认可|证明)过?你|中过(?:奖|一次)|彩票|兑奖|一次(?:真实)?付费|第二次|第三次|重复付费|复购)/ })
  if (c.proofLevel === 'SKILL_USED_FREE' || c.proofLevel === 'PROBLEM_SOLVING_PROOF') out.push({ id: 'FREE_VALIDATION', re: /(免费|白帮|帮忙|认可|说你好|没付过钱|没收过钱|没被购买)/ })
  if (c.incomeStructure === 'INC_SALARY') out.push({ id: 'SALARY', re: /(工资|上班|月薪|打工|公司发工资|稳定收入)/ })
  if (c.skillType === 'ASSET_CONTENT') out.push({ id: 'CONTENT_SKILL', re: /(内容|作品|账号|写作|视频|输出|手艺人)/ })
  if (c.skillType === 'ASSET_TECHNICAL') out.push({ id: 'TECH_SKILL', re: /(技术|代码|程序|开发|工程|后端|系统)/ })
  if (c.occupationDetail) out.push({ id: 'OCCUPATION', re: new RegExp(c.occupationDetail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
  if (c.primaryProblem === 'PROBLEM_MONETIZE') out.push({ id: 'MONETIZE_GAP', re: /(变成钱|变现|收钱|赚|收入|钱|卖|付费|交易)/ })
  return out
}

/**
 * §15 — is a card portable to 5 random users unchanged?
 * With NO active profile signal available (cold profile) nothing can be judged,
 * so the card is NOT flagged (avoid false GENERIC on sparse data).
 */
function isGenericCard (cardText, signals) {
  const t = String(cardText || '')
  if (!t.trim()) return false
  const list = Array.isArray(signals) ? signals : []
  if (!list.length) return false
  // A quoted self-story phrase (e.g. '还没准备好') is itself a personal marker.
  if (/[「『"'“”][^」』"'“”]{2,}/.test(t)) return false
  return !list.some((sig) => sig.re.test(t))
}

/**
 * §14/§11 — safe repair of a paid-proof / fake-personality claim: drop ONLY the
 * offending clause (or sentence when it is the sole clause). Text-preserving;
 * never invents a replacement. Returns { text, removed }.
 */
function dropOffendingClause (text, token) {
  const t = String(text || '')
  if (!token) return { text: t, removed: 0 }
  const parts = guardClauses(t)
  const kept = parts.filter((p) => p.indexOf(token) === -1)
  if (kept.length === parts.length) return { text: t, removed: 0 }
  let out = kept.join('').trim()
  // Clean a dangling LEADING connector left by the drop (所以/因此/于是/而/但/）.
  out = out.replace(/^(所以|因此|于是|因而|而后|而|但|可是|不过|就是|就)+[，,]?\s*/, '')
  // Clean a dangling TRAILING connector.
  out = out.replace(/[，,；;、]\s*$/, '').trim()
  if (!out) return { text: t, removed: 0 }
  return { text: out, removed: 1 }
}

/**
 * R84-C §14/§15 — screen + safely repair the compressed cards for paid-proof
 * hallucination and fake personality, and MEASURE generic cards.
 * @returns {{cards, counts, repaired}}
 */
function screenPersonality (cmp, thesis, personalityCtx) {
  const c = Object.assign({}, cmp || {})
  const ctx = personalityCtx || {}
  const counts = { PAID_PROOF_HALLUCINATION_COUNT: 0, FAKE_PERSONALITY_COUNT: 0, GENERIC_CARD_COUNT: 0 }
  const repaired = { paidProof: 0, fakePersonality: 0 }

  const fix = (text) => {
    let t = String(text || '')
    let tok = detectPaidProofHallucination(t, ctx)
    if (tok) { const r = dropOffendingClause(t, tok); if (r.removed) { t = r.text; repaired.paidProof++ } }
    tok = detectFakePersonality(t, ctx)
    if (tok) { const r = dropOffendingClause(t, tok); if (r.removed) { t = r.text; repaired.fakePersonality++ } }
    return t
  }

  // card01 / card02 (strings)
  c.card01 = fix(c.card01)
  c.card02 = fix(c.card02)
  // card03 (steps + rule)
  const c3 = c.card03 || { steps: [], rule: '' }
  c.card03 = { steps: (Array.isArray(c3.steps) ? c3.steps : []).map(fix), rule: fix(c3.rule) }
  // card04 (from / to / rule)
  const c4 = c.card04 || { from: '', to: '', rule: '' }
  c.card04 = { from: fix(c4.from), to: fix(c4.to), rule: fix(c4.rule) }
  // card05 (goal / actions / acceptance)
  const c5 = c.card05 || { goal: '', actions: [], acceptance: '' }
  c.card05 = { goal: fix(c5.goal), actions: (Array.isArray(c5.actions) ? c5.actions : []).map(fix), acceptance: fix(c5.acceptance) }

  // Count reflects the FINAL shipped text (0 after repair).
  const allText = [c.card01, c.card02, c.card03.steps.join(''), c.card03.rule, c.card04.from, c.card04.to, c.card04.rule, c.card05.goal, c.card05.actions.join(''), c.card05.acceptance].join('\n')
  if (detectPaidProofHallucination(allText, ctx)) counts.PAID_PROOF_HALLUCINATION_COUNT++
  if (detectFakePersonality(allText, ctx)) counts.FAKE_PERSONALITY_COUNT++

  // §15 — per-card genericity (measured on the final text).
  const signals = activeProfileSignals(ctx)
  const cardTexts = [c.card01, c.card02, c.card03.steps.join(''), c.card04.from + c.card04.to, c.card05.goal + c.card05.actions.join('')]
  for (const ct of cardTexts) { if (isGenericCard(ct, signals)) counts.GENERIC_CARD_COUNT++ }

  return { cards: c, counts: counts, repaired: repaired, signals: signals.map((s) => s.id) }
}

/**
 * Run the guard on the COMPRESSED visible cards.
 *
 * @param {Object} cmp   output of compressVisibleCards()
 * @param {Object} thesis strategicThesis (for FROM/TO fallback only)
 * @returns {{cmp:Object, counts:Object, repaired:Object}}
 */
function guardVisibleCards (cmp, thesis, personalityCtx) {
  const c = cmp || {}
  const st = thesis || {}
  const mig = st.strategicMigration || {}
  const counts = {
    CARD05_90DAY_HORIZON_CONFLICT_COUNT: 0,
    UNSUPPORTED_EXACT_PRICE_COUNT: 0,
    CARD04_FROM_TO_MISSING_COUNT: 0,
    CARD05_VALIDATION_STANDARD_MISSING_COUNT: 0,
    CARD03_DUPLICATE_CONCLUSION_COUNT: 0
  }
  const repaired = { horizon: 0, price: 0, fromTo: 0, duplicateConclusion: 0 }

  // ── card01 / card02 ──
  const card01 = String(c.card01 || '')
  const card02 = String(c.card02 || '')

  // ── card03: drop explicit "结论：" pseudo-step + elevate the conclusion (§8) ──
  const c3 = c.card03 || { steps: [], rule: '' }
  const c4ruleEarly = String(((c.card04 || {}).rule) || '')
  let steps = (Array.isArray(c3.steps) ? c3.steps.slice() : []).filter((s) => !/^\s*结论\s*[:：]/.test(String(s)))
  let rule = String(c3.rule || '')
  if (isBadConclusion(rule, steps)) {
    // §8 elevated conclusion, in priority order, all text-preserving (no invention):
    //   1. the elevated principle sentence inside the thesis systemTrap
    //   2. the thesis worldRule (itself a one-level-up principle), unless that is
    //      already card04's rule (avoid collapsing card03 into card04)
    //   3. delete only the phrases that merely repeat a mechanism step
    let newRule = ''
    const elev = elevatedConclusion(st)
    if (elev && !isDuplicateConclusion(elev, steps)) {
      newRule = elev
    } else {
      const wr = fitTextTo(String(st.worldRule || ''), 64)
      if (wr && core(wr) !== core(c4ruleEarly) && !isDuplicateConclusion(wr, steps)) newRule = wr
    }
    if (!newRule) {
      const kept = phrases(rule).filter((p) => {
        const c = core(p)
        if (c.length < 3) return false
        return !steps.some((s) => { const n = core(s); return n && (n.includes(c) || c.includes(n)) })
      })
      newRule = kept.join('').trim()
    }
    // Last resort (e.g. a pure arrow chain the model left un-elevated): take the
    // loop's own TAIL phrase as the conclusion-of-record — it carries no arrow
    // and does not restate a mechanism step. Still text-preserving, never invented.
    if (!newRule || isBadConclusion(newRule, steps)) {
      const tailc = phrases(rule).filter((p) => (p.match(/[→>]/g) || []).length === 0)
      const tail = tailc.length ? tailc[tailc.length - 1] : ''
      if (charLen(tail) >= 6 && !isDuplicateConclusion(tail, steps)) newRule = tail
    }
    // R84-C hardening: when systemTrap is itself a bare arrow chain (no elevated
    // principle) AND card04 has already claimed worldRule, the fallbacks above can
    // all miss — leaving a truncated arrow chain shipped. Fall back to the thesis's
    // own coreContradiction sentence (model-authored, still text-preserving).
    if (!newRule || isBadConclusion(newRule, steps)) {
      const cc = String((st || {}).coreContradiction || '')
      const ccSents = cc.split(/(?<=[。！？!?])/).map((s) => s.trim()).filter(Boolean)
      for (const s of ccSents) {
        const cand = fitTextTo(s, 64)
        if (charLen(cand) >= 6 && (cand.match(/[→>]/g) || []).length === 0 && !isDuplicateConclusion(cand, steps)) { newRule = cand; break }
      }
    }
    // Final text-preserving fallback: the systemTrap's own non-arrow TAIL phrase
    // (the loop's consequence, a principle without an arrow chain).
    if (!newRule || isBadConclusion(newRule, steps)) {
      const trapPh = phrases(String((st || {}).systemTrap || '')).filter((p) => (p.match(/[→>]/g) || []).length === 0)
      const tp = trapPh.length ? trapPh[trapPh.length - 1] : ''
      if (charLen(tp) >= 6 && !isDuplicateConclusion(tp, steps)) newRule = tp
    }
    newRule = fitTextTo(newRule, 64)
    if (charLen(newRule) >= 6) {
      rule = newRule
      // Drop any step that merely restates the (now elevated) conclusion.
      const rn = core(rule)
      steps = steps.filter((s) => { const n = core(s); return !(n && rn && (rn.includes(n) || n.includes(rn))) })
      repaired.duplicateConclusion++
    }
  }
  // Count reflects the FINAL shipped text: 0 once repaired.
  if (isBadConclusion(rule, steps)) counts.CARD03_DUPLICATE_CONCLUSION_COUNT++

  // ── card04: FROM/TO present + repair from thesis migration ──
  const c4 = c.card04 || { from: '', to: '', rule: '' }
  let from = String(c4.from || '')
  let to = String(c4.to || '')
  const c4rule = String(c4.rule || '')
  if (!oneLine(from) || !oneLine(to)) {
    counts.CARD04_FROM_TO_MISSING_COUNT++
    if (!oneLine(from) && oneLine(mig.from)) { from = String(mig.from); repaired.fromTo++ }
    if (!oneLine(to) && oneLine(mig.to)) { to = String(mig.to); repaired.fromTo++ }
  }

  // ── card05: horizon + price + validation standard ──
  const c5 = c.card05 || { goal: '', actions: [], acceptance: '' }
  let goal = String(c5.goal || '')
  let actions = Array.isArray(c5.actions) ? c5.actions.slice() : []
  let acceptance = String(c5.acceptance || '')

  if (HORIZON_CONFLICT_TEST.test(goal) || HORIZON_CONFLICT_TEST.test(acceptance)) {
    counts.CARD05_90DAY_HORIZON_CONFLICT_COUNT++
  }
  const goalFixed = neutralizeHorizon(goal)
  const accFixed = neutralizeHorizon(acceptance)
  if (goalFixed !== goal || accFixed !== acceptance) repaired.horizon++
  goal = goalFixed
  acceptance = accFixed

  const priceBefore = actions.reduce((a, s) => a + countUnsupportedPrices(s), 0)
  if (priceBefore > 0) counts.UNSUPPORTED_EXACT_PRICE_COUNT += priceBefore
  const actionsFixed = actions.map(neutralizePrices)
  if (actionsFixed.some((s, i) => s !== actions[i])) repaired.price++
  actions = actionsFixed

  if (!oneLine(acceptance)) counts.CARD05_VALIDATION_STANDARD_MISSING_COUNT++

  // §20 — RE-CLAMP the fields a repair may have touched so the frozen card
  // budgets still hold after the guard (a replacement can be marginally longer
  // than the token it replaced). Deterministic, whole-sentence only.
  goal = fitTextTo(goal, 54)
  actions = actions.map((s) => fitTextTo(s, 46))
  acceptance = fitTextTo(acceptance, 46)
  const fromF = fitTextTo(from, 58)
  const toF = fitTextTo(to, 58)

  // ── R84-C §14/§15/§11 — personality screen (only when a profile context is
  // supplied; the R84-A path with no context is byte-identical) ──
  let r84c = null
  let outCards = {
    card01: card01,
    card02: card02,
    card03: { steps: steps, rule: rule },
    card04: { from: fromF, to: toF, rule: c4rule },
    card05: { goal: goal, actions: actions, acceptance: acceptance }
  }
  if (personalityCtx && typeof personalityCtx === 'object') {
    const screen = screenPersonality(outCards, st, personalityCtx)
    outCards = screen.cards
    r84c = { counts: screen.counts, repaired: screen.repaired, signals: screen.signals }
  }

  return {
    cmp: outCards,
    counts: counts,
    repaired: repaired,
    r84c: r84c
  }
}

module.exports = {
  HORIZON_CONFLICT_PAT,
  HORIZON_CONFLICT_TEST,
  HORIZON_REWRITE,
  PRICE_RANGE_PAT,
  PRICE_SINGLE_PAT,
  BUDGET_CONTEXT,
  GENERIC_ACTION_EXACT,
  isDuplicateConclusion,
  isBadConclusion,
  elevatedConclusion,
  countUnsupportedPrices,
  neutralizePrices,
  neutralizeHorizon,
  // R84-C
  PAID_PROOF_PAT,
  FAKE_PERSONALITY_NEVER,
  FAKE_PERSONALITY_FEAR,
  FAKE_PERSONALITY_FAMILY,
  detectPaidProofHallucination,
  detectFakePersonality,
  activeProfileSignals,
  isGenericCard,
  screenPersonality,
  guardVisibleCards
}
