/**
 * core/turnaround-intelligence/renderers/verdictRenderer.js
 *
 * CP6-E Verdict Renderer — 命运判决（≤35字，来自 CoreContradiction）
 *
 * @version 6.3.0
 * @checkpoint CP6-E
 */

const { createVerdictOutput } = require('../contracts/narrative/verdict')
const { CONFLICT_CATALOG } = require('../contracts/conflict')
const { DECISION_CATALOG } = require('../contracts/decision')

/**
 * CoreContradiction → Verdict 固定模板
 * 禁止 LLM 生成，纯模板映射
 */
const CC_VERDICT_MAP = {
  LEARNING_EXECUTION_CONFLICT: {
    headline: '真正阻止你翻身的，是学了很多却做得太少。',
    explanation: '你的学习能力明显高于执行能力，知识没有转化为资产或收入。',
  },
  AMBITION_DISCIPLINE_CONFLICT: {
    headline: '真正的瓶颈不是能力，是纪律跟不上野心。',
    explanation: '你的野心足够大，但执行习惯还没有建立起来。',
  },
  SPEED_CONSISTENCY_CONFLICT: {
    headline: '你能跑很快，但从来跑不远。',
    explanation: '执行力强但持续性不足，导致积累无法形成。',
  },
  THINKING_ACTION_CONFLICT: {
    headline: '你想到了所有可能性，却一种都没做。',
    explanation: '过度分析导致行动瘫痪，思想资源被浪费。',
  },
  RISK_REWARD_CONFLICT: {
    headline: '你对风险的判断，正在系统性误导你。',
    explanation: '风险评估失当导致过度冒险或过度保守。',
  },
  STABILITY_GROWTH_CONFLICT: {
    headline: '你被稳定困住了，却以为是安全。',
    explanation: '对稳定的依赖正在阻止你进入成长轨道。',
  },
}

function run(input) {
  const cc = input.coreContradiction || {}
  const decision = (input.decision || {}).primaryDecision || {}
  const ccCode = cc.code
  const ccConfidence = cc.confidence || 0.5

  if (!ccCode || !CC_VERDICT_MAP[ccCode]) {
    // 基于 Risk 回退
    const riskTop = (input.risk || {}).topRisks || []
    const topRisk = riskTop[0]
    if (topRisk && topRisk.riskCode === 'INCOME_STRUCTURE_RISK') {
      return createVerdictOutput({
        headline: '你的收入结构正在拖累你的未来。',
        explanation: '单一收入来源意味着一次变故就可能击穿你的财务底线。',
        confidence: topRisk.confidence || 0.5,
        basedOn: { coreContradiction: ccCode || '风险推导', decision: decision.code },
      })
    }
    return createVerdictOutput({
      headline: '证据不足，无法做出命运判决。',
      explanation: '当前信息太少，请提供更多关于执行习惯和收入结构的信息。',
      confidence: Math.max(0.15, ccConfidence * 0.5),
      basedOn: {
        coreContradiction: ccCode || '未知',
        decision: decision.code || 'UNKNOWN',
      },
    })
  }

  const template = CC_VERDICT_MAP[ccCode]

  return createVerdictOutput({
    headline: template.headline,
    explanation: template.explanation,
    confidence: ccConfidence,
    basedOn: {
      coreContradiction: ccCode,
      decision: decision.code,
    },
  })
}

module.exports = { run }
