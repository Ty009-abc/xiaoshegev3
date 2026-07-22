/**
 * core/turnaround-intelligence/engines/coreContradictionEngine.js
 *
 * CP6-C.1 Core Contradiction Engine — 选出唯一核心矛盾
 *
 * 从 Conflict Top3 中，通过加权评分选出唯一核心矛盾。
 *
 * 整个报告只围绕这一件事。
 *
 * 选择规则（确定性）:
 *   1. severity 最高 → +40% 权重
 *   2. 涉及 LEVERAGE 数量最多 → +30%
 *   3. 涉及 RISK 数量最多 → +15%
 *   4. 冲突类型为 LEARNING_EXECUTION → +15%（经验：最常见也最值得解决）
 *
 * @version 6.1.0
 * @checkpoint CP6-C.1
 */

const { createCoreContradictionOutput } = require('../contracts/coreContradiction')
const { CONFLICT_RULES } = require('../contracts/conflict')

/**
 * run — 从 Conflict + Risk + Leverage + Evidence 中选出唯一核心矛盾
 */
function run(input) {
  const conflicts = (input.conflicts || {}).conflicts || []
  const riskTop = (input.risk || {}).topRisks || []
  const leverageTop = (input.leverage || {}).topLeverages || []
  const evidences = (input.evidence || {}).evidences || []

  if (conflicts.length === 0) {
    // 回退: 选最严重 risk
    return createFallbackOutput(riskTop, leverageTop)
  }

  // 对每个冲突打分
  const scored = conflicts.map(c => {
    let score = c.severity * 0.40

    // 涉及 leverage 数
    const levMatches = countMatchedRules(c.code, 'leverageCode', leverageTop.map(l => l.code))
    score += 30 * Math.min(levMatches / 2, 1)

    // 涉及 risk 数
    const riskMatches = countMatchedRules(c.code, 'riskCode', riskTop.map(r => r.riskCode))
    score += 15 * Math.min(riskMatches / 2, 1)

    // 经验加分
    if (c.code === 'LEARNING_EXECUTION_CONFLICT') score += 15
    if (c.code === 'AMBITION_DISCIPLINE_CONFLICT') score += 10

    return { ...c, selectorScore: Math.round(score * 10) / 10 }
  })

  scored.sort((a, b) => b.selectorScore - a.selectorScore)
  const winner = scored[0]

  // 找到 winner 的所有上游引用
  const upstreamRisks = findUpstream(winner.code, 'riskCode', riskTop.map(r => r.riskCode))
  const upstreamLeverages = findUpstream(winner.code, 'leverageCode', leverageTop.map(l => l.code))

  // 证据链构建
  const chain = buildEvidenceChain(winner, upstreamRisks, riskTop, upstreamLeverages, leverageTop, evidences)

  return createCoreContradictionOutput({
    version: '6.1.0',
    code: winner.code,
    title: winner.title,
    severity: winner.severity,
    confidence: clamp(0.85 * (scored.length === 1 ? 0.9 : (winner.selectorScore / scored[0].selectorScore)), 0.6, 0.95),
    reason: generateReason(winner, scored.length),
    supportedBy: [...new Set([
      ...upstreamRisks.map(r => `R:${r}`),
      ...upstreamLeverages.map(l => `L:${l}`),
      `C:${winner.code}`,
    ])],
    evidenceChain: chain,
  })
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function countMatchedRules(conflictCode, field, topCodes) {
  const rules = CONFLICT_RULES.filter(r => r.conflictCode === conflictCode)
  const values = rules.map(r => r[field])
  return values.filter(v => topCodes.includes(v)).length
}

function findUpstream(conflictCode, field, topCodes) {
  const rules = CONFLICT_RULES.filter(r => r.conflictCode === conflictCode)
  const values = rules.map(r => r[field])
  return values.filter(v => topCodes.includes(v))
}

function generateReason(winner, totalConflicts) {
  if (totalConflicts === 1) {
    return `这是唯一检测到的核心矛盾 — ${winner.title}`
  }
  return `${winner.title} 严重度最高 (${Math.round(winner.selectorScore)}分)，是多个风险与优势的共同交汇点`
}

/**
 * buildEvidenceChain — 构建从 Evidence → Pattern → Risk → Conflict 的完整溯源
 */
function buildEvidenceChain(conflict, upstreamRisks, riskTop, upstreamLeverages, leverageTop, evidences) {
  const nodes = []

  // Level 1: Evidence
  for (const riskCode of upstreamRisks) {
    const risk = riskTop.find(r => r.riskCode === riskCode)
    if (risk && risk.evidenceRefs) {
      for (const eid of risk.evidenceRefs.slice(0, 3)) {
        const ev = evidences.find(e => e.id === eid)
        if (ev && !nodes.find(n => n.type === 'evidence' && n.id === eid)) {
          nodes.push({ type: 'evidence', id: eid, questionId: ev.questionId, direction: ev.direction, tags: ev.tags })
        }
      }
    }
  }

  // Level 2: Pattern
  for (const riskCode of upstreamRisks) {
    const risk = riskTop.find(r => r.riskCode === riskCode)
    if (risk && risk.patternRefs) {
      for (const pref of risk.patternRefs) {
        if (!nodes.find(n => n.type === 'pattern' && n.id === pref)) {
          nodes.push({ type: 'pattern', id: pref })
        }
      }
    }
  }

  // Level 3: Risk
  for (const riskCode of upstreamRisks) {
    if (!nodes.find(n => n.type === 'risk' && n.id === riskCode)) {
      nodes.push({ type: 'risk', id: riskCode })
    }
  }

  // Level 4: Leverage
  for (const levCode of upstreamLeverages) {
    if (!nodes.find(n => n.type === 'leverage' && n.id === levCode)) {
      nodes.push({ type: 'leverage', id: levCode })
    }
  }

  // Level 5: Conflict
  nodes.push({ type: 'conflict', id: conflict.code })

  return { nodes }
}

function createFallbackOutput(riskTop, leverageTop) {
  if (riskTop.length === 0) {
    return createCoreContradictionOutput({
      version: '6.1.0',
      code: 'LEARNING_EXECUTION_CONFLICT',
      title: '信息不足',
      severity: 30,
      confidence: 0.25,
      reason: '证据不足，无法确定核心矛盾',
      supportedBy: [],
      evidenceChain: { nodes: [] },
    })
  }

  const top = riskTop[0]
  return createCoreContradictionOutput({
    version: '6.1.0',
    code: 'LEARNING_EXECUTION_CONFLICT',
    title: `聚焦：${top.title}`,
    severity: top.severity,
    confidence: top.confidence || 0.6,
    reason: `未检测到明确矛盾，以最严重风险为核心：${top.title}`,
    supportedBy: [`R:${top.riskCode}`],
    evidenceChain: { nodes: [] },
  })
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }
module.exports = { run }
