'use strict'
/**
 * tests/v6/thesis/rc8.4-v6-r81-content-expansion.test.js
 *
 * RC8.4 V6 R81 — PERSONALIZATION CONTENT EXPANSION V1.
 *
 * Validates ONLY the content + mapping additions (§3–§13) and their effect on the
 * FROZEN recommendation engine (§14–§24). No algorithm change is asserted.
 *
 * Covers §25:
 *   WR016–WR024 schema validity · new daily-insight schema validity
 *   new crosswalk mappings · PROBLEM_MONETIZE / COMPOUNDING / REPEATABILITY reachability
 *   7-day no-premature-exhaustion · legacy fallback · empty fallback
 *   no false personalized label · no scoring change · no strike change
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
const NEW_WR = DEFAULT_WORLD_RULES.filter((r) => ['WR016', 'WR017', 'WR018', 'WR019', 'WR020', 'WR021', 'WR022', 'WR023', 'WR024'].indexOf(r.ruleId) !== -1)
const NEW_DI = DEFAULT_INSIGHTS.filter((r) => ['DI016', 'DI017', 'DI018', 'DI019', 'DI020', 'DI021'].indexOf(r.insightId) !== -1)

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

function main () {
  // ── §3/§25 WR016–WR024 PRESENT + SCHEMA VALID ──
  ok('R81 §3 newly added WR016–WR024 all present (9)', NEW_WR.length === 9 && NEW_WR[0].ruleId === 'WR016' && NEW_WR[8].ruleId === 'WR024')
  ok('R81 §3 existing WR001–WR015 not renumbered', DEFAULT_WORLD_RULES.slice(0, 15).every((r, i) => r.ruleId === 'WR' + String(i + 1).padStart(3, '0')))
  const REQ = ['ruleId', 'title', 'rule', 'reverseLogic', 'example', 'action', 'category', 'tags', 'unlockLevel', 'status', 'createdAt', 'updatedAt']
  ok('R81 §4 every new WR has the full production schema', NEW_WR.every((r) => REQ.every((k) => r[k] !== undefined && r[k] !== '')))
  ok('R81 §4 new WR categories are enum-valid', NEW_WR.every((r) => ['wealth', 'mindset', 'market', 'pricing', 'longterm', 'system'].indexOf(r.category) !== -1))
  ok('R81 §4 new WR tags are non-empty arrays of strings', NEW_WR.every((r) => Array.isArray(r.tags) && r.tags.length > 0 && r.tags.every((t) => typeof t === 'string')))
  // §4 content standard: mechanism (rule) + example + action present, and not a bare slogan.
  ok('R81 §4 each new WR states a causal mechanism (rule length >= 30)', NEW_WR.every((r) => r.rule.length >= 30))
  ok('R81 §4 each new WR has a concrete example (>= 30 chars)', NEW_WR.every((r) => r.example.length >= 30))
  const BANNED = /保证|确保|必定|稳赚不赔|包你|保你|一定会赚|肯定能赚|一定会成功/
  ok('R81 §4 no guaranteed-outcome wording in new WR', NEW_WR.every((r) => !BANNED.test(r.title + r.rule + r.example + r.action)))
  const BARE_SLOGAN = /^(认知决定财富|选择大于努力|坚持就是胜利)。?$/
  ok('R81 §4 new WR titles are not bare slogans', NEW_WR.every((r) => !BARE_SLOGAN.test(r.title)))

  // ── §5 market-validation allocation (3) ──
  ok('R81 §5 three market/pricing rules present', ['WR016', 'WR017', 'WR018'].every((id) => NEW_WR.some((r) => r.ruleId === id)))
  ok('R81 §5 market rules are distinct lessons (no identical rule text)', new Set(['WR016', 'WR017', 'WR018'].map((id) => NEW_WR.find((r) => r.ruleId === id).rule)).size === 3)
  // ── §6 compounding allocation (3) ──
  ok('R81 §6 three compounding/long-term rules present', ['WR019', 'WR020', 'WR021'].every((id) => NEW_WR.some((r) => r.ruleId === id)))
  ok('R81 §6 WR021 encodes feedback-correction (not blind persistence)', /反馈/.test(NEW_WR.find((r) => r.ruleId === 'WR021').rule))
  // ── §7 repeatability allocation (3) ──
  ok('R81 §7 three repeatability/productization rules present', ['WR022', 'WR023', 'WR024'].every((id) => NEW_WR.some((r) => r.ruleId === id)))
  ok('R81 §7 WR023 encodes the four-clear productization interface', /买家/.test(NEW_WR.find((r) => r.ruleId === 'WR023').rule) && /交付/.test(NEW_WR.find((r) => r.ruleId === 'WR023').rule))

  // ── §10/§11 DAILY INSIGHT additions + schema ──
  ok('R81 §10 six new daily insights present (DI016–DI021)', NEW_DI.length === 6 && NEW_DI[0].insightId === 'DI016' && NEW_DI[5].insightId === 'DI021')
  const DIREQ = ['insightId', 'title', 'content', 'reverseReasoning', 'caseText', 'action', 'tags', 'difficulty', 'sort', 'status']
  ok('R81 §10 every new DI has the full production schema', NEW_DI.every((r) => DIREQ.every((k) => r[k] !== undefined && r[k] !== '')))
  ok('R81 §10 new DI difficulty is enum 1/2', NEW_DI.every((r) => r.difficulty === 1 || r.difficulty === 2))
  ok('R81 §10 new DI sort continues 16..21', NEW_DI.map((r) => r.sort).join(',') === '16,17,18,19,20,21')
  // §11 role distinction: DI wording must NOT be identical to its WR wording.
  const wrAll = DEFAULT_WORLD_RULES.map((r) => r.title + r.rule).join(' ')
  ok('R81 §11 new DI is interpretation, not a copy of a WR statement', NEW_DI.every((r) => !wrAll.includes(r.content)))
  const DIBAN = /保证|确保|必定|稳赚不赔|包你|保你/
  ok('R81 §10 no guaranteed-outcome wording in new DI', NEW_DI.every((r) => !DIBAN.test(r.title + r.content + r.caseText + r.action)))

  // ── §12 STRIKE POOL FROZEN ──
  ok('R81 §12 strike pool unchanged at 50', STRIKE_POOL.length === 50)
  const strikeSrc = fs.readFileSync(path.join(ROOT, 'utils/cognitionStrike.js'), 'utf8')
  ok('R81 §12 STRIKE_CONTENT_DIFF_COUNT=0 (no R81 marker in strike file)', !/R81/.test(strikeSrc))

  // ── §8 CROSSWALK REPAIR ──
  const counts = CROSS.crosswalkCounts()
  ok('R81 §8 CROSSWALK_NONE_BEFORE=3 → AFTER=0', counts.NONE === 0 && counts.DIRECT === 6 && counts.PARTIAL === 3 && counts.TOTAL === 9)
  const mp = CROSS.getCrosswalkForLens('MARKET_PROOF_OVER_SELF_ASSESSMENT')
  const cr = CROSS.getCrosswalkForLens('COMPOUNDING_OVER_RESTARTING')
  const rp = CROSS.getCrosswalkForLens('REPEATABILITY_OVER_OCCASIONAL_SUCCESS')
  ok('R81 §8 MARKET_PROOF_OVER_SELF_ASSESSMENT → DIRECT WR016', mp.status === 'DIRECT' && mp.wrId === 'WR016')
  ok('R81 §8 COMPOUNDING_OVER_RESTARTING → DIRECT WR019', cr.status === 'DIRECT' && cr.wrId === 'WR019')
  ok('R81 §8 REPEATABILITY_OVER_OCCASIONAL_SUCCESS → DIRECT WR022', rp.status === 'DIRECT' && rp.wrId === 'WR022')
  ok('R81 §8 repair points at the NEW content ids only', [mp.wrId, cr.wrId, rp.wrId].every((id) => ['WR016', 'WR019', 'WR022'].indexOf(id) !== -1))
  // no previously-valid mapping was disturbed
  ok('R81 §8 existing DIRECT/PARTIAL rows preserved', CROSS.getCrosswalkForLens('PROBABILITY_OVER_CERTAINTY').wrId === 'WR004' && CROSS.getCrosswalkForLens('SYSTEM_OVER_MOTIVATION').status === 'PARTIAL' && CROSS.getCrosswalkForLens('LEVERAGE_OVER_TIME_FOR_MONEY').wrId === 'WR010')

  // ── §9 REACHABILITY ──
  const reach = MAPS.reachableWorldRuleIds()
  ok('R81 §9 WR id space is 24', MAPS.WORLD_RULE_IDS.length === 24)
  ok('R81 §9 all 9 new WR are reachable from existing signals', ['WR016', 'WR017', 'WR018', 'WR019', 'WR020', 'WR021', 'WR022', 'WR023', 'WR024'].every((id) => reach.indexOf(id) !== -1))
  ok('R81 §9 no parallel taxonomy invented (reuses existing signal keys)', MAPS.PROBLEM_IDS.every((k) => /^PROBLEM_/.test(k)))

  // ── §14 OWNER PROBLEM_MONETIZE reachability + 7-day no-premature-exhaustion ──
  const OWNER = canon({ topicIds: ['PROBLEM_MONETIZE'], blindSpot: '你一直在用免费帮人做来验证能力，从未用一个明确的价格去验证市场，缺少定价的勇气和市场付费的证明' })
  const monetizeWrs = MAPS.TOPIC_WR_MAP.PROBLEM_MONETIZE.map((r) => r.wr)
  ok('R81 §14 PROBLEM_MONETIZE reaches the market/pricing rules', ['WR016', 'WR017', 'WR018'].every((id) => monetizeWrs.indexOf(id) !== -1))
  const ownerDays = []
  {
    let seen = []
    for (let day = 1; day <= 7; day++) {
      const p = Object.assign({}, OWNER, { learningHistory: { seenRuleIds: seen.slice(), seenInsightIds: [], seenStrikeIds: [] } })
      const f = RUNTIME.buildPersonalizationFeed({ profile: p, worldRules: WR_ROWS, insights: IN_ROWS, strikes: STRIKES, dayIndex: DAY + (day - 1) })
      ownerDays.push({ day, wr: f.worldRule, di: f.dailyInsight })
      if (f.worldRule.wrId) seen.push(f.worldRule.wrId)
    }
  }
  ok('R81 §14 OWNER_WR_FIRST_EXHAUSTION_DAY > 7 (no exhaust within 7d)', firstExhaust(ownerDays, 'wr') === null, 'got ' + firstExhaust(ownerDays, 'wr'))
  ok('R81 §14 OWNER day sequence teaches market→pricing→paid-proof→productization', ['WR016', 'WR017', 'WR018'].every((id) => ownerDays.map((d) => d.wr.wrId).indexOf(id) !== -1) && ownerDays.map((d) => d.wr.wrId).indexOf('WR023') !== -1)
  ok('R81 §14 owner market-validation is DEPENED not merely broadened (>=3 monetization-specific ids served)', ['WR016', 'WR017', 'WR018', 'WR023'].filter((id) => ownerDays.map((d) => d.wr.wrId).indexOf(id) !== -1).length >= 3)

  // ── §15 COMPOUNDING reachability + no premature exhaustion ──
  const COMP = canon({ lensIds: ['COMPOUNDING_OVER_RESTARTING'], bottleneck: 'CONSISTENCY_GAP', blindSpot: '你频繁重启，无法积累复利，缺少长期主义和延迟满足' })
  const compDays = []
  {
    let seen = []
    for (let day = 1; day <= 7; day++) {
      const p = Object.assign({}, COMP, { learningHistory: { seenRuleIds: seen.slice(), seenInsightIds: [], seenStrikeIds: [] } })
      const f = RUNTIME.buildPersonalizationFeed({ profile: p, worldRules: WR_ROWS, insights: IN_ROWS, strikes: STRIKES, dayIndex: DAY + (day - 1) })
      compDays.push({ day, wr: f.worldRule, di: f.dailyInsight })
      if (f.worldRule.wrId) seen.push(f.worldRule.wrId)
    }
  }
  ok('R81 §15 COMPOUNDING lens now drives WR019 (was NONE→fallback)', compDays[0].wr.wrId === 'WR019' && compDays[0].wr.reasonCode === 'LENS_DIRECT')
  ok('R81 §15 COMPOUNDING_WR_FIRST_EXHAUSTION_DAY > 3 (improved, R80 was 3)', firstExhaust(compDays, 'wr') === null || firstExhaust(compDays, 'wr') > 3, 'got ' + firstExhaust(compDays, 'wr'))
  ok('R81 §15 compounding sequence covers continuity/feedback/long-term', ['WR019', 'WR020', 'WR021'].filter((id) => compDays.map((d) => d.wr.wrId).indexOf(id) !== -1).length >= 2)

  // ── §16 REPEATABILITY control ──
  const REP = canon({ lensIds: ['REPEATABILITY_OVER_OCCASIONAL_SUCCESS'], bottleneck: 'REPEATABILITY_GAP', blindSpot: '你偶尔能做成一次，但流程不可重复，每次都要重新摸索，缺少产品化和系统' })
  const repDays = []
  {
    let seen = []
    for (let day = 1; day <= 7; day++) {
      const p = Object.assign({}, REP, { learningHistory: { seenRuleIds: seen.slice(), seenInsightIds: [], seenStrikeIds: [] } })
      const f = RUNTIME.buildPersonalizationFeed({ profile: p, worldRules: WR_ROWS, insights: IN_ROWS, strikes: STRIKES, dayIndex: DAY + (day - 1) })
      repDays.push({ day, wr: f.worldRule, di: f.dailyInsight })
      if (f.worldRule.wrId) seen.push(f.worldRule.wrId)
    }
  }
  const repSeq = repDays.map((d) => d.wr.wrId)
  ok('R81 §16 REPEATABILITY lens drives WR022 (proof≠business)', repSeq[0] === 'WR022' && repDays[0].wr.reasonCode === 'LENS_DIRECT')
  ok('R81 §16 repeatability teaches proof → productization → system', ['WR022', 'WR023'].every((id) => repSeq.indexOf(id) !== -1) && repSeq.indexOf('WR008') !== -1)

  // ── §23 NO FALSE PERSONALIZED LABEL ──
  ok('R81 §23 empty profile → no label anywhere', (function () {
    const f = feedFor(canon({ present: false }))
    return f.label === null && f.dailyInsight.label === null && f.strike.label === null && f.personalized === false
  })())
  ok('R81 §23 new content only labeled when truly profile-driven', (function () {
    const f = feedFor(OWNER)
    return f.personalized === true && f.label === '根据你最近的认知诊断推荐'
  })())
  ok('R81 §23 FALSE_PERSONALIZED_LABEL_COUNT=0 (fallback surfaces carry no label)', (function () {
    const f = feedFor(canon({ present: false }))
    return [f.worldRule, f.dailyInsight, f.strike].every((s) => s.personalized === false)
  })())

  // ── §24 LEGACY / EMPTY SAFETY ──
  const LEG = canon({ isLegacy: true, dimensions: { probabilityMindset: 20, systemThinking: 30, leverageThinking: 25, informationSensitivity: 22, laborMindset: 70 } })
  ok('R81 §24 LEGACY_BEHAVIOR_PASS (legacy still personalizes via dimension, no crash)', (function () {
    const f = feedFor(LEG)
    return f.worldRule.sourceSignal === 'legacy_dimension' && typeof f.worldRule.wrId === 'string'
  })())
  ok('R81 §24 EMPTY_PROFILE_BEHAVIOR_PASS (date fallback over 24-rule library)', (function () {
    const f = feedFor(canon({ present: false }))
    return f.worldRule.reasonCode === 'FALLBACK_DATE' && f.worldRule.wrId === MAPS.WORLD_RULE_IDS[DAY % MAPS.WORLD_RULE_IDS.length]
  })())

  // ── §2 NO ALGORITHM CHANGE ──
  ok('R81 §2 SCORE tiers unchanged', JSON.stringify(MAPS.SCORE) === JSON.stringify({ LENS_DIRECT: 100, LENS_PARTIAL: 50, TOPIC_DIRECT: 40, TOPIC_PARTIAL: 20, BLINDSPOT_DIRECT: 30, BLINDSPOT_PARTIAL: 15, BOTTLENECK: 25, LEGACY_DIMENSION: 10 }))
  const recSrc = fs.readFileSync(path.join(PERS, 'worldRuleRecommenderV6.js'), 'utf8')
  ok('R81 §2 worldRuleRecommender has no R81 content edit', !/R81/.test(recSrc))
  const dailySrc = fs.readFileSync(path.join(PERS, 'dailyCognitionRecommenderV6.js'), 'utf8')
  ok('R81 §2 dailyCognitionRecommender has no R81 content edit', !/R81/.test(dailySrc))
  ok('R81 §2 runtime has no R81 content edit', !/R81/.test(fs.readFileSync(path.join(PERS, 'personalizationRuntimeV6.js'), 'utf8')))
  ok('R81 §2 learningHistory unchanged', !/R81/.test(fs.readFileSync(path.join(PERS, 'learningHistoryV6.js'), 'utf8')))
  ok('R81 §2 no LLM / network introduced', !/openai|callAI|fetch\(|http/i.test(recSrc + dailySrc))

  // ── §13 OVER-BROAD items kept (not deleted/rewritten) ──
  ok('R81 §13 previously-flagged items preserved (WR002/WR011/WR014/WR015/DI012/DI015)', ['WR002', 'WR011', 'WR014', 'WR015'].every((id) => MAPS.WORLD_RULE_INDEX[id]) && DEFAULT_INSIGHTS.some((d) => d.insightId === 'DI012') && DEFAULT_INSIGHTS.some((d) => d.insightId === 'DI015'))

  // ── §17 DUPLICATION ──
  const wrTexts = DEFAULT_WORLD_RULES.map((r) => r.rule + '|' + r.title)
  const diTexts = DEFAULT_INSIGHTS.map((r) => r.content + '|' + r.title)
  ok('R81 §17 NEW_EXACT_DUPLICATE_COUNT=0 (WR)', wrTexts.length === new Set(wrTexts).size)
  ok('R81 §17 NEW_EXACT_DUPLICATE_COUNT=0 (DI)', diTexts.length === new Set(diTexts).size)

  // ── engine-of-record vs deployed-copy parity ──
  const parity = ['worldRuleRecommenderV6.js', 'dailyCognitionRecommenderV6.js', 'personalizationRuntimeV6.js', 'personalizationMapsV6.js', 'learningHistoryV6.js']
    .every((f) => fs.readFileSync(path.join(PERS, f), 'utf8') === fs.readFileSync(path.join(ROOT, 'cloudfunctions/generateAiReport/lib/cognitiveProfile/personalization', f), 'utf8'))
  ok('R81 §2 getPersonalizedContent copies byte-identical to engine-of-record', parity)
  ok('R81 §2 crosswalk copies byte-identical', fs.readFileSync(path.join(CP, 'worldRuleCrosswalkV6.js'), 'utf8') === fs.readFileSync(path.join(ROOT, 'cloudfunctions/generateAiReport/lib/cognitiveProfile/worldRuleCrosswalkV6.js'), 'utf8'))

  console.log(results.join('\n'))
  console.log('\nR81 TESTS: ' + pass + ' passed, ' + fail + ' failed')
  if (fail > 0) process.exit(1)
}

main()
