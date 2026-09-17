'use strict'
/**
 * lib/cognitiveProfile/personalization/personalizationMapsV6.js
 *
 * RC8.4 V6 R78 — DETERMINISTIC PERSONALIZATION MAPPING LAYER.
 *
 * §4 NO NEW TAXONOMY. This module INVENTS NOTHING. It reuses, verbatim:
 *   - R77 worldRuleCrosswalkV6 lens→WR crosswalk (DIRECT/PARTIAL/NONE)
 *   - the existing V6 lens library (worldRuleLibraryV6)
 *   - the existing seed world-rule ids WR001–WR015 + their tags/categories
 *   - the existing questionnaire topic ids (PROBLEM_*)
 *   - the existing cognitive dimension keys (legacy 9-dim)
 *   - the existing daily-insight tags + cognition-strike dimensions
 *
 * It ONLY adds deterministic lookup tables that connect a profile SIGNAL to an
 * EXISTING content id. Every table entry is a reviewed judgement carrying a
 * DIRECT / PARTIAL / NONE status — never a forced semantic match (§23).
 *
 * PURE. No I/O. No AI. No time. No randomness.
 */

const { CROSSWALK_STATUS, getCrosswalkForLens } = require('../worldRuleCrosswalkV6.js')
const { CANDIDATES_BY_BOTTLENECK } = require('../../turnaroundStrategy/v6/report/worldRuleLibraryV6.js')

// ── §13/§27 machine reason codes + source signals (server-side only) ──
const REASON_CODE = Object.freeze({
  LENS_DIRECT: 'LENS_DIRECT',
  LENS_PARTIAL: 'LENS_PARTIAL',
  TOPIC_MATCH: 'TOPIC_MATCH',
  BLINDSPOT_MATCH: 'BLINDSPOT_MATCH',
  BOTTLENECK_MATCH: 'BOTTLENECK_MATCH',
  LEGACY_DIMENSION_MATCH: 'LEGACY_DIMENSION_MATCH',
  SEEN_AVOIDED: 'SEEN_AVOIDED',
  SEEN_EXHAUSTED_REUSE: 'SEEN_EXHAUSTED_REUSE',
  FALLBACK_UNMAPPED: 'FALLBACK_UNMAPPED',
  FALLBACK_DATE: 'FALLBACK_DATE'
})

const SOURCE_SIGNAL = Object.freeze({
  LENS: 'lens',
  TOPIC: 'topic',
  BLINDSPOT: 'blindspot',
  BOTTLENECK: 'bottleneck',
  LEGACY_DIMENSION: 'legacy_dimension',
  DATE: 'date',
  NONE: 'none'
})

// ── §6 deterministic score tiers (integer, no LLM ranking) ──
const SCORE = Object.freeze({
  LENS_DIRECT: 100,
  LENS_PARTIAL: 50,
  TOPIC_DIRECT: 40,
  TOPIC_PARTIAL: 20,
  BLINDSPOT_DIRECT: 30,
  BLINDSPOT_PARTIAL: 15,
  BOTTLENECK: 25,
  LEGACY_DIMENSION: 10
})

// ── §22 the existing seed world-rule index (WR001–WR015) — audited as-is ──
// Duplicated here ONLY because the seed lives in another function's directory
// and cannot be required at runtime. It is a faithful copy of
// cloudfunctions/initDatabase/data/world_rules.js (ruleId/category/tags).
const WORLD_RULE_INDEX = Object.freeze({
  WR001: { category: 'wealth', tags: ['稀缺性', '系统思维', '杠杆'] },
  WR002: { category: 'wealth', tags: ['认知映射', '赛道选择', '信息差'] },
  WR003: { category: 'wealth', tags: ['痛点思维', '创业思维', '机会识别'] },
  WR004: { category: 'wealth', tags: ['概率思维', '期望值', '风险认知'] },
  WR005: { category: 'wealth', tags: ['通胀', '机会成本', '认知税'] },
  WR006: { category: 'wealth', tags: ['收入结构', '抗风险', '系统思维'] },
  WR007: { category: 'wealth', tags: ['信息差', '先发优势', '认知差'] },
  WR008: { category: 'wealth', tags: ['系统位置', '杠杆', '不可替代性'] },
  WR009: { category: 'wealth', tags: ['负债管理', '杠杆思维', '资产意识'] },
  WR010: { category: 'wealth', tags: ['可迁移能力', '资产组合', '抗风险'] },
  WR011: { category: 'mindset', tags: ['思维层级', '元认知', '认知觉醒'] },
  WR012: { category: 'mindset', tags: ['时间管理', '产出效率', '长期主义'] },
  WR013: { category: 'mindset', tags: ['范式转移', '周期思维', '战略性机会'] },
  WR014: { category: 'mindset', tags: ['配得分数', '净值认知', '长期主义'] },
  WR015: { category: 'mindset', tags: ['认知升级', '终身学习', '思维进化'] }
})

const WORLD_RULE_IDS = Object.freeze(Object.keys(WORLD_RULE_INDEX))

// ── §3.2 priorityTopicIds (PROBLEM_*) → WR. Reviewed; status DIRECT/PARTIAL. ──
const TOPIC_WR_MAP = Object.freeze({
  PROBLEM_INCOME_STUCK: [
    { wr: 'WR001', status: 'DIRECT', note: '收入上不去 = 稀缺性/杠杆问题' },
    { wr: 'WR006', status: 'PARTIAL', note: '收入结构' }
  ],
  PROBLEM_NO_FUTURE: [
    { wr: 'WR013', status: 'PARTIAL', note: '战略性机会/范式转移' },
    { wr: 'WR015', status: 'PARTIAL', note: '认知升级' }
  ],
  PROBLEM_DEBT: [
    { wr: 'WR009', status: 'DIRECT', note: '负债管理/资产意识' },
    { wr: 'WR005', status: 'PARTIAL', note: '机会成本/认知税' }
  ],
  PROBLEM_CAREER_SWITCH: [
    { wr: 'WR010', status: 'DIRECT', note: '可迁移能力' },
    { wr: 'WR002', status: 'PARTIAL', note: '赛道选择' }
  ],
  PROBLEM_SIDE_UNSTARTED: [
    { wr: 'WR013', status: 'PARTIAL', note: '战略性机会' },
    { wr: 'WR003', status: 'PARTIAL', note: '机会识别' }
  ],
  PROBLEM_MONETIZE: [
    { wr: 'WR003', status: 'DIRECT', note: '变现 = 找到别人愿意付钱的机会（痛点即商机）' },
    { wr: 'WR002', status: 'PARTIAL', note: '认知映射/赛道' }
  ],
  PROBLEM_FOCUS: [
    { wr: 'WR012', status: 'DIRECT', note: '时间管理/产出效率' },
    { wr: 'WR011', status: 'PARTIAL', note: '思维层级/元认知' }
  ],
  PROBLEM_OTHER: []
})

const PROBLEM_IDS = Object.freeze(Object.keys(TOPIC_WR_MAP))

// ── §3.3 blind-spot EXPRESSION keyword → WR. Deterministic substring match.
// Small + reviewed (no forced match); a miss yields NONE (no score). ──
const BLINDSPOT_KEYWORD_MAP = Object.freeze([
  { kw: '概率', wr: 'WR004', status: 'DIRECT' },
  { kw: '期望值', wr: 'WR004', status: 'DIRECT' },
  { kw: '稀缺', wr: 'WR001', status: 'DIRECT' },
  { kw: '可替代', wr: 'WR008', status: 'DIRECT' },
  { kw: '系统位置', wr: 'WR008', status: 'DIRECT' },
  { kw: '信息', wr: 'WR007', status: 'DIRECT' },
  { kw: '信息差', wr: 'WR007', status: 'DIRECT' },
  { kw: '负债', wr: 'WR009', status: 'DIRECT' },
  { kw: '可迁移', wr: 'WR010', status: 'DIRECT' },
  { kw: '杠杆', wr: 'WR010', status: 'DIRECT' },
  { kw: '复利', wr: 'WR010', status: 'PARTIAL' },
  { kw: '积累', wr: 'WR010', status: 'PARTIAL' },
  { kw: '时间', wr: 'WR012', status: 'PARTIAL' },
  { kw: '拖延', wr: 'WR013', status: 'PARTIAL' },
  { kw: '准备', wr: 'WR013', status: 'PARTIAL' },
  { kw: '机会', wr: 'WR013', status: 'PARTIAL' },
  { kw: '认知升级', wr: 'WR015', status: 'PARTIAL' },
  { kw: '思维', wr: 'WR011', status: 'PARTIAL' },
  { kw: '变现', wr: 'WR003', status: 'DIRECT' },
  { kw: '付费', wr: 'WR003', status: 'DIRECT' },
  { kw: '买家', wr: 'WR003', status: 'DIRECT' },
  { kw: '收入结构', wr: 'WR006', status: 'DIRECT' }
])

// ── §3.5 legacy 9-dimension → WR (developmental GAP mapping). Only used for a
// legacy profile (no v1 sections) and only when a dimension is a clear gap. ──
const LEGACY_DIM_GAP_MAP = Object.freeze({
  laborMindset: { band: 'high', wr: 'WR001', status: 'PARTIAL', note: '高劳动导向 → 稀缺性/杠杆' },
  probabilityMindset: { band: 'low', wr: 'WR004', status: 'DIRECT', note: '概率认知缺口' },
  systemThinking: { band: 'low', wr: 'WR008', status: 'DIRECT', note: '系统思维缺口' },
  leverageThinking: { band: 'low', wr: 'WR010', status: 'DIRECT', note: '杠杆认知缺口' },
  capitalThinking: { band: 'low', wr: 'WR009', status: 'PARTIAL', note: '资本/资产意识缺口' },
  riskAwareness: { band: 'low', wr: 'WR004', status: 'PARTIAL', note: '风险认知缺口' },
  informationSensitivity: { band: 'low', wr: 'WR007', status: 'DIRECT', note: '信息敏感度缺口' },
  longTermism: { band: 'low', wr: 'WR013', status: 'PARTIAL', note: '长期主义缺口' },
  decisionStability: { band: 'low', wr: 'WR012', status: 'PARTIAL', note: '决策稳定/时间管理缺口' }
})
const LEGACY_BANDS = Object.freeze({ low: 45, high: 55 })

// ── §11 signal keyword lists used to match EXISTING daily-insight tags ──
const LENS_KEYWORDS = Object.freeze({
  EXTERNAL_EVIDENCE_OVER_INTERNAL_CERTAINTY: ['信息差', '认知差', '先发优势'],
  COMPOUNDING_OVER_RESTARTING: ['复利思维', '长期主义', '延迟满足'],
  PROBABILITY_OVER_CERTAINTY: ['概率思维', '风险认知', '决策质量'],
  SCARCITY_VALUE_OVER_RAW_EFFORT: ['努力陷阱', '杠杆思维', '系统思维'],
  SYSTEM_OVER_MOTIVATION: ['系统思维', '杠杆思维', '认知觉醒'],
  MARKET_PROOF_OVER_SELF_ASSESSMENT: ['执行差', '认知差', '财富认知'],
  LOW_COST_EXPERIMENT_OVER_PERFECT_DIRECTION: ['沉没成本', '决策质量', '认知税'],
  REPEATABILITY_OVER_OCCASIONAL_SUCCESS: ['复利思维', '系统思维', '认知觉醒'],
  LEVERAGE_OVER_TIME_FOR_MONEY: ['杠杆思维', '资产组合', '产出效率']
})

const TOPIC_KEYWORDS = Object.freeze({
  PROBLEM_INCOME_STUCK: ['努力陷阱', '杠杆思维', '财富认知'],
  PROBLEM_NO_FUTURE: ['长期主义', '认知觉醒', '战略性机会'],
  PROBLEM_DEBT: ['风险认知', '认知税', '仓位管理'],
  PROBLEM_CAREER_SWITCH: ['可迁移能力', '信息差', '认知差'],
  PROBLEM_SIDE_UNSTARTED: ['机会识别', '沉没成本', '执行差'],
  PROBLEM_MONETIZE: ['财富认知', '认知差', '执行差'],
  PROBLEM_FOCUS: ['决策质量', '长期主义', '认知觉醒'],
  PROBLEM_OTHER: []
})

// ── §11 profile signal → cognition-strike DIMENSION (existing 5 dims) ──
const LENS_DIMENSION = Object.freeze({
  EXTERNAL_EVIDENCE_OVER_INTERNAL_CERTAINTY: 'Cognition',
  COMPOUNDING_OVER_RESTARTING: 'Wealth',
  PROBABILITY_OVER_CERTAINTY: 'Risk',
  SCARCITY_VALUE_OVER_RAW_EFFORT: 'Wealth',
  SYSTEM_OVER_MOTIVATION: 'Cognition',
  MARKET_PROOF_OVER_SELF_ASSESSMENT: 'Wealth',
  LOW_COST_EXPERIMENT_OVER_PERFECT_DIRECTION: 'Risk',
  REPEATABILITY_OVER_OCCASIONAL_SUCCESS: 'Wealth',
  LEVERAGE_OVER_TIME_FOR_MONEY: 'Wealth'
})
const TOPIC_DIMENSION = Object.freeze({
  PROBLEM_INCOME_STUCK: 'Wealth',
  PROBLEM_NO_FUTURE: 'Desire',
  PROBLEM_DEBT: 'Risk',
  PROBLEM_CAREER_SWITCH: 'Cognition',
  PROBLEM_SIDE_UNSTARTED: 'Wealth',
  PROBLEM_MONETIZE: 'Wealth',
  PROBLEM_FOCUS: 'Energy',
  PROBLEM_OTHER: null
})

/**
 * §6 bottleneck → WR, via the EXISTING lens candidate table + the R77 crosswalk.
 * Returns [{wr, status}] (deduped). NONE crosswalk rows are skipped (no force).
 */
function bottleneckToWorldRules (bottleneck) {
  const cands = CANDIDATES_BY_BOTTLENECK[bottleneck] || []
  const out = []
  const seen = {}
  for (const lensId of cands) {
    const cw = getCrosswalkForLens(lensId)
    if (!cw || !cw.wrId) continue
    if (seen[cw.wrId]) continue
    seen[cw.wrId] = true
    out.push({ wr: cw.wrId, status: cw.status === CROSSWALK_STATUS.DIRECT ? 'DIRECT' : 'PARTIAL' })
  }
  return out
}

/** §22 a WR is reachable iff some deterministic signal path maps to it. */
function reachableWorldRuleIds () {
  const set = new Set()
  for (const lensId of Object.keys(LENS_KEYWORDS)) {
    const cw = getCrosswalkForLens(lensId)
    if (cw && cw.wrId) set.add(cw.wrId)
  }
  for (const t of Object.keys(TOPIC_WR_MAP)) for (const e of TOPIC_WR_MAP[t]) set.add(e.wr)
  for (const e of BLINDSPOT_KEYWORD_MAP) set.add(e.wr)
  for (const b of Object.keys(CANDIDATES_BY_BOTTLENECK)) for (const e of bottleneckToWorldRules(b)) set.add(e.wr)
  for (const k of Object.keys(LEGACY_DIM_GAP_MAP)) set.add(LEGACY_DIM_GAP_MAP[k].wr)
  return Array.from(set).sort()
}

module.exports = {
  REASON_CODE,
  SOURCE_SIGNAL,
  SCORE,
  WORLD_RULE_INDEX,
  WORLD_RULE_IDS,
  TOPIC_WR_MAP,
  PROBLEM_IDS,
  BLINDSPOT_KEYWORD_MAP,
  LEGACY_DIM_GAP_MAP,
  LEGACY_BANDS,
  LENS_KEYWORDS,
  TOPIC_KEYWORDS,
  LENS_DIMENSION,
  TOPIC_DIMENSION,
  bottleneckToWorldRules,
  reachableWorldRuleIds
}
