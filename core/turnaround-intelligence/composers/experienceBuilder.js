/**
 * core/turnaround-intelligence/composers/experienceBuilder.js
 *
 * CP6-F Experience Builder — 阅读节奏 / 渐进披露 / 视觉层级 / 情绪曲线 / 动画时间轴
 *
 * 这是整个 CP6-F 的"阅读体验"设计层。
 *
 * ⚠️ 禁止推理。只消费现有卡片数据。
 *
 * @version 6.4.0
 * @checkpoint CP6-F
 */

const RHYTHM_STEPS = ['shock', 'reflection', 'hope', 'direction', 'action', 'proof']

const EXPERIENCE = Object.freeze({
  readingRhythm: {
    order: ['shock', 'reflection', 'hope', 'direction', 'action', 'proof'],
    mapping: {
      shock:       { cardId: 'hero',      label: '震撼', description: '一句话击中要害' },
      reflection:  { cardId: 'insight',    label: '反思', description: '你以为 vs 实际上' },
      hope:        { cardId: 'potential',  label: '希望', description: '潜力评估 + 声明' },
      direction:   { cardId: 'strategy',   label: '方向', description: '第一决策 + 路线' },
      action:      { cardId: 'action',     label: '行动', description: '只此一项' },
      proof:       { cardId: 'evidence',   label: '证明', description: '推理链可解释' },
    },
  },

  progressiveDisclosure: {
    enabled: true,
    rules: Object.freeze([
      {
        cardId: 'hero',
        initialVisible: ['headline'],
        tapToReveal: [
          { element: 'fullHeadline', transition: 'fadeIn' },
          { element: 'explanation', transition: 'fadeIn' },
        ],
      },
      {
        cardId: 'insight',
        initialVisible: ['youThought'],
        tapToReveal: [
          { element: 'actually', transition: 'slideRight' },
          { element: 'realProblem', transition: 'slideRight' },
        ],
      },
      {
        cardId: 'potential',
        initialVisible: ['score', 'level'],
        tapToReveal: [
          { element: 'reversibility', transition: 'fadeIn' },
          { element: 'window', transition: 'fadeIn' },
          { element: 'disclaimer', transition: 'fadeIn' },
        ],
      },
      {
        cardId: 'strategy',
        initialVisible: ['primaryDecision'],
        tapToReveal: [
          { element: 'roadmap', transition: 'expandDown' },
        ],
      },
      {
        cardId: 'timeline',
        initialVisible: ['firstMilestone'],
        tapToReveal: [
          { element: 'allMilestones', transition: 'expandVertical' },
        ],
      },
      {
        cardId: 'action',
        initialVisible: ['title'],
        tapToReveal: [
          { element: 'why', transition: 'fadeIn' },
          { element: 'successCriteria', transition: 'fadeIn' },
        ],
      },
      {
        cardId: 'evidence',
        initialVisible: ['title'],
        tapToReveal: [
          { element: 'chain', transition: 'expandDown' },
          { element: 'sources', transition: 'fadeIn' },
        ],
      },
    ]),
  },

  visualHierarchy: Object.freeze({
    headline:    { size: 32, color: 'Gold',   weight: 'Bold',    lineHeight: 1.2 },
    body:        { size: 18, color: 'White',  weight: 'Regular',  lineHeight: 1.5 },
    explanation: { size: 15, color: 'Gray',   weight: 'Light',    lineHeight: 1.6 },
    evidence:    { size: 13, color: 'Gray60', weight: 'Light',    lineHeight: 1.4 },
    tagline:     { size: 14, color: 'Gold',   weight: 'Regular',  italic: true },
  }),

  emotionCurve: Object.freeze({
    description: '从震撼到行动的情绪曲线 — 不要一直分析，要讲故事',
    phases: Object.freeze([
      { phase: 'shock',       intensity: 9,  animation: 'impact' },
      { phase: 'reflection',  intensity: 7,  animation: 'reveal' },
      { phase: 'hope',        intensity: 5,  animation: 'glow' },
      { phase: 'direction',   intensity: 3,  animation: 'slide' },
      { phase: 'action',      intensity: 6,  animation: 'urgency' },
      { phase: 'proof',       intensity: 2,  animation: 'prove' },
    ]),
  }),

  animationTimeline: Object.freeze({
    description: '每张卡出现有节奏，不一次性全部展示',
    entries: Object.freeze([
      { card: 'hero',      delayMs: 0,    durationMs: 700,  easing: 'ease-out' },
      { card: 'insight',   delayMs: 700,  durationMs: 900,  easing: 'ease-out' },
      { card: 'potential', delayMs: 1600, durationMs: 1000, easing: 'ease-out' },
      { card: 'strategy',  delayMs: 2600, durationMs: 800,  easing: 'ease-out' },
      { card: 'timeline',  delayMs: 3400, durationMs: 900,  easing: 'ease-out' },
      { card: 'action',    delayMs: 4300, durationMs: 700,  easing: 'ease-out' },
      { card: 'evidence',  delayMs: 5000, durationMs: 600,  easing: 'ease-out' },
    ]),
  }),
})

function getExperience() {
  return EXPERIENCE
}

function getRhythmForCard(cardId) {
  for (const [phase, info] of Object.entries(EXPERIENCE.readingRhythm.mapping)) {
    if (info.cardId === cardId) return { phase, ...info }
  }
  return { phase: 'unknown', label: '未知', description: '' }
}

function getAnimationForCard(cardId) {
  return EXPERIENCE.animationTimeline.entries.find(e => e.card === cardId) || null
}

function getDisclosureRule(cardId) {
  return EXPERIENCE.progressiveDisclosure.rules.find(r => r.cardId === cardId) || null
}

module.exports = {
  EXPERIENCE,
  getExperience,
  getRhythmForCard,
  getAnimationForCard,
  getDisclosureRule,
  RHYTHM_STEPS,
}
