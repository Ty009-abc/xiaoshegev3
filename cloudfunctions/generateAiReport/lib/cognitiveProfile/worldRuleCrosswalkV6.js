'use strict'
/**
 * lib/cognitiveProfile/worldRuleCrosswalkV6.js
 *
 * RC8.4 V6 R77 §14/§15 — WORLD RULE CROSSWALK FOUNDATION (READ-ONLY mapping).
 *
 * The two world-rule systems are NOT merged here:
 *   A) the seed content library  WR001–WR015  (data/world_rules.js)
 *   B) the V6 report LENS library (report/worldRuleLibraryV6.js) — 9 lenses
 *
 * This module is a pure, static, read-only mapping between a V6 lens id and a
 * seed WR id, each carrying a status:
 *   DIRECT   — the two statements assert the SAME mechanism
 *   PARTIAL  — related theme, but NOT the same claim (never forced)
 *   NONE     — no defensible counterpart in the other library
 *
 * It NEVER rewrites a rule, never invents a match, never runs at diagnosis time.
 * R78 will consume it. CONSUMER LAYER ONLY. No AI. No I/O.
 */

const { WORLD_RULE_LIBRARY } = require('../turnaroundStrategy/v6/report/worldRuleLibraryV6.js')

const CROSSWALK_STATUS = Object.freeze({
  DIRECT: 'DIRECT',
  PARTIAL: 'PARTIAL',
  NONE: 'NONE'
})

/**
 * The reviewed crosswalk. Keys = V6 lens ids; values = { wr, status, note }.
 * A `status: NONE` entry deliberately carries `wr: null` (no forced match).
 * Every mapping is a THEME judgement made against the frozen statement text;
 * none of them asserts diagnosis authority.
 */
const CROSSWALK = Object.freeze({
  EXTERNAL_EVIDENCE_OVER_INTERNAL_CERTAINTY: {
    wr: 'WR007', status: 'PARTIAL',
    note: 'WR007 = 信息即权力（外部信息决定上限）；lens = 确定性只能来自外部反馈。同属"外部现实优先"，但论断对象不同。'
  },
  COMPOUNDING_OVER_RESTARTING: {
    wr: null, status: 'NONE',
    note: '种子库无"积累/复利 vs 重启"对应条目。'
  },
  PROBABILITY_OVER_CERTAINTY: {
    wr: 'WR004', status: 'DIRECT',
    note: 'WR004 = 差距在对概率的理解；lens = 方向是概率问题，靠小试验逼近。同一机制。'
  },
  SCARCITY_VALUE_OVER_RAW_EFFORT: {
    wr: 'WR001', status: 'DIRECT',
    note: 'WR001 = 世界奖励稀缺，不奖励努力；lens = 越缺资源越靠选对动作而非多花力气。同一机制（稀缺>努力）。'
  },
  SYSTEM_OVER_MOTIVATION: {
    wr: 'WR008', status: 'PARTIAL',
    note: 'WR008 = 系统奖励让系统更高效的人；lens = 长期靠机制而非干劲。相关但命题层级不同。'
  },
  MARKET_PROOF_OVER_SELF_ASSESSMENT: {
    wr: null, status: 'NONE',
    note: '种子库无"市场付费 vs 自我评估"对应条目。'
  },
  LOW_COST_EXPERIMENT_OVER_PERFECT_DIRECTION: {
    wr: 'WR013', status: 'PARTIAL',
    note: 'WR013 = 财富跃迁机会有限，错过就少一次；lens = 先低成本试验而非等完美方向。共享"机会稀缺→尽早行动"，非同一论断。'
  },
  REPEATABILITY_OVER_OCCASIONAL_SUCCESS: {
    wr: null, status: 'NONE',
    note: '种子库无"可重复 vs 一次成功"对应条目。'
  },
  LEVERAGE_OVER_TIME_FOR_MONEY: {
    wr: 'WR010', status: 'DIRECT',
    note: 'WR010 = 最大资产是可迁移能力；lens = 同样时间，能被放大的做法才走得远（杠杆）。同属"可复用杠杆"，最贴近。'
  }
})

/** Read-only accessor for one lens id. Returns a copy, or null if unknown. */
function getCrosswalkForLens (lensId) {
  if (!lensId || typeof lensId !== 'string') return null
  const e = CROSSWALK[lensId]
  if (!e) return null
  return { lensId: lensId, wrId: e.wr, status: e.status, note: e.note }
}

/** Read-only full table (copies). */
function listCrosswalk () {
  return Object.keys(CROSSWALK).map(getCrosswalkForLens)
}

/** Count by status — a stable metric for tests + R78 planning. */
function crosswalkCounts () {
  const counts = { DIRECT: 0, PARTIAL: 0, NONE: 0, TOTAL: 0, UNKNOWN_LENS: 0 }
  for (const lensId of Object.keys(WORLD_RULE_LIBRARY)) {
    const e = CROSSWALK[lensId]
    counts.TOTAL++
    if (!e) { counts.UNKNOWN_LENS++; continue }
    counts[e.status]++
  }
  return counts
}

/** True iff every lens in the live library has a reviewed crosswalk row. */
function isComplete () {
  return Object.keys(WORLD_RULE_LIBRARY).every((id) => !!CROSSWALK[id])
}

module.exports = {
  CROSSWALK,
  CROSSWALK_STATUS,
  getCrosswalkForLens,
  listCrosswalk,
  crosswalkCounts,
  isComplete
}
