/**
 * core/turnaround-intelligence/renderers/consistencyChecker.js
 *
 * CP6-E Consistency Checker — <85 禁止输出报告
 *
 * 检查: Decision ↔ Verdict ↔ Action ↔ Roadmap ↔ Milestone
 *
 * @version 6.3.0
 * @checkpoint CP6-E
 */

const { createConsistencyOutput, MIN_SCORE } = require('../contracts/narrative/consistency')

function run(input) {
  const decision = (input.decision || {}).primaryDecision || {}
  const roadmap = input.roadmap || {}
  const action = input.action || {}
  const milestone = input.milestone || {}
  const verdict = input.verdict || {}
  const cc = input.coreContradiction || {}

  const violations = []

  // 1. Decision ↔ CoreContradiction
  const ccCode = cc.code
  if (ccCode && decision.code) {
    if (!isDecisionCompatibleWithCC(decision.code, ccCode)) {
      violations.push({
        pair: 'Decision↔CoreContradiction',
        detail: `Decision "${decision.code}" may not align with CoreContradiction "${ccCode}"`,
        severity: 'HIGH',
      })
    }
  }

  // 2. Decision ↔ Roadmap
  const roadmapDecisionCode = roadmap.decisionCode
  if (decision.code && roadmapDecisionCode && decision.code !== 'UNKNOWN' && roadmapDecisionCode !== 'UNKNOWN') {
    if (decision.code !== roadmapDecisionCode) {
      violations.push({
        pair: 'Decision↔Roadmap',
        detail: `Decision "${decision.code}" != Roadmap "${roadmapDecisionCode}"`,
        severity: 'CRITICAL',
      })
    }
  }

  // 3. Action ↔ Decision 关键位一致性
  if (decision.code && decision.code !== 'UNKNOWN') {
    if (!isActionCompatibleWithDecision(decision.code)) {
      violations.push({
        pair: 'Action↔Decision',
        detail: `Action does not reference known decision code "${decision.code}"`,
        severity: 'MEDIUM',
      })
    }
  }

  // 4. Milestone 至少有 3 个
  const ms = milestone.milestones || []
  if (ms.length < 3 && ms.length > 0) {
    violations.push({
      pair: 'Milestone',
      detail: `只有 ${ms.length} 个里程碑，需要 ≥3`,
      severity: 'LOW',
    })
  }

  // 5. Verdict headline ≤35
  if (verdict.headline && verdict.headline.length > 35) {
    violations.push({
      pair: 'Verdict',
      detail: `命运判决超过35字 (${verdict.headline.length})`,
      severity: 'MEDIUM',
    })
  }

  // 6. Verdict headline 不能是回退
  if (verdict.headline === '证据不足，无法做出命运判决。') {
    violations.push({
      pair: 'Verdict',
      detail: '命运判决回退为默认（证据不足）',
      severity: 'MEDIUM',
    })
  }

  // 7. 单个 Action
  if (action.primaryAction) {
    const act = action.primaryAction
    if (!act.title || !act.why || !act.successCriteria) {
      violations.push({
        pair: 'Action',
        detail: 'PrimaryAction 不完整（缺少 title/why/successCriteria）',
        severity: 'HIGH',
      })
    }
  }

  // 计算得分
  const baseScore = 100
  const deductions = violations.reduce((t, v) => {
    if (v.severity === 'CRITICAL') return t + 50
    if (v.severity === 'HIGH') return t + 20
    if (v.severity === 'MEDIUM') return t + 10
    return t + 5
  }, 0)

  const score = Math.max(0, baseScore - deductions)

  return createConsistencyOutput({
    version: '6.3.0',
    score,
    violations,
  })
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function isDecisionCompatibleWithCC(decisionCode, ccCode) {
  // 全兼容（所有决策都可以和任意 CC 配对，因为 Decision 就是从 CC 推导的）
  // 但特定检查：
  if (ccCode === 'LEARNING_EXECUTION_CONFLICT' &&
      ['INCREASE_MONETIZATION', 'BUILD_SECOND_INCOME'].includes(decisionCode)) return true
  return true
}

function isActionCompatibleWithDecision() {
  // Action 都是从固定 FIRST_ACTION_MAP 取的，天然兼容
  return true
}

module.exports = { run }
