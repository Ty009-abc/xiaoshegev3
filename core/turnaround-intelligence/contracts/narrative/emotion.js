/**
 * core/turnaround-intelligence/contracts/narrative/emotion.js
 *
 * CP6-E Emotion Contract — 仅可润色表达，不改事实
 *
 * @version 6.3.0
 * @checkpoint CP6-E
 */

function createEmotionOutput({ verdictEnhanced, gapEnhanced, tagline }) {
  if (!tagline) throw new Error('Emotion: tagline required')
  if (!verdictEnhanced) throw new Error('Emotion: verdictEnhanced required')
  if (!gapEnhanced || !gapEnhanced.verdictExpression) throw new Error('Emotion: gapEnhanced required')

  return Object.freeze({
    tagline,
    verdict: Object.freeze({ ...verdictEnhanced }),
    realityGap: Object.freeze({ ...gapEnhanced }),
    rule: '表达可以更有感染力，但事实和推理完全保持不变。',
  })
}

module.exports = { createEmotionOutput }
