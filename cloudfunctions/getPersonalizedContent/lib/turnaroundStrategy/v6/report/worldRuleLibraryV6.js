'use strict'
/**
 * turnaroundStrategy/v6/report/worldRuleLibraryV6.js
 *
 * R33 §3/§4 — WORLD_RULE_LIBRARY + bottleneck -> candidate-lens mapping.
 *
 * These are LENSES, not diagnoses. This module has ZERO diagnosis authority:
 *   - it NEVER changes primaryBottleneck / executionStage / firstActionType
 *   - it only RE-WORDS the already-frozen B1 diagnosis into a world-mechanism
 *     statement the reader can recognise
 *   - AI cannot invent applicability: selection is deterministic and gated by
 *     evidence flags already computed by B1 (stage + realityConstraint).
 *
 * CONSUMER LAYER ONLY. No AI. No randomness. No time. No I/O.
 */

// ── §3 the controlled mechanism library ──────────────────────────
const WORLD_RULE_LIBRARY = {
  EXTERNAL_EVIDENCE_OVER_INTERNAL_CERTAINTY: {
    id: 'EXTERNAL_EVIDENCE_OVER_INTERNAL_CERTAINTY',
    statement: '确定性只能从外部反馈里拿到，不在你想得够不够清楚',
    testPrinciple: '把判断交给真实的人，而不是交给脑子里的推演'
  },
  COMPOUNDING_OVER_RESTARTING: {
    id: 'COMPOUNDING_OVER_RESTARTING',
    statement: '积累只发生在不断档的重复里，重启一次就等于清零一次',
    testPrinciple: '看连续，而不是看某一次的强度'
  },
  PROBABILITY_OVER_CERTAINTY: {
    id: 'PROBABILITY_OVER_CERTAINTY',
    statement: '方向是个概率问题，只能靠一次次小试验逐步逼近，等不来确定',
    testPrinciple: '用低成本试验的次数，替代“想清楚”的次数'
  },
  SCARCITY_VALUE_OVER_RAW_EFFORT: {
    id: 'SCARCITY_VALUE_OVER_RAW_EFFORT',
    statement: '资源越少，越要靠选对动作，而不是靠多花力气',
    testPrinciple: '同样一份力气，花在回报更高的动作上'
  },
  SYSTEM_OVER_MOTIVATION: {
    id: 'SYSTEM_OVER_MOTIVATION',
    statement: '能长期做下去靠的是安排和机制，不是一时的干劲',
    testPrinciple: '把动作绑进固定的时间和触发点'
  },
  MARKET_PROOF_OVER_SELF_ASSESSMENT: {
    id: 'MARKET_PROOF_OVER_SELF_ASSESSMENT',
    statement: '东西好不好，由愿意掏钱的人说了算，不由你自己说了算',
    testPrinciple: '拿一次真实付费/拒绝，替掉自我打分'
  },
  LOW_COST_EXPERIMENT_OVER_PERFECT_DIRECTION: {
    id: 'LOW_COST_EXPERIMENT_OVER_PERFECT_DIRECTION',
    statement: '与其等一个完美方向，不如先做一个低成本、拿得到反馈的小试验',
    testPrinciple: '先让现实参与，再决定要不要加大'
  },
  REPEATABILITY_OVER_OCCASIONAL_SUCCESS: {
    id: 'REPEATABILITY_OVER_OCCASIONAL_SUCCESS',
    statement: '能重复的才叫能力，一次做成只能叫运气',
    testPrinciple: '把有效的那次拆成能照搬的步骤'
  },
  LEVERAGE_OVER_TIME_FOR_MONEY: {
    id: 'LEVERAGE_OVER_TIME_FOR_MONEY',
    statement: '同样一份时间，能被放大的做法才走得远',
    testPrinciple: '让一次投入能被重复使用'
  }
}

// ── §4 bottleneck -> candidate lenses (ordered; candidates ONLY) ──
const CANDIDATES_BY_BOTTLENECK = {
  DIRECTION_GAP: ['PROBABILITY_OVER_CERTAINTY', 'LOW_COST_EXPERIMENT_OVER_PERFECT_DIRECTION'],
  ACTION_GAP: ['EXTERNAL_EVIDENCE_OVER_INTERNAL_CERTAINTY', 'LOW_COST_EXPERIMENT_OVER_PERFECT_DIRECTION'],
  CONSISTENCY_GAP: ['COMPOUNDING_OVER_RESTARTING', 'SYSTEM_OVER_MOTIVATION'],
  VALIDATION_GAP: ['MARKET_PROOF_OVER_SELF_ASSESSMENT', 'EXTERNAL_EVIDENCE_OVER_INTERNAL_CERTAINTY'],
  REPEATABILITY_GAP: ['REPEATABILITY_OVER_OCCASIONAL_SUCCESS', 'SYSTEM_OVER_MOTIVATION']
}

// Evidence-grounded applicability guards. None = always applicable.
// Guards read ONLY frozen B1 evidence (stage, realityConstraint) — no new judgement.
const GUARDS = {
  LOW_COST_EXPERIMENT_OVER_PERFECT_DIRECTION: (e) =>
    e.rc.includes('CASHFLOW_PRESSURE') || e.rc.includes('LOW_SURPLUS') || e.rc.includes('UNSTABLE_INCOME'),
  SYSTEM_OVER_MOTIVATION: (e) =>
    ['STARTED', 'TESTING', 'EARLY_TRACTION'].includes(e.stage),
  COMPOUNDING_OVER_RESTARTING: () => true,
  MARKET_PROOF_OVER_SELF_ASSESSMENT: () => true,
  REPEATABILITY_OVER_OCCASIONAL_SUCCESS: () => true,
  EXTERNAL_EVIDENCE_OVER_INTERNAL_CERTAINTY: () => true,
  PROBABILITY_OVER_CERTAINTY: () => true
}

function describeWorldRule (id) {
  const e = WORLD_RULE_LIBRARY[id]
  return e ? e.statement : ''
}

/**
 * Deterministically select the primary lens for a frozen diagnosis.
 * Reads ONLY bottleneck + stage + realityConstraint. Never asserts a diagnosis.
 * @returns {{id:string, candidates:string[], reason:string}|null}
 */
function selectWorldRule (diagnosis) {
  const pb = diagnosis && diagnosis.primaryBottleneck
  const cands = CANDIDATES_BY_BOTTLENECK[pb] || []
  if (!cands.length) return null
  const e = {
    stage: diagnosis.executionStage || null,
    rc: (diagnosis.realityConstraint && diagnosis.realityConstraint.types) || []
  }
  for (const id of cands) {
    const g = GUARDS[id]
    if (!g || g(e)) return { id: id, candidates: cands.slice(), reason: 'evidence_guard' }
  }
  return { id: cands[0], candidates: cands.slice(), reason: 'default' }
}

module.exports = {
  WORLD_RULE_LIBRARY,
  CANDIDATES_BY_BOTTLENECK,
  GUARDS,
  describeWorldRule,
  selectWorldRule
}
