/**
 * core/turnaround-intelligence/composers/reportComposer.js
 *
 * CP6-F Report Composer — 把 Cards 组装为最终体验报告
 *
 * ⚠️ 禁止新增推理。只消费 NIE 输出。
 *
 * @version 6.4.0
 * @checkpoint CP6-F
 */

const { createReportOutput, RHYTHM_STEPS } = require('../contracts/experience/reportComposer')

function compose(input) {
  const consistency = input.consistency || {}

  // ⚠️ Consistency < 85 → 不生成报告
  if (!consistency.passed) {
    return {
      blocked: true,
      reason: `一致性不足 (${consistency.score} < ${consistency.minRequired})，禁止生成报告。`,
      violations: consistency.violations || [],
    }
  }

  const cards = input.cards || []
  const heroCard = cards.find(c => c.cardId === 'hero')

  // Share version: 只有 hero + insight + potential
  const shareCards = cards.filter(c =>
    ['hero', 'insight', 'potential'].includes(c.cardId))

  // Premium version: 包含 roadmap + timeline + evidence + action
  const premiumCards = cards.filter(c =>
    ['strategy', 'timeline', 'action', 'evidence'].includes(c.cardId))

  return createReportOutput({
    version: '6.4.0',
    meta: {
      generatedAt: new Date().toISOString(),
      decisionVersion: '6.4.0',
      pipelineHash: input._hash || '',
    },
    cards,
    experience: buildExperience(),
    shareVersion: {
      cards: shareCards,
      tagline: input.emotion ? input.emotion.tagline : '',
      note: '分享版仅包含命运判决、认知暴击、翻身潜力。完整报告需解锁。',
    },
    premiumVersion: {
      cards: premiumCards,
      unlocks: ['翻身路线', '时间轴', '第一行动', '证据链'],
    },
  })
}

// ═══════════════════════════════════════
// Experience Layer
// ═══════════════════════════════════════

function buildExperience() {
  return {
    readingRhythm: [...RHYTHM_STEPS],

    progressiveDisclosure: {
      enabled: true,
      rules: [
        { card: 'hero',     revealsInitially: 'headline',   revealsOnTap: ['fullHeadline', 'explanation'] },
        { card: 'insight',  revealsInitially: 'youThought', revealsOnTap: ['actually', 'realProblem'] },
        { card: 'potential',revealsInitially: 'score',      revealsOnTap: ['level', 'reversibility', 'window'] },
        { card: 'strategy', revealsInitially: 'primaryDecision', revealsOnTap: ['roadmap'] },
        { card: 'timeline', revealsInitially: 'firstMilestone', revealsOnTap: ['allMilestones'] },
        { card: 'action',   revealsInitially: 'title',      revealsOnTap: ['why', 'successCriteria'] },
        { card: 'evidence', revealsInitially: 'title',      revealsOnTap: ['chain', 'sources'] },
      ],
    },

    visualHierarchy: {
      headline:    { size: 32, color: 'Gold',   weight: 'Bold' },
      body:        { size: 18, color: 'White',  weight: 'Regular' },
      explanation: { size: 15, color: 'Gray',   weight: 'Light' },
      evidence:    { size: 13, color: 'Gray60', weight: 'Light' },
    },

    emotionCurve: [
      { phase: 'shock',       cardId: 'hero',      intensity: 9,  description: '震撼——一句话击中要害' },
      { phase: 'reflection',  cardId: 'insight',    intensity: 7,  description: '反思——你以为 vs 实际上' },
      { phase: 'hope',        cardId: 'potential',  intensity: 5,  description: '希望——潜力评估 + 声明' },
      { phase: 'direction',   cardId: 'strategy',   intensity: 3,  description: '方向——第一决策 + 路线' },
      { phase: 'action',      cardId: 'action',     intensity: 6,  description: '行动——只此一项' },
      { phase: 'proof',       cardId: 'evidence',   intensity: 2,  description: '证明——推理链可解释' },
    ],

    animationTimeline: [
      { card: 'hero',      delayMs: 0,   durationMs: 700 },
      { card: 'insight',   delayMs: 700, durationMs: 900 },
      { card: 'potential', delayMs: 1600,durationMs: 1000 },
      { card: 'strategy',  delayMs: 2600,durationMs: 800 },
      { card: 'timeline',  delayMs: 3400,durationMs: 900 },
      { card: 'action',    delayMs: 4300,durationMs: 700 },
      { card: 'evidence',  delayMs: 5000,durationMs: 600 },
    ],
  }
}

module.exports = { compose }
