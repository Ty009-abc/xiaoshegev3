/**
 * core/turnaround-intelligence/renderers/emotionRenderer.js
 *
 * CP6-E Emotion Renderer — 仅可润色表达，不改事实
 *
 * 这是 NIE 中唯一允许"语言润色"的层。
 *
 * 核心约束:
 *   - 可以调整措辞让表达更有感染力
 *   - 禁止新增事实、删除事实、改变事实
 *   - 禁止改变任何推理结论
 *
 * @version 6.3.0
 * @checkpoint CP6-E
 */

const { createEmotionOutput } = require('../contracts/narrative/emotion')

const TAGLINE_MAP = {
  LEARNING_EXECUTION_CONFLICT: '你最大的遗憾，不是不会学习，而是所有学习，都停留在了脑子里。',
  AMBITION_DISCIPLINE_CONFLICT: '你不是不够努力，只是努力的方向每次都差了一点点坚持。',
  SPEED_CONSISTENCY_CONFLICT: '你像一束烟花，绚丽但转瞬即逝。该让烟花变成长明灯了。',
  THINKING_ACTION_CONFLICT: '你看清了所有的路，却一条都没走。最可惜的不是不知道，是不去做。',
  RISK_REWARD_CONFLICT: '你以为自己在冒险，其实是在赌博。真正的冒险家，从来不靠运气。',
  STABILITY_GROWTH_CONFLICT: '你躲在一个安稳的笼子里，以为那是家。其实那是困住你的牢。',
  _DEFAULT: '改变从来不是一次性的事情，而是一天一天的选择。',
}

// Verdict headline 的情绪化重述（不改含义）
const VERDICT_EMOTION_MAP = {
  LEARNING_EXECUTION_CONFLICT: '你学得越多，离自由越远——除非你开始做了。',
  AMBITION_DISCIPLINE_CONFLICT: '你的野心很大，但野心需要一双能奔跑的腿。',
  SPEED_CONSISTENCY_CONFLICT: '最快的路，反而是最稳的。慢慢来，反而更快。',
  THINKING_ACTION_CONFLICT: '你不是不够聪明。你是聪明到把自己困住了。',
  RISK_REWARD_CONFLICT: '好运不会一直站在你这边。是时候建立自己的规则了。',
  STABILITY_GROWTH_CONFLICT: '安全是假象。真正的安全是你有能力应对变化。',
  _DEFAULT: '看清楚自己，比什么都重要。',
}

function run(input) {
  const cc = input.coreContradiction || {}
  const ccCode = cc.code

  const tagline = TAGLINE_MAP[ccCode] || TAGLINE_MAP._DEFAULT
  const verdictExpression = VERDICT_EMOTION_MAP[ccCode] || VERDICT_EMOTION_MAP._DEFAULT

  return createEmotionOutput({
    tagline,
    verdictEnhanced: {
      verdictExpression,
      note: '以上为情绪化表达，原始判决内容不变。',
    },
    gapEnhanced: {
      verdictExpression,
      note: '认知暴击的情绪化重述，事实和逻辑完全不变。',
    },
  })
}

module.exports = { run }
