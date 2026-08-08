/**
 * engine/worldModel/externalConstraintGuardDefinitions.js
 *
 * RC8.3 C4-003A — External Constraint / False Positive Guard Definitions.
 *
 * Makes C1 externalConstraints and falsePositivePatterns executable.
 *
 * C1 blindSpotBoundaryDefinitions.js is semantic authority.
 * This module adds executable evidencePredicates without modifying C1 text.
 *
 * GUARD STATES:
 *   EXTERNAL_CONSTRAINT_PRESENT  — external constraint explains observed pattern
 *   FALSE_POSITIVE_RISK          — pattern resembles cognitive defect but has alternative explanation
 *   INSUFFICIENT_TO_DIAGNOSE     — not enough independent cognitive evidence after external accounting
 *   COGNITIVE_EVIDENCE_INDEPENDENT — cognitive evidence remains after external explanation
 *
 * @version world_model_v3
 * @sprint c4-003a
 */

// ═══════════════════════════════════════════════════════════════
// GUARD DEFINITIONS PER BLIND SPOT
// ═══════════════════════════════════════════════════════════════

var EXTERNAL_GUARDS = Object.freeze({

  // ── DECISION_INERTIA ──

  DECISION_INERTIA: {
    guards: [
      {
        id: 'DI_EXT_MANDATORY_WAITING',
        explanation: '外部强制等待期（如监管审批、第三方依赖、合同排他期）',
        severity: 'DISQUALIFYING',
        guardEffect: 'EXTERNAL_CONSTRAINT_PRESENT',
        evidencePredicate: {
          type: 'AND',
          conditions: [
            { type: 'GUARD_SIGNAL', signalId: 'WAITING_DURATION_PATTERN', state: 'ACTIVE', maxScore: 60 },
            { type: 'GUARD_SIGNAL', signalId: 'MINIMUM_STEP_EXECUTION', state: 'INSUFFICIENT_EVIDENCE' },
            { type: 'GUARD_SIGNAL', signalId: 'POST_ACTION_REVIEW_HABIT', state: 'INSUFFICIENT_EVIDENCE' },
          ],
        },
      },
      {
        id: 'DI_EXT_SINGLE_EVIDENCE_ONLY',
        explanation: '仅WAITING_DURATION_PATTERN活跃，无其他支持证据 — 可能是外部约束而非认知模式',
        severity: 'CONDITIONAL',
        guardEffect: 'INSUFFICIENT_TO_DIAGNOSE',
        evidencePredicate: {
          type: 'AND',
          conditions: [
            { type: 'GUARD_SIGNAL', signalId: 'WAITING_DURATION_PATTERN', state: 'ACTIVE', maxScore: 65 },
            { type: 'GUARD_NO_SIGNAL', signalId: 'MINIMUM_STEP_EXECUTION', state: 'ACTIVE' },
            { type: 'GUARD_NO_SIGNAL', signalId: 'DECISION_TO_ACTION_LATENCY', state: 'ACTIVE' },
          ],
        },
      },
    ],
  },

  // ── FEEDBACK_LOOP_GAP ──

  FEEDBACK_LOOP_GAP: {
    guards: [
      {
        id: 'FLG_EXT_UNAVAILABLE_FEEDBACK',
        explanation: '行动环境不提供可观测的结果信号',
        severity: 'CONDITIONAL',
        guardEffect: 'FALSE_POSITIVE_RISK',
        evidencePredicate: {
          type: 'AND',
          conditions: [
            { type: 'GUARD_SIGNAL', signalId: 'MINIMUM_STEP_EXECUTION', state: 'ACTIVE', maxScore: 55 },
            { type: 'GUARD_SIGNAL', signalId: 'POST_ACTION_REVIEW_HABIT', state: 'INSUFFICIENT_EVIDENCE' },
          ],
        },
      },
    ],
  },

  // ── LEVERAGE_MODEL_GAP ──

  LEVERAGE_MODEL_GAP: {
    guards: [
      {
        id: 'LMG_EXT_SURVIVAL_PRESSURE',
        explanation: '生存压力迫使全部时间用于直接换取收入 — 杠杆建设不是认知问题而是资源约束',
        severity: 'CONDITIONAL',
        guardEffect: 'INSUFFICIENT_TO_DIAGNOSE',
        evidencePredicate: {
          type: 'AND',
          conditions: [
            { type: 'GUARD_SIGNAL', signalId: 'OUTPUT_DECOUPLING_AWARENESS', state: 'ACTIVE', maxScore: 50 },
            { type: 'GUARD_SIGNAL', signalId: 'EFFORT_VS_MECHANISM_FRAMING', state: 'ACTIVE', maxScore: 50 },
            { type: 'GUARD_NO_SIGNAL', signalId: 'DIRECTION_SWITCHING_FREQUENCY', state: 'ACTIVE' },
          ],
        },
      },
      {
        id: 'LMG_EXT_CLIENT_CONSTRAINT',
        explanation: '客户合同或行业惯例限制了价值交付模式 — 外部约束而非认知缺陷',
        severity: 'CONDITIONAL',
        guardEffect: 'FALSE_POSITIVE_RISK',
        evidencePredicate: {
          type: 'AND',
          conditions: [
            { type: 'GUARD_SIGNAL', signalId: 'OUTPUT_DECOUPLING_AWARENESS', state: 'ACTIVE', maxScore: 50 },
            { type: 'GUARD_SIGNAL', signalId: 'EFFORT_VS_MECHANISM_FRAMING', state: 'ACTIVE', maxScore: 50 },
          ],
        },
      },
    ],
  },

  // ── TIME_HORIZON_TRAP ──

  TIME_HORIZON_TRAP: {
    guards: [
      {
        id: 'THT_EXT_UNSTABLE_ENVIRONMENT',
        explanation: '外部环境高度不稳定 — 切换方向可能不是认知问题而是环境适应性行为',
        severity: 'CONDITIONAL',
        guardEffect: 'INSUFFICIENT_TO_DIAGNOSE',
        evidencePredicate: {
          type: 'AND',
          conditions: [
            { type: 'GUARD_SIGNAL', signalId: 'DIRECTION_SWITCHING_FREQUENCY', state: 'ACTIVE', maxScore: 55 },
            { type: 'GUARD_SIGNAL', signalId: 'LONG_TERM_COMPOUNDING_AWARENESS', state: 'INSUFFICIENT_EVIDENCE' },
          ],
        },
      },
      {
        id: 'THT_EXT_STRUCTURAL_EVENT',
        explanation: '结构性事件（如倒闭、裁员）导致的被迫切换 — 非认知漂移',
        severity: 'CONDITIONAL',
        guardEffect: 'INSUFFICIENT_TO_DIAGNOSE',
        evidencePredicate: {
          type: 'AND',
          conditions: [
            { type: 'GUARD_SIGNAL', signalId: 'DIRECTION_SWITCHING_FREQUENCY', state: 'ACTIVE', maxScore: 55 },
          ],
        },
      },
    ],
  },

  // ── OPPORTUNITY_BLINDNESS ──

  OPPORTUNITY_BLINDNESS: {
    guards: [
      {
        id: 'OB_EXT_GEOGRAPHIC_ISOLATION',
        explanation: '地理位置限制了信息接触面 — 信息窄≠认知缺陷',
        severity: 'CONDITIONAL',
        guardEffect: 'FALSE_POSITIVE_RISK',
        evidencePredicate: {
          type: 'AND',
          conditions: [
            { type: 'GUARD_SIGNAL', signalId: 'INFORMATION_SOURCE_DIVERSITY', state: 'ACTIVE', maxScore: 60 },
            { type: 'GUARD_SIGNAL', signalId: 'SERENDIPITOUS_PATH_DISCOVERY', state: 'ACTIVE', maxScore: 55 },
            { type: 'GUARD_NO_SIGNAL', signalId: 'IDENTITY_BASED_EXCLUSION', state: 'ACTIVE' },
          ],
        },
      },
    ],
  },

  // ── RISK_MODEL_DISTORTION ──

  RISK_MODEL_DISTORTION: {
    guards: [
      {
        id: 'RMD_EXT_GENUINE_HIGH_RISK',
        explanation: '真实的高风险环境使情绪性谨慎成为合理反应',
        severity: 'CONDITIONAL',
        guardEffect: 'FALSE_POSITIVE_RISK',
        evidencePredicate: {
          type: 'AND',
          conditions: [
            { type: 'GUARD_SIGNAL', signalId: 'EMOTIONAL_RECENCY_IMPACT', state: 'ACTIVE', maxScore: 55 },
            { type: 'GUARD_SIGNAL', signalId: 'ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', state: 'INSUFFICIENT_EVIDENCE' },
          ],
        },
      },
    ],
  },

  // ── PROBABILITY_MISJUDGMENT ──

  PROBABILITY_MISJUDGMENT: {
    guards: [
      {
        id: 'PM_EXT_NO_STATS_EDUCATION',
        explanation: '缺乏统计和概率教育背景 — 知识缺失≠认知缺陷',
        severity: 'CONDITIONAL',
        guardEffect: 'FALSE_POSITIVE_RISK',
        evidencePredicate: {
          type: 'AND',
          conditions: [
            { type: 'GUARD_SIGNAL', signalId: 'PROBABILISTIC_LANGUAGE_USAGE', state: 'ACTIVE', maxScore: 55 },
            { type: 'GUARD_SIGNAL', signalId: 'LUCK_VS_SKILL_ATTRIBUTION', state: 'ACTIVE', maxScore: 55 },
          ],
        },
      },
    ],
  },

  // ── IDENTITY_CONSTRAINT ──

  IDENTITY_CONSTRAINT: {
    guards: [
      {
        id: 'IC_EXT_REAL_CAPABILITY_GAP',
        explanation: '真实能力不足限制了某些选择 — 非身份过滤',
        severity: 'CONDITIONAL',
        guardEffect: 'FALSE_POSITIVE_RISK',
        evidencePredicate: {
          type: 'AND',
          conditions: [
            { type: 'GUARD_SIGNAL', signalId: 'IDENTITY_BASED_EXCLUSION', state: 'ACTIVE', maxScore: 55 },
            { type: 'GUARD_SIGNAL', signalId: 'INFORMATION_SOURCE_DIVERSITY', state: 'INSUFFICIENT_EVIDENCE' },
          ],
        },
      },
    ],
  },

  // ── SYSTEM_THINKING_GAP ──

  SYSTEM_THINKING_GAP: {
    guards: [
      {
        id: 'STG_EXT_TOOL_LIMITATION',
        explanation: '工具或系统不提供趋势数据 — 无法看到数据≠缺乏系统思维',
        severity: 'CONDITIONAL',
        guardEffect: 'FALSE_POSITIVE_RISK',
        evidencePredicate: {
          type: 'AND',
          conditions: [
            { type: 'GUARD_SIGNAL', signalId: 'FEEDBACK_LOOP_CONCEPT_AWARENESS', state: 'ACTIVE', maxScore: 55 },
            { type: 'GUARD_SIGNAL', signalId: 'LINEARTY_VS_COMPLEXITY_DEFAULT', state: 'ACTIVE', maxScore: 55 },
            { type: 'GUARD_NO_SIGNAL', signalId: 'CROSS_DOMAIN_FEEDBACK_THINKING', state: 'ACTIVE' },
          ],
        },
      },
      {
        id: 'STG_EXT_NO_EDUCATION',
        explanation: '缺乏系统思维教育背景 — 知识缺失≠认知缺陷',
        severity: 'CONDITIONAL',
        guardEffect: 'FALSE_POSITIVE_RISK',
        evidencePredicate: {
          type: 'AND',
          conditions: [
            { type: 'GUARD_SIGNAL', signalId: 'FEEDBACK_LOOP_CONCEPT_AWARENESS', state: 'ACTIVE', maxScore: 50 },
            { type: 'GUARD_SIGNAL', signalId: 'LINEARTY_VS_COMPLEXITY_DEFAULT', state: 'ACTIVE', maxScore: 50 },
          ],
        },
      },
    ],
  },

})

// ═══════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════

function getGuards(candidateId) {
  var entry = EXTERNAL_GUARDS[candidateId]
  return entry ? entry.guards : []
}

module.exports = {
  EXTERNAL_GUARDS,
  getGuards,
}
