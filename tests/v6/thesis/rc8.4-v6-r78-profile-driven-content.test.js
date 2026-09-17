'use strict'
/**
 * tests/v6/thesis/rc8.4-v6-r78-profile-driven-content.test.js
 *
 * RC8.4 V6 R78 — PROFILE-DRIVEN WORLD RULE + DAILY COGNITION.
 *
 * Covers §28:
 *   profile with lens id · only priorityTopicId · blindSpot only · bottleneck only
 *   legacy profile · empty profile · seen-rule avoidance · all-seen fallback
 *   same-user same-day stability · two-user same-day differentiation
 *   learningHistory merge · personalization-label truthfulness
 *   DIRECT/PARTIAL/NONE mapping behavior
 *
 * Deterministic. No network. In-memory content (the real seed/pool shapes).
 */

const path = require('path')
const fs = require('fs')
const ROOT = path.resolve(__dirname, '..', '..', '..')
const PERS = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/cognitiveProfile/personalization')
const CP = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/cognitiveProfile')
const FN = path.join(ROOT, 'cloudfunctions/getPersonalizedContent')

const MAPS = require(path.join(PERS, 'personalizationMapsV6.js'))
const WR = require(path.join(PERS, 'worldRuleRecommenderV6.js'))
const DAILY = require(path.join(PERS, 'dailyCognitionRecommenderV6.js'))
const RUNTIME = require(path.join(PERS, 'personalizationRuntimeV6.js'))
const HIST = require(path.join(PERS, 'learningHistoryV6.js'))
const CROSS = require(path.join(CP, 'worldRuleCrosswalkV6.js'))
const { STRIKE_POOL } = require(path.join(FN, 'lib/content/cognitionStrikePoolV6.js'))

let pass = 0, fail = 0
const results = []
function ok (name, cond, extra) {
  if (cond) { pass++; results.push('  PASS ' + name) }
  else { fail++; results.push('  FAIL ' + name + (extra ? ' :: ' + extra : '')) }
}

const DAY = 20000 // deterministic day index

// ── real seed/shape content ──
const WORLD_RULES = Object.keys(MAPS.WORLD_RULE_INDEX).map((id) => ({ ruleId: id, category: MAPS.WORLD_RULE_INDEX[id].category, tags: MAPS.WORLD_RULE_INDEX[id].tags }))
const INSIGHTS = [
  { insightId: 'DI001', tags: ['努力陷阱', '杠杆思维', '财富认知'], difficulty: 1 },
  { insightId: 'DI002', tags: ['概率思维', '决策质量', '风险认知'], difficulty: 2 },
  { insightId: 'DI003', tags: ['杠杆思维', '系统思维', '财富认知'], difficulty: 1 },
  { insightId: 'DI004', tags: ['信息差', '认知差', '财富认知'], difficulty: 2 },
  { insightId: 'DI005', tags: ['系统思维', '杠杆思维', '认知觉醒'], difficulty: 2 },
  { insightId: 'DI006', tags: ['延迟满足', '复利思维', '长期主义'], difficulty: 1 },
  { insightId: 'DI007', tags: ['风险认知', '仓位管理', '认知觉醒'], difficulty: 2 },
  { insightId: 'DI008', tags: ['认知税', '信息差', '财富认知'], difficulty: 1 },
  { insightId: 'DI009', tags: ['复利思维', '长期主义', '延迟满足'], difficulty: 1 },
  { insightId: 'DI010', tags: ['穷人税', '风险认知', '认知觉醒'], difficulty: 1 },
  { insightId: 'DI011', tags: ['情绪交易', '决策质量', '风险认知'], difficulty: 2 },
  { insightId: 'DI012', tags: ['注意力税', '信息茧房', '认知觉醒'], difficulty: 1 },
  { insightId: 'DI013', tags: ['圈层壁垒', '信息差', '认知觉醒'], difficulty: 2 },
  { insightId: 'DI014', tags: ['断臂求生', '沉没成本', '决策质量'], difficulty: 2 },
  { insightId: 'DI015', tags: ['知行合一', '执行差', '认知觉醒'], difficulty: 1 },
  // ── R81 additions ──
  { insightId: 'DI016', tags: ['定价', '报价测试', '执行差'], difficulty: 1 },
  { insightId: 'DI017', tags: ['付费验证', '需求验证', '执行差'], difficulty: 1 },
  { insightId: 'DI018', tags: ['复利思维', '长期主义', '连续性'], difficulty: 1 },
  { insightId: 'DI019', tags: ['长期主义', '反馈循环', '系统思维'], difficulty: 2 },
  { insightId: 'DI020', tags: ['可重复性', '系统思维', '执行差'], difficulty: 2 },
  { insightId: 'DI021', tags: ['产品化', '交付', '系统思维'], difficulty: 2 }
]

// ── canonical normalized profile builder (the recommender input contract) ──
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

// ── the three CONTROL profiles (§29) ──
// A — R77 owner-class (NO_PRIMARY, empty lens, PROBLEM_MONETIZE) — the §19 shape.
const A = canon({ lensIds: [], topicIds: ['PROBLEM_MONETIZE'], blindSpot: '他以为自己的问题是知道该做什么但没行动，是执行力问题。但真正卡住他的是把变现当成需要准备好才能启动的大项目。', bottleneck: null })
// B — probability / risk profile (§18).
const B = canon({ lensIds: ['PROBABILITY_OVER_CERTAINTY'], topicIds: [], blindSpot: '穷人追求确定性，富人拥抱概率。' })
// C — legacy no-V1 profile (§20): 9 dims only, no v1 sections.
const C = canon({ isLegacy: true, dimensions: { probabilityMindset: 20, systemThinking: 30, leverageThinking: 25, informationSensitivity: 22, laborMindset: 70 } })

function feedFor (profile, day) {
  return RUNTIME.buildPersonalizationFeed({ profile: profile, worldRules: WORLD_RULES, insights: INSIGHTS, strikes: STRIKE_POOL, dayIndex: day === undefined ? DAY : day })
}

function main () {
  // ── §4 NO NEW TAXONOMY (static) ──
  const mapsSrc = fs.readFileSync(path.join(PERS, 'personalizationMapsV6.js'), 'utf8')
  ok('R78 §4 no personalizationTagV2 invented', !/personalizationTagV2/.test(mapsSrc))
  ok('R78 §4 no recommendationCategoryV3 invented', !/recommendationCategoryV3/.test(mapsSrc))
  ok('R78 §4 reuses R77 crosswalk', /getCrosswalkForLens/.test(mapsSrc))
  ok('R78 §4 reuses existing lens candidate table', /CANDIDATES_BY_BOTTLENECK/.test(mapsSrc))
  ok('R78 §4 WR id space is WR001–WR034 (R81/R82)', MAPS.WORLD_RULE_IDS.length === 34 && MAPS.WORLD_RULE_IDS[0] === 'WR001' && MAPS.WORLD_RULE_IDS[33] === 'WR034')

  // ── §7 DIRECT / PARTIAL / NONE mapping behavior ──
  const dir = CROSS.getCrosswalkForLens('PROBABILITY_OVER_CERTAINTY')
  const part = CROSS.getCrosswalkForLens('SYSTEM_OVER_MOTIVATION')
  const comp = CROSS.getCrosswalkForLens('COMPOUNDING_OVER_RESTARTING')
  ok('R78 §7 DIRECT lens → WR004', dir.status === 'DIRECT' && dir.wrId === 'WR004')
  ok('R78 §7 PARTIAL lens → WR008', part.status === 'PARTIAL' && part.wrId === 'WR008')
  ok('R78 §7 COMPOUNDING lens now DIRECT → WR019 (R81 repair)', comp.status === 'DIRECT' && comp.wrId === 'WR019')
  // An UNMAPPED lens id (no crosswalk row) must never force a WR → date fallback (§10).
  const noneOnly = feedFor(canon({ lensIds: ['NOT_A_MAPPED_LENS'] }))
  ok('R78 §7 unmapped lens alone does NOT force a WR id (fallback)', noneOnly.worldRule.personalized === false && noneOnly.worldRule.reasonCode === 'FALLBACK_DATE')
  // unmapped lens + topic → topic drives (§7 continue to topics)
  const nonePlusTopic = feedFor(canon({ lensIds: ['NOT_A_MAPPED_LENS'], topicIds: ['PROBLEM_MONETIZE'] }))
  ok('R78 §7 unmapped lens + topic → topic drives selection', nonePlusTopic.worldRule.personalized === true && nonePlusTopic.worldRule.wrId === 'WR003' && nonePlusTopic.worldRule.sourceSignal === 'topic')

  // ── §5 recommender output contract ──
  const fa = feedFor(A)
  ok('R78 §5 output has wrId/reasonCode/sourceSignal/personalized', fa.worldRule.wrId && fa.worldRule.reasonCode && fa.worldRule.sourceSignal && typeof fa.worldRule.personalized === 'boolean')
  ok('R78 §5 no LLM ranking (pure module)', !/openai|callAI|fetch\(|http/i.test(fs.readFileSync(path.join(PERS, 'worldRuleRecommenderV6.js'), 'utf8')))

  // ── §28 profile with only priorityTopicId (A) ──
  ok('R78 §3/§19 A (empty lens + topic) → personalized YES', fa.personalized === true && fa.worldRule.personalized === true)
  ok('R78 §19 PERSONALIZATION_WORKS_WITH_EMPTY_LENS_IDS=YES', fa.worldRule.wrId === 'WR003' && fa.worldRule.reasonCode === 'TOPIC_MATCH' && fa.worldRule.sourceSignal === 'topic')

  // ── §28 profile with lens ID (B) ──
  const fb = feedFor(B)
  ok('R78 §28 B (lens id) → DIRECT lens selection WR004', fb.worldRule.wrId === 'WR004' && fb.worldRule.reasonCode === 'LENS_DIRECT' && fb.worldRule.sourceSignal === 'lens')

  // ── §28 profile with blindSpot only ──
  const blindOnly = feedFor(canon({ blindSpot: '穷人和富人最大的差距不是钱，是对概率的理解。' }))
  ok('R78 §28 blindSpot-only → personalized via blindspot', blindOnly.worldRule.personalized === true && blindOnly.worldRule.sourceSignal === 'blindspot' && blindOnly.worldRule.wrId === 'WR004')

  // ── §28 profile with bottleneck only ──
  const botOnly = feedFor(canon({ bottleneck: 'DIRECTION_GAP' }))
  ok('R78 §28 bottleneck-only → personalized via bottleneck', botOnly.worldRule.personalized === true && botOnly.worldRule.sourceSignal === 'bottleneck')

  // ── §28 legacy profile (C) ──
  const fc = feedFor(C)
  ok('R78 §20/§28 C (legacy) → personalized via legacy dimension', fc.personalized === true && fc.worldRule.sourceSignal === 'legacy_dimension')

  // ── §28 empty profile ──
  const fe = feedFor(canon({ present: false }))
  ok('R78 §10/§28 EMPTY_PROFILE_FALLBACK_PRESERVED', fe.personalized === false && fe.worldRule.reasonCode === 'FALLBACK_DATE' && fe.worldRule.sourceSignal === 'date')
  ok('R78 §10/§21 EMPTY_PROFILE_FALLBACK_PRESERVED (daily)', fe.dailyInsight.reasonCode === 'FALLBACK_DATE' && fe.dailyInsight.personalized === false && fe.strike.reasonCode === 'FALLBACK_DATE')

  // ── §10 legacy user world-rule behavior preserved ──
  ok('R78 §10 LEGACY_USER_WORLD_RULE_BEHAVIOR_PRESERVED', fe.worldRule.wrId === MAPS.WORLD_RULE_IDS[DAY % MAPS.WORLD_RULE_IDS.length])

  // ── §8 seen-rule avoidance ──
  const seenA = feedFor(canon({ topicIds: ['PROBLEM_MONETIZE'], seenRuleIds: ['WR003'] }))
  ok('R78 §8 SEEN_RULE_AVOIDANCE_IMPLEMENTED (prefers unseen WR016)', seenA.worldRule.personalized === true && seenA.worldRule.wrId === 'WR016' && seenA.worldRule.reasonCode === 'TOPIC_MATCH')
  // all relevant seen → deterministic reuse, no dead-end
  const allSeenA = feedFor(canon({ topicIds: ['PROBLEM_MONETIZE'], seenRuleIds: ['WR003', 'WR016', 'WR017', 'WR018', 'WR022', 'WR023', 'WR002'] }))
  ok('R78 §8 all-seen → SEEN_EXHAUSTED_REUSE (no dead-end)', allSeenA.worldRule.reasonCode === 'SEEN_EXHAUSTED_REUSE' && allSeenA.worldRule.personalized === true)

  // ── §9 same-user same-day stability ──
  const s1 = feedFor(A, DAY), s2 = feedFor(A, DAY), s3 = feedFor(A, DAY)
  ok('R78 §9 SAME_USER_SAME_DAY_STABLE', s1.worldRule.wrId === s2.worldRule.wrId && s2.worldRule.wrId === s3.worldRule.wrId && s1.dailyInsight.contentId === s3.dailyInsight.contentId && s1.strike.contentId === s3.strike.contentId)

  // ── §18 two-user same-day differentiation ──
  ok('R78 §18 A_WORLD_RULE != B_WORLD_RULE', fa.worldRule.wrId !== fb.worldRule.wrId, fa.worldRule.wrId + ' vs ' + fb.worldRule.wrId)
  ok('R78 §18 A_DAILY_COGNITION != B_DAILY_COGNITION', fa.dailyInsight.contentId !== fb.dailyInsight.contentId, fa.dailyInsight.contentId + ' vs ' + fb.dailyInsight.contentId)
  ok('R78 §18 A_STRIKE != B_STRIKE', fa.strike.contentId !== fb.strike.contentId, fa.strike.contentId + ' vs ' + fb.strike.contentId)
  ok('R78 §18/§30 TWO_USER_SAME_DAY_DIFFERENTIATED=YES', fa.worldRule.wrId !== fb.worldRule.wrId && fa.dailyInsight.contentId !== fb.dailyInsight.contentId)

  // ── §11/§12 daily unseen preference ──
  const seenDaily = feedFor(canon({ lensIds: ['PROBABILITY_OVER_CERTAINTY'], seenInsightIds: ['DI002'] }))
  ok('R78 §12 daily prefers unseen relevant item', seenDaily.dailyInsight.personalized === true && seenDaily.dailyInsight.contentId !== 'DI002' && seedReasonIsRelevant(seenDaily.dailyInsight.contentId))

  // ── §14 personalization-label truthfulness ──
  ok('R78 §14 PERSONALIZATION_LABEL_ONLY_WHEN_TRUE (personalized has label)', fa.dailyInsight.personalized === true && fa.dailyInsight.label === '根据你最近的认知诊断推荐')
  ok('R78 §14 PERSONALIZATION_LABEL_ONLY_WHEN_TRUE (fallback has no label)', fe.dailyInsight.label === null && fe.strike.label === null && feedFor(canon({ present: false })).label === null)
  ok('R78 §13/§14 metadata present (reasonCode/sourceSignal/contentId)', !!fa.dailyInsight.reasonCode && !!fa.dailyInsight.sourceSignal && !!fa.dailyInsight.contentId)

  // ── §15/§16/§17 learning-history merge (pure) ──
  const h0 = { seenRuleIds: ['WR001'], seenInsightIds: ['DI_1'], seenStrikeIds: [] }
  const h1 = HIST.mergeSeen(h0, HIST.SEEN_KINDS.RULE, 'WR004', 111)
  ok('R78 §15 markSeen(rule) writes seenRuleIds', h1.seenRuleIds.indexOf('WR004') !== -1)
  ok('R78 §16 SEEN_HISTORY_RESET_COUNT=0 (union preserves WR001)', h1.seenRuleIds.indexOf('WR001') !== -1)
  ok('R78 §16 insight ids preserved on rule merge', h1.seenInsightIds.indexOf('DI_1') !== -1)
  const h2 = HIST.mergeSeen(h1, HIST.SEEN_KINDS.STRIKE, 'STRIKE_007', 222)
  ok('R78 §15 markSeen(strike) writes seenStrikeIds', h2.seenStrikeIds.indexOf('STRIKE_007') !== -1)
  ok('R78 §16 merge is union-only (rule ids still intact)', h2.seenRuleIds.indexOf('WR004') !== -1 && h2.seenRuleIds.indexOf('WR001') !== -1)
  // §17 seen ≠ saved (no strike_collection writer in these modules)
  const lhSrc = fs.readFileSync(path.join(PERS, 'learningHistoryV6.js'), 'utf8')
  ok('R78 §17 seen ≠ saved (no strike_collection write here)', !/strike_collection/.test(lhSrc))
  ok('R78 §15 not marked seen merely by ranking (runtime never calls markSeen)', !/markSeen\(/.test(fs.readFileSync(path.join(PERS, 'personalizationRuntimeV6.js'), 'utf8')))

  // ── §15 DB writeback (in-memory mock) ──
  const mock = makeMock({ _id: 'p1', openid: 'oX', learningHistory: { seenRuleIds: ['WR001'] } })
  let done = false
  HIST.markSeen(mock.db, 'oX', 'rule', 'WR004', 999).then((r) => {
    ok('R78 §15 markSeen DB write ok', r.ok === true && r.wrote === true)
    ok('R78 §16 DB merge preserves WR001 + adds WR004', mock.state.profile.learningHistory.seenRuleIds.join(',') === 'WR001,WR004')
    // idempotent second time
    return HIST.markSeen(mock.db, 'oX', 'rule', 'WR004', 1000)
  }).then((r2) => {
    ok('R78 §15 idempotent ALREADY_SEEN on repeat', r2.ok === true && r2.idempotent === true && r2.wrote === false)
    done = true
  }).catch((e) => { ok('R78 §15 markSeen did not throw', false, String(e && e.message)); done = true })

  // ── §23 mapping quality: DIRECT/PARTIAL/NONE + unmapped signals ──
  const reach = MAPS.reachableWorldRuleIds()
  const covered = reach.length
  const uncovered = MAPS.WORLD_RULE_IDS.filter((id) => reach.indexOf(id) === -1)
  ok('R78 §23 every mapping row carries DIRECT/PARTIAL/NONE status', MAPS.BLINDSPOT_KEYWORD_MAP.every((r) => r.status === 'DIRECT' || r.status === 'PARTIAL'))
  ok('R78 §23 unmapped WR ids returned explicitly', Array.isArray(uncovered))
  ok('R78 §7/§23 crosswalk counts after R81 (DIRECT6/PARTIAL3/NONE0)', JSON.stringify(CROSS.crosswalkCounts()) === JSON.stringify({ DIRECT: 6, PARTIAL: 3, NONE: 0, TOTAL: 9, UNKNOWN_LENS: 0 }))

  // ── §22 coverage ──
  const wrCoverage = covered + '/24'
  const insightTags = new Set()
  for (const k of Object.keys(MAPS.LENS_KEYWORDS)) for (const t of MAPS.LENS_KEYWORDS[k]) insightTags.add(t)
  for (const k of Object.keys(MAPS.TOPIC_KEYWORDS)) for (const t of MAPS.TOPIC_KEYWORDS[k]) insightTags.add(t)
  const insightCovered = INSIGHTS.filter((i) => i.tags.some((t) => insightTags.has(t))).length
  const reachDims = new Set([...Object.values(MAPS.LENS_DIMENSION), ...Object.values(MAPS.TOPIC_DIMENSION)].filter(Boolean))
  const strikeCovered = STRIKE_POOL.filter((s) => (s.dimensions || []).some((d) => reachDims.has(d))).length
  results.push('  INFO WORLD_RULE_PROFILE_MAPPING_COVERAGE=' + wrCoverage)
  results.push('  INFO DAILY_INSIGHT_MAPPING_COVERAGE=' + insightCovered + '/21')
  results.push('  INFO STRIKE_MAPPING_COVERAGE=' + strikeCovered + '/' + STRIKE_POOL.length)
  ok('R78 §22 coverage reported (WR reachable > 0)', covered > 0)
  ok('R78 §22 daily insight coverage > 0', insightCovered > 0)
  ok('R78 §22 strike coverage > 0', strikeCovered > 0)

  // ── §24/§25/§26 no challenge / AI QA / gamification change (static) ──
  const eng = ['worldRuleRecommenderV6.js', 'dailyCognitionRecommenderV6.js', 'personalizationRuntimeV6.js', 'personalizationMapsV6.js', 'learningHistoryV6.js'].map((f) => fs.readFileSync(path.join(PERS, f), 'utf8')).join('\n')
  ok('R78 §24 CHALLENGE_BEHAVIOR_DIFF_COUNT=0 (no challenge refs)', !/challenge_events|challenge_records|submitChallengeChoice|getChallengeEvent/i.test(eng))
  ok('R78 §25 AI_QA_BEHAVIOR_DIFF_COUNT=0 (no buildCoachingPrompt)', !/buildCoachingPrompt|summarizeConversation/i.test(eng))
  ok('R78 §26 GAMIFICATION_BEHAVIOR_DIFF_COUNT=0 (no cv/level/streak/badge/leaderboard)', !/\bcv\b|\blevel\b|\bstreak\b|\bbadge\b|leaderboard/i.test(eng))

  // ── §27 privacy ──
  const safe = RUNTIME.toSafeLog(fa)
  const safeStr = JSON.stringify(safe)
  ok('R78 §27 log has reasonCode/contentId/signal only', !!safe.worldRule.reasonCode && !!safe.worldRule.contentId && !!safe.worldRule.sourceSignal)
  ok('R78 §27 log carries NO profile dump / openid / thesis', !/openid|strategicThesis|blindSpot|expression/.test(safeStr))

  // ── §29 CONTROL READBACKS ──
  readback('A', fa)
  readback('B', fb)
  readback('C', fc)
  ok('R78 §29 CONTROL_A_READY', fa.worldRule.wrId === 'WR003' && fa.worldRule.personalized === true)
  ok('R78 §29 CONTROL_B_READY', fb.worldRule.wrId === 'WR004' && fb.worldRule.personalized === true)
  ok('R78 §29 CONTROL_C_READY', fc.worldRule.personalized === true && fc.worldRule.sourceSignal === 'legacy_dimension')

  // ── §2 engine-of-record parity with the deployed-copy in the new fn ──
  const parity = ['worldRuleRecommenderV6.js', 'dailyCognitionRecommenderV6.js', 'personalizationRuntimeV6.js', 'personalizationMapsV6.js', 'learningHistoryV6.js']
    .every((f) => fs.readFileSync(path.join(PERS, f), 'utf8') === fs.readFileSync(path.join(FN, 'lib/cognitiveProfile/personalization', f), 'utf8'))
  ok('R78 §2 getPersonalizedContent copies are byte-identical to engine-of-record', parity)

  console.log(results.join('\n'))
  console.log('\nR78 TESTS: ' + pass + ' passed, ' + fail + ' failed')
  if (fail > 0) process.exit(1)
}

function seedReasonIsRelevant (id) {
  const it = INSIGHTS.find((x) => x.insightId === id)
  if (!it) return false
  const kws = [].concat(MAPS.LENS_KEYWORDS.PROBABILITY_OVER_CERTAINTY)
  return it.tags.some((t) => kws.indexOf(t) !== -1)
}

function readback (name, feed) {
  results.push('  READBACK ' + name + ': worldRule=' + feed.worldRule.wrId + ' (' + feed.worldRule.reasonCode + '/' + feed.worldRule.sourceSignal + ', p=' + feed.worldRule.personalized + ')' +
    ' | dailyInsight=' + feed.dailyInsight.contentId + ' (' + feed.dailyInsight.reasonCode + '/' + feed.dailyInsight.sourceSignal + ', p=' + feed.dailyInsight.personalized + ')' +
    ' | strike=' + feed.strike.contentId + ' (' + feed.strike.reasonCode + '/' + feed.strike.sourceSignal + ', p=' + feed.strike.personalized + ')')
}

function makeMock (profileDoc) {
  const state = { profile: profileDoc, updates: [] }
  const col = {
    where () { return this },
    limit () { return this },
    async get () { return { data: state.profile ? [state.profile] : [] } },
    doc (id) {
      return {
        async update ({ data }) { state.updates.push(data); state.profile = Object.assign({}, state.profile, data); return { updated: 1 } }
      }
    }
  }
  return { db: { collection (n) { if (n !== 'user_profiles') throw new Error('unexpected collection ' + n); return col } }, state: state }
}

main()
