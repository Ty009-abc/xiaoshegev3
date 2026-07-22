/**
 * core/turnaround-intelligence/composers/cardBuilder.js
 *
 * CP6-F Card Builder — 固定 7 张卡片
 *
 * ⚠️ 只消费 NIE 输出，禁止新增推理
 *
 * INPUT: Verdict, RealityGap, Potential, Decision, Roadmap, Timeline, Action, Consistency
 * OUTPUT: 7 Cards (hero, insight, potential, strategy, timeline, action, evidence)
 *
 * @version 6.4.0
 * @checkpoint CP6-F
 */

const { createHeroCardOutput } = require('../contracts/experience/heroCard')
const { createInsightCardOutput } = require('../contracts/experience/insightCard')
const { createPotentialCardOutput } = require('../contracts/experience/potentialCard')
const { createStrategyCardOutput } = require('../contracts/experience/strategyCard')
const { createTimelineCardOutput } = require('../contracts/experience/timelineCard')
const { createActionCardOutput } = require('../contracts/experience/actionCard')
const { createEvidenceDrawerOutput } = require('../contracts/experience/evidenceDrawer')

function buildCards(input) {
  // ⚠️ INPUT ONLY from NIE output — 禁止读取原始 data
  const verdict = input.verdict || {}
  const realityGap = input.realityGap || {}
  const potential = input.potential || {}
  const decision = input.decision || {}
  const strategy = input.strategy || {}
  const timeline = input.timeline || {}
  const action = input.action || {}

  const cards = []

  // Card 1: Hero — 命运判决
  cards.push(createHeroCardOutput({
    version: '6.4.0',
    layout: { size: 'FULL', displayMode: 'SHOCK' },
    content: {
      headline: verdict.headline || '证据不足，无法做出命运判决。',
      fullHeadline: verdict.headline || '',
      explanation: verdict.explanation || '',
      confidence: verdict.confidence || 0,
    },
    action: { label: '继续查看', nextCard: 'insight' },
  }))

  // Card 2: Insight — 认知暴击
  cards.push(createInsightCardOutput({
    version: '6.4.0',
    content: {
      youThought: realityGap.youThought || '',
      actually: realityGap.actually || '',
      realProblem: realityGap.realProblem || '',
    },
  }))

  // Card 3: Potential — 翻身潜力
  cards.push(createPotentialCardOutput({
    version: '6.4.0',
    content: {
      score: potential.score || 0,
      level: potential.level || 'LOW',
      reversibility: potential.reversibility || 'LOW',
      estimatedRecoveryDays: potential.estimatedRecoveryDays || 0,
      window: { ...potential.window },
      disclaimer: potential.disclaimer || '这是基于当前行为模式的评估，不代表未来结果的保证。',
    },
  }))

  // Card 4: Strategy — 第一决策
  const decisionCode = (decision.primaryDecision || {}).code
  cards.push(createStrategyCardOutput({
    version: '6.4.0',
    primaryDecision: {
      decision: decisionCode || 'UNKNOWN',
      label: getDecisionLabel(decisionCode),
      instruction: getDecisionInstruction(decisionCode),
    },
    roadmap: (strategy.phases || []).map(p => ({
      period: p.period, action: p.action, emphasis: p.emphasis,
    })),
  }))

  // Card 5: Timeline — 时间轴
  cards.push(createTimelineCardOutput({
    version: '6.4.0',
    startDay: 0,
    milestones: (timeline.timeline || []).map(t => ({
      day: t.day, title: t.title, milestone: t.milestone, successCriteria: t.successCriteria,
    })),
  }))

  // Card 6: Action — 第一行动
  const primAction = action.primaryAction || {}
  cards.push(createActionCardOutput({
    version: '6.4.0',
    primaryAction: {
      title: primAction.title || '',
      why: primAction.why || '',
      successCriteria: primAction.successCriteria || '',
    },
  }))

  // Card 7: Evidence Drawer — 为什么？
  cards.push(createEvidenceDrawerOutput({
    version: '6.4.0',
    chain: buildEvidenceChain(input),
    sources: [],
  }))

  return cards
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

const DECISION_LABELS = {
  BUILD_EXECUTION_SYSTEM: '建立执行系统',
  BUILD_SECOND_INCOME: '建立第二收入',
  BUILD_DISCIPLINE: '建立纪律',
  REDUCE_DECISION_FATIGUE: '减少决策疲劳',
  REBUILD_RISK_FRAMEWORK: '重建风险框架',
}

function getDecisionLabel(code) {
  return DECISION_LABELS[code] || '行为调整'
}

function getDecisionInstruction(code) {
  if (code === 'BUILD_EXECUTION_SYSTEM') return '未来30天，建立每日执行记录。其它事情全部靠后。'
  if (code === 'BUILD_SECOND_INCOME') return '未来30天，完成个人资源盘点。确定一个可行方向。'
  if (code === 'BUILD_DISCIPLINE') return '未来30天，建立一个固定时间动作。坚持就是一切。'
  return '未来30天，先从最小的一步开始。'
}

function buildEvidenceChain(input) {
  const chain = []
  const cc = input.coreContradiction || {}
  const patterns = input.patterns || {}
  const risk = input.risk || {}
  const decision = input.decision || {}

  if (cc.code) {
    chain.push({ label: '核心矛盾', content: cc.code, source: 'CoreContradictionEngine' })
  }
  if (patterns.matches && patterns.matches.length > 0) {
    chain.push({ label: '行为模式', content: patterns.matches.slice(0, 2).map(m => m.code).join(', '), source: 'PatternEngine' })
  }
  if (risk.topRisks && risk.topRisks.length > 0) {
    chain.push({ label: '风险评估', content: risk.topRisks.slice(0, 2).map(r => r.riskCode).join(', '), source: 'RiskEngine' })
  }
  if (decision.primaryDecision && decision.primaryDecision.code) {
    chain.push({ label: '最终决策', content: decision.primaryDecision.code, source: 'DecisionEngine' })
  }

  if (chain.length === 0) {
    chain.push({ label: '推理状态', content: '证据不足，无法建立完整推理链' })
  }

  return chain
}

module.exports = { buildCards }
