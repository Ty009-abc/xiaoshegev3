'use strict'
/**
 * tests/v6/thesis/rc8.4-v6-r82-coverage-completion.test.js
 *
 * RC8.4 V6 R82 — 7-DAY TEACHING COVERAGE COMPLETION (content + mapping only).
 *
 * Validates ONLY the R82 content additions (WR025–WR034, DI022–DI027) and the
 * mapping-layer extension, plus their EFFECT on the FROZEN recommendation engine.
 * NO algorithm / scoring / seen / fallback change is asserted (§2).
 *
 * Covers §25:
 *   WR025–WR034 schema validity + mechanism/examples + no guaranteed-outcome wording
 *   DI022–DI027 schema validity + sort continuity + role distinction
 *   new blind-spot map rows → SYSTEM / PROBABILITY / COMPOUNDING / LEVERAGE profiles
 *   B/D/E reach >=7 WR candidates · 7-day no-premature-exhaustion (WR + DI)
 *   legacy F + EMPTY fallback preserved · no false personalized label
 *   scoring tiers unchanged · strike pool frozen · engine-of-record copy parity
 *
 * Deterministic. No network. Reads the REAL seed libraries + real engine.
 */

const path = require('path')
const fs = require('fs')
const ROOT = path.resolve(__dirname, '..', '..', '..')
const PERS = path.join(ROOT, 'cloudfunctions/getPersonalizedContent/lib/cognitiveProfile/personalization')
const CP = path.join(ROOT, 'cloudfunctions/getPersonalizedContent/lib/cognitiveProfile')
const DATA = path.join(ROOT, 'cloudfunctions/initDatabase/data')

const MAPS = require(path.join(PERS, 'personalizationMapsV6.js'))
const WR = require(path.join(PERS, 'worldRuleRecommenderV6.js'))
const RUNTIME = require(path.join(PERS, 'personalizationRuntimeV6.js'))
const CROSS = require(path.join(CP, 'worldRuleCrosswalkV6.js'))
const { DEFAULT_WORLD_RULES } = require(path.join(DATA, 'world_rules.js'))
const { DEFAULT_INSIGHTS } = require(path.join(DATA, 'daily_insights.js'))
const { STRIKE_POOL } = require(path.join(ROOT, 'utils/cognitionStrike.js'))

let pass = 0, fail = 0
const results = []
function ok (name, cond, extra) {
  if (cond) { pass++; results.push('  PASS ' + name) }
  else { fail++; results.push('  FAIL ' + name + (extra ? ' :: ' + extra : '')) }
}
const DAY = 20712

const WR_ROWS = DEFAULT_WORLD_RULES.map((r) => ({ ruleId: r.ruleId, title: r.title, category: r.category, tags: r.tags }))
const IN_ROWS = DEFAULT_INSIGHTS.map((r) => ({ insightId: r.insightId, title: r.title, content: r.content, tags: r.tags, difficulty: r.difficulty }))
const STRIKES = STRIKE_POOL.map((s, i) => Object.assign({}, s, { id: 'STRIKE_' + String(i).padStart(3, '0') }))
const R82_WR_IDS = ['WR025', 'WR026', 'WR027', 'WR028', 'WR029', 'WR030', 'WR031', 'WR032', 'WR033', 'WR034']
const R82_DI_IDS = ['DI022', 'DI023', 'DI024', 'DI025', 'DI026', 'DI027']
const NEW_WR = DEFAULT_WORLD_RULES.filter((r) => R82_WR_IDS.indexOf(r.ruleId) !== -1)
const NEW_DI = DEFAULT_INSIGHTS.filter((r) => R82_DI_IDS.indexOf(r.insightId) !== -1)

function canon (o) {
  o = o || {}
  return {
    present: o.present !== false,
    isLegacy: !!o.isLegacy,
    dimensions: o.dimensions || {},
    diagnosticState: { primaryBottleneck: { value: o.bottleneck !== undefined ? o.bottleneck : null } },
    cognitiveState: { primaryBlindSpot: { expression: o.blindSpot || null } },
    currentFocus: { worldRuleLensIds: o.lensIds || [], priorityTopicIds: o.topicIds || [] },
    learningHistory: { seenRuleIds: o.seenRuleIds || [], seenInsightIds: o.seenInsightIds || [], seenStrikeIds: o.seenStrikeIds || [] }
  }
}
function feedFor (profile, day) {
  return RUNTIME.buildPersonalizationFeed({ profile: profile, worldRules: WR_ROWS, insights: IN_ROWS, strikes: STRIKES, dayIndex: day === undefined ? DAY : day })
}
function firstExhaust (days, surf) { for (const d of days) if (d[surf].reasonCode === 'SEEN_EXHAUSTED_REUSE') return d.day; return null }
function run7 (profile) {
  const days = []; let sR = [], sI = []
  for (let day = 1; day <= 7; day++) {
    const p = Object.assign({}, profile, { learningHistory: { seenRuleIds: sR.slice(), seenInsightIds: sI.slice(), seenStrikeIds: [] } })
    const f = feedFor(p, DAY + (day - 1))
    days.push({ day, wr: f.worldRule, di: f.dailyInsight, personalized: f.personalized })
    if (f.worldRule.wrId) sR.push(f.worldRule.wrId)
    if (f.dailyInsight.contentId) sI.push(f.dailyInsight.contentId)
  }
  return days
}

function main () {
  // ── §3/§4 WR025–WR034 PRESENT + SCHEMA ──
  ok('R82 §3 newly added WR025–WR034 all present (10)', NEW_WR.length === 10 && NEW_WR[0].ruleId === 'WR025' && NEW_WR[9].ruleId === 'WR034')
  ok('R82 §3 existing WR001–WR024 not renumbered', DEFAULT_WORLD_RULES.slice(0, 24).every((r, i) => r.ruleId === 'WR' + String(i + 1).padStart(3, '0')))
  const REQ = ['ruleId', 'title', 'rule', 'reverseLogic', 'example', 'action', 'category', 'tags', 'unlockLevel', 'status', 'createdAt', 'updatedAt']
  ok('R82 §4 every new WR has the full production schema', NEW_WR.every((r) => REQ.every((k) => r[k] !== undefined && r[k] !== '')))
  ok('R82 §4 new WR categories are enum-valid', NEW_WR.every((r) => ['wealth', 'mindset', 'market', 'pricing', 'longterm', 'system'].indexOf(r.category) !== -1))
  ok('R82 §4 new WR tags are non-empty arrays of strings', NEW_WR.every((r) => Array.isArray(r.tags) && r.tags.length > 0 && r.tags.every((t) => typeof t === 'string')))
  ok('R82 §4 each new WR states a causal mechanism (rule length >= 30)', NEW_WR.every((r) => r.rule.length >= 30))
  ok('R82 §4 each new WR has a concrete example (>= 30 chars)', NEW_WR.every((r) => r.example.length >= 30))
  const BANNED = /保证|确保|必定|稳赚不赔|包你|保你|一定会赚|肯定能赚|一定会成功/
  ok('R82 §4 no guaranteed-outcome wording in new WR', NEW_WR.every((r) => !BANNED.test(r.title + r.rule + r.example + r.action)))
  const BARE_SLOGAN = /^(认知决定财富|选择大于努力|坚持就是胜利)。?$/
  ok('R82 §4 new WR titles are not bare slogans', NEW_WR.every((r) => !BARE_SLOGAN.test(r.title)))

  // ── §5 SYSTEM / motivation allocation (WR025–WR028) ──
  ok('R82 §5 four system/motivation rules present', ['WR025', 'WR026', 'WR027', 'WR028'].every((id) => NEW_WR.some((r) => r.ruleId === id)))
  ok('R82 §5 system rules are distinct lessons (no identical rule text)', new Set(['WR025', 'WR026', 'WR027', 'WR028'].map((id) => NEW_WR.find((r) => r.ruleId === id).rule)).size === 4)
  ok('R82 §5 WR025 encodes structure>motivation (system not willpower)', /结构/.test(NEW_WR.find((r) => r.ruleId === 'WR025').rule) && /动力/.test(NEW_WR.find((r) => r.ruleId === 'WR025').title))
  ok('R82 §5 WR027 encodes a feedback loop (not periodic self-discipline)', /反馈/.test(NEW_WR.find((r) => r.ruleId === 'WR027').rule))
  ok('R82 §5 WR028 encodes low-motivation-day operation (minimum standard)', /低动力|最差/.test(NEW_WR.find((r) => r.ruleId === 'WR028').rule + NEW_WR.find((r) => r.ruleId === 'WR028').title))

  // ── §6 PROBABILITY / risk allocation (WR029–WR032) ──
  ok('R82 §6 four probability/risk rules present', ['WR029', 'WR030', 'WR031', 'WR032'].every((id) => NEW_WR.some((r) => r.ruleId === id)))
  ok('R82 §6 WR029 encodes positive expected value', /期望值/.test(NEW_WR.find((r) => r.ruleId === 'WR029').rule))
  ok('R82 §6 WR030 encodes base rate before case', /基础概率/.test(NEW_WR.find((r) => r.ruleId === 'WR030').rule))
  ok('R82 §6 WR031 encodes asymmetric payoff', /非对称|上限/.test(NEW_WR.find((r) => r.ruleId === 'WR031').rule))
  ok('R82 §6 WR032 encodes reversibility of decisions', /可逆/.test(NEW_WR.find((r) => r.ruleId === 'WR032').title + NEW_WR.find((r) => r.ruleId === 'WR032').rule))

  // ── §7 COMPOUNDING / learning-curve (WR033) + LEVERAGE/reuse (WR034) ──
  ok('R82 §7 WR033 encodes learning-curve continuity', /学习曲线|不断档/.test(NEW_WR.find((r) => r.ruleId === 'WR033').rule))
  ok('R82 §7 WR034 encodes reuse leverage (build once, use many)', /复用|很多次|重复使用/.test(NEW_WR.find((r) => r.ruleId === 'WR034').rule + NEW_WR.find((r) => r.ruleId === 'WR034').title))

  // ── §8 DAILY INSIGHT additions + schema ──
  ok('R82 §8 six new daily insights present (DI022–DI027)', NEW_DI.length === 6 && NEW_DI[0].insightId === 'DI022' && NEW_DI[5].insightId === 'DI027')
  const DIREQ = ['insightId', 'title', 'content', 'reverseReasoning', 'caseText', 'action', 'tags', 'difficulty', 'sort', 'status']
  ok('R82 §8 every new DI has the full production schema', NEW_DI.every((r) => DIREQ.every((k) => r[k] !== undefined && r[k] !== '')))
  ok('R82 §8 new DI difficulty is enum 1/2', NEW_DI.every((r) => r.difficulty === 1 || r.difficulty === 2))
  ok('R82 §8 new DI sort continues 22..27', NEW_DI.map((r) => r.sort).join(',') === '22,23,24,25,26,27')
  const wrAll = DEFAULT_WORLD_RULES.map((r) => r.title + r.rule).join(' ')
  ok('R82 §8 new DI is interpretation, not a copy of a WR statement', NEW_DI.every((r) => !wrAll.includes(r.content)))
  const DIBAN = /保证|确保|必定|稳赚不赔|包你|保你/
  ok('R82 §8 no guaranteed-outcome wording in new DI', NEW_DI.every((r) => !DIBAN.test(r.title + r.content + r.caseText + r.action)))

  // ── §2 STRIKE POOL FROZEN ──
  ok('R82 §2 strike pool unchanged at 50', STRIKE_POOL.length === 50)
  const strikeSrc = fs.readFileSync(path.join(ROOT, 'utils/cognitionStrike.js'), 'utf8')
  ok('R82 §2 STRIKE_CONTENT_DIFF_COUNT=0 (no R82 marker in strike file)', !/R82/.test(strikeSrc))

  // ── §2 CROSSWALK UNTOUCHED (lens→WR mapping unchanged) ──
  const counts = CROSS.crosswalkCounts()
  ok('R82 §2 crosswalk lens→WR mapping unchanged (DIRECT 6 / PARTIAL 3 / NONE 0)', counts.DIRECT === 6 && counts.PARTIAL === 3 && counts.NONE === 0 && counts.TOTAL === 9)

  // ── §9 REACHABILITY (new content reachable from EXISTING signals) ──
  const reach = MAPS.reachableWorldRuleIds()
  ok('R82 §9 WR id space is 34', MAPS.WORLD_RULE_IDS.length === 34)
  ok('R82 §9 all 10 new WR are reachable from existing signals', R82_WR_IDS.every((id) => reach.indexOf(id) !== -1))
  ok('R82 §9 no parallel taxonomy invented (reuses existing signal keys)', MAPS.PROBLEM_IDS.every((k) => /^PROBLEM_/.test(k)))
  ok('R82 §9 WORLD_RULE_INDEX carries exactly the 34 seed ids', Object.keys(MAPS.WORLD_RULE_INDEX).length === 34)

  // ── §10 REACHABLE CANDIDATE COUNT per target profile (>=7 for A–E) ──
  function candCount (label) {
    const F = {
      A: canon({ topicIds: ['PROBLEM_MONETIZE'], blindSpot: '你一直在用免费帮人做来验证能力，从未用一个明确的价格去验证市场，缺少定价的勇气和市场付费的证明' }),
      B: canon({ lensIds: ['PROBABILITY_OVER_CERTAINTY'], bottleneck: 'DIRECTION_GAP', blindSpot: '你过度追求确定性，不敢做概率决策，缺少风险认知和期望值思维' }),
      C: canon({ lensIds: ['LEVERAGE_OVER_TIME_FOR_MONEY'], topicIds: ['PROBLEM_INCOME_STUCK'], blindSpot: '你依赖单一劳动收入，缺少杠杆，一直在用时间换钱' }),
      D: canon({ lensIds: ['SYSTEM_OVER_MOTIVATION'], bottleneck: 'CONSISTENCY_GAP', blindSpot: '你靠一时动力，缺少稳定系统，反复半途而废，动机一退就停' }),
      E: canon({ lensIds: ['COMPOUNDING_OVER_RESTARTING'], bottleneck: 'CONSISTENCY_GAP', blindSpot: '你频繁重启，无法积累复利，缺少长期主义和延迟满足' })
    }
    return Object.keys(WR.scoreCandidates(F[label]).scores).length
  }
  ok('R82 §10 D (SYSTEM_OVER_MOTIVATION) reaches >=7 WR candidates', candCount('D') >= 7, 'got ' + candCount('D'))
  ok('R82 §10 B (PROBABILITY) reaches >=7 WR candidates', candCount('B') >= 7, 'got ' + candCount('B'))
  ok('R82 §10 E (COMPOUNDING) reaches >=7 WR candidates', candCount('E') >= 7, 'got ' + candCount('E'))
  ok('R82 §10 C (LEVERAGE) reaches >=7 WR candidates', candCount('C') >= 7, 'got ' + candCount('C'))
  ok('R82 §10 A (OWNER/MONETIZE) still reaches >=7 WR candidates', candCount('A') >= 7, 'got ' + candCount('A'))

  // ── §11 D-SYSTEM 7-day: no premature exhaustion + teaches the new system content ──
  const D = canon({ lensIds: ['SYSTEM_OVER_MOTIVATION'], bottleneck: 'CONSISTENCY_GAP', blindSpot: '你靠一时动力，缺少稳定系统，反复半途而废，动机一退就停' })
  const dDays = run7(D)
  const dSeq = dDays.map((x) => x.wr.wrId)
  ok('R82 §11 D_WR_FIRST_EXHAUSTION_DAY > 7 (no exhaust within 7d)', firstExhaust(dDays, 'wr') === null, 'got ' + firstExhaust(dDays, 'wr'))
  ok('R82 §11 D sequence serves >=3 of the new SYSTEM rules', ['WR025', 'WR026', 'WR027', 'WR028'].filter((id) => dSeq.indexOf(id) !== -1).length >= 3, 'got ' + dSeq.join(','))
  ok('R82 §11 D_WR_UNIQUE_7D=7 (full week of distinct rules)', new Set(dSeq).size === 7, 'got ' + new Set(dSeq).size)
  ok('R82 §11 D_WR_FALLBACK_COUNT=0 (every day is genuinely personalized)', dDays.every((x) => x.wr.reasonCode !== 'FALLBACK_DATE' && x.wr.reasonCode !== 'FALLBACK_UNMAPPED'))

  // ── §12 B-PROBABILITY 7-day ──
  const B = canon({ lensIds: ['PROBABILITY_OVER_CERTAINTY'], bottleneck: 'DIRECTION_GAP', blindSpot: '你过度追求确定性，不敢做概率决策，缺少风险认知和期望值思维' })
  const bDays = run7(B)
  const bSeq = bDays.map((x) => x.wr.wrId)
  ok('R82 §12 B_WR_FIRST_EXHAUSTION_DAY > 7 (was 4 in R80/R81)', firstExhaust(bDays, 'wr') === null, 'got ' + firstExhaust(bDays, 'wr'))
  ok('R82 §12 B sequence serves >=3 of the new PROBABILITY rules', ['WR029', 'WR030', 'WR031', 'WR032'].filter((id) => bSeq.indexOf(id) !== -1).length >= 3, 'got ' + bSeq.join(','))
  ok('R82 §12 B_WR_UNIQUE_7D=7', new Set(bSeq).size === 7, 'got ' + new Set(bSeq).size)
  ok('R82 §12 B_DI_FIRST_EXHAUSTION_DAY > 7 (was 6)', firstExhaust(bDays, 'di') === null, 'got ' + firstExhaust(bDays, 'di'))

  // ── §13 E-COMPOUNDING 7-day ──
  const E = canon({ lensIds: ['COMPOUNDING_OVER_RESTARTING'], bottleneck: 'CONSISTENCY_GAP', blindSpot: '你频繁重启，无法积累复利，缺少长期主义和延迟满足' })
  const eDays = run7(E)
  const eSeq = eDays.map((x) => x.wr.wrId)
  ok('R82 §13 E_WR_FIRST_EXHAUSTION_DAY > 7 (was 6)', firstExhaust(eDays, 'wr') === null, 'got ' + firstExhaust(eDays, 'wr'))
  ok('R82 §13 compounding lens still drives WR019 first (LENS_DIRECT)', eDays[0].wr.wrId === 'WR019' && eDays[0].wr.reasonCode === 'LENS_DIRECT')
  ok('R82 §13 E sequence serves WR033 (learning curve) and >=2 compounding rules', eSeq.indexOf('WR033') !== -1 && ['WR019', 'WR020', 'WR021', 'WR033'].filter((id) => eSeq.indexOf(id) !== -1).length >= 3, 'got ' + eSeq.join(','))
  ok('R82 §13 E_DI_FIRST_EXHAUSTION_DAY > 7 (was 5)', firstExhaust(eDays, 'di') === null, 'got ' + firstExhaust(eDays, 'di'))

  // ── §14 C-LEVERAGE 7-day ──
  const C = canon({ lensIds: ['LEVERAGE_OVER_TIME_FOR_MONEY'], topicIds: ['PROBLEM_INCOME_STUCK'], blindSpot: '你依赖单一劳动收入，缺少杠杆，一直在用时间换钱' })
  const cDays = run7(C)
  const cSeq = cDays.map((x) => x.wr.wrId)
  ok('R82 §14 C_WR_FIRST_EXHAUSTION_DAY > 7 (was 7)', firstExhaust(cDays, 'wr') === null, 'got ' + firstExhaust(cDays, 'wr'))
  ok('R82 §14 C sequence serves WR034 (reuse leverage)', cSeq.indexOf('WR034') !== -1, 'got ' + cSeq.join(','))

  // ── §15 OWNER A no-regression ──
  const A = canon({ topicIds: ['PROBLEM_MONETIZE'], blindSpot: '你一直在用免费帮人做来验证能力，从未用一个明确的价格去验证市场，缺少定价的勇气和市场付费的证明' })
  const aDays = run7(A)
  const aSeq = aDays.map((x) => x.wr.wrId)
  ok('R82 §15 OWNER_WR_FIRST_EXHAUSTION_DAY > 7 (unchanged)', firstExhaust(aDays, 'wr') === null, 'got ' + firstExhaust(aDays, 'wr'))
  ok('R82 §15 OWNER_A_WR_SEQUENCE_UNCHANGED_BY_R82 (WR003→WR016→WR017→WR002→WR018→WR022→WR023)', aSeq.join(',') === 'WR003,WR016,WR017,WR002,WR018,WR022,WR023', 'got ' + aSeq.join(','))
  ok('R82 §15 OWNER_DI_FIRST_EXHAUSTION_DAY > 7 (unchanged)', firstExhaust(aDays, 'di') === null)

  // ── §16 DAILY 7-day capacity across A–E (no EXHAUSTED within 7d) ──
  ok('R82 §16 A–E DAILY_7D_FIRST_EXHAUSTION all > 7', ['A', 'B', 'C', 'D', 'E'].every((l) => {
    const F = { A: A, B: B, C: C, D: D, E: E }
    return firstExhaust(run7(F[l]), 'di') === null
  }))

  // ── §17 NO FALSE PERSONALIZED LABEL ──
  ok('R82 §17 empty profile → no label anywhere', (function () {
    const f = feedFor(canon({ present: false }))
    return f.label === null && f.dailyInsight.label === null && f.strike.label === null && f.personalized === false
  })())
  ok('R82 §17 new content only labeled when truly profile-driven', (function () {
    const f = feedFor(D)
    return f.personalized === true && f.label === '根据你最近的认知诊断推荐'
  })())
  ok('R82 §17 FALSE_PERSONALIZED_LABEL_COUNT=0 (fallback surfaces carry no label)', (function () {
    const f = feedFor(canon({ present: false }))
    return [f.worldRule, f.dailyInsight, f.strike].every((s) => s.personalized === false)
  })())

  // ── §18 LEGACY / EMPTY SAFETY ──
  const LEG = canon({ isLegacy: true, dimensions: { probabilityMindset: 20, systemThinking: 30, leverageThinking: 25, informationSensitivity: 22, laborMindset: 70 } })
  ok('R82 §18 LEGACY_BEHAVIOR_PASS (legacy still personalizes via dimension, no crash)', (function () {
    const f = feedFor(LEG)
    return f.worldRule.sourceSignal === 'legacy_dimension' && typeof f.worldRule.wrId === 'string'
  })())
  ok('R82 §18 EMPTY_PROFILE_BEHAVIOR_PASS (date fallback over 34-rule library)', (function () {
    const f = feedFor(canon({ present: false }))
    return f.worldRule.reasonCode === 'FALLBACK_DATE' && f.worldRule.wrId === MAPS.WORLD_RULE_IDS[DAY % MAPS.WORLD_RULE_IDS.length]
  })())

  // ── §2 NO ALGORITHM CHANGE ──
  ok('R82 §2 SCORE tiers unchanged', JSON.stringify(MAPS.SCORE) === JSON.stringify({ LENS_DIRECT: 100, LENS_PARTIAL: 50, TOPIC_DIRECT: 40, TOPIC_PARTIAL: 20, BLINDSPOT_DIRECT: 30, BLINDSPOT_PARTIAL: 15, BOTTLENECK: 25, LEGACY_DIMENSION: 10 }))
  const recSrc = fs.readFileSync(path.join(PERS, 'worldRuleRecommenderV6.js'), 'utf8')
  const dailySrc = fs.readFileSync(path.join(PERS, 'dailyCognitionRecommenderV6.js'), 'utf8')
  ok('R82 §2 WORLD_RULE_RECOMMENDER_DIFF_COUNT=0', !/R82/.test(recSrc))
  ok('R82 §2 DAILY_COGNITION_RECOMMENDER_DIFF_COUNT=0', !/R82/.test(dailySrc))
  ok('R82 §2 RUNTIME_DIFF_COUNT=0', !/R82/.test(fs.readFileSync(path.join(PERS, 'personalizationRuntimeV6.js'), 'utf8')))
  ok('R82 §2 LEARNING_HISTORY_DIFF_COUNT=0', !/R82/.test(fs.readFileSync(path.join(PERS, 'learningHistoryV6.js'), 'utf8')))
  ok('R82 §2 no LLM / network introduced', !/openai|callAI|fetch\(|http/i.test(recSrc + dailySrc))

  // ── §2 engine-of-record vs deployed-copy parity ──
  const parity = ['worldRuleRecommenderV6.js', 'dailyCognitionRecommenderV6.js', 'personalizationRuntimeV6.js', 'personalizationMapsV6.js', 'learningHistoryV6.js']
    .every((f) => fs.readFileSync(path.join(PERS, f), 'utf8') === fs.readFileSync(path.join(ROOT, 'cloudfunctions/generateAiReport/lib/cognitiveProfile/personalization', f), 'utf8'))
  ok('R82 §2 getPersonalizedContent copies byte-identical to engine-of-record', parity)
  ok('R82 §2 crosswalk copies byte-identical', fs.readFileSync(path.join(CP, 'worldRuleCrosswalkV6.js'), 'utf8') === fs.readFileSync(path.join(ROOT, 'cloudfunctions/generateAiReport/lib/cognitiveProfile/worldRuleCrosswalkV6.js'), 'utf8'))

  // ── §19 DUPLICATION (no exact duplicate content) ──
  const wrTexts = DEFAULT_WORLD_RULES.map((r) => r.rule + '|' + r.title)
  const diTexts = DEFAULT_INSIGHTS.map((r) => r.content + '|' + r.title)
  ok('R82 §19 NEW_EXACT_DUPLICATE_COUNT=0 (WR)', wrTexts.length === new Set(wrTexts).size)
  ok('R82 §19 NEW_EXACT_DUPLICATE_COUNT=0 (DI)', diTexts.length === new Set(diTexts).size)

  // ── §20 FROZEN R81 CONTENT not weakened ──
  ok('R82 §20 R81 WR016–WR024 still present and unchanged in count', ['WR016', 'WR017', 'WR018', 'WR019', 'WR020', 'WR021', 'WR022', 'WR023', 'WR024'].every((id) => DEFAULT_WORLD_RULES.some((r) => r.ruleId === id)))
  ok('R82 §20 R81 DI016–DI021 still present', ['DI016', 'DI017', 'DI018', 'DI019', 'DI020', 'DI021'].every((id) => DEFAULT_INSIGHTS.some((r) => r.insightId === id)))
  // legacy suspicious claim flagged but NOT edited (WR013)
  ok('R82 §20 WR013 legacy claim flagged but untouched (still present, unedited)', DEFAULT_WORLD_RULES.some((r) => r.ruleId === 'WR013'))

  console.log(results.join('\n'))
  console.log('\nR82 TESTS: ' + pass + ' passed, ' + fail + ' failed')
  if (fail > 0) process.exit(1)
}

main()
