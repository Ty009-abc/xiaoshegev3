/**
 * core/turnaround-intelligence/contracts/experience/heroCard.js
 *
 * CP6-F Hero Card Contract — 命运判决第一页
 *
 * Progressive Disclosure: 渐进披露，第一页只有 headline
 *
 * @version 6.4.0
 * @checkpoint CP6-F
 */

const CARD_SIZES = ['FULL', 'COMPACT', 'TEASER']
const DISPLAY_MODES = ['SHOCK', 'REVEAL', 'EXPLAIN']

function createHeroCardOutput({ version, layout, content, action }) {
  if (!version) throw new Error('HeroCard: version required')
  if (!layout || !CARD_SIZES.includes(layout.size)) throw new Error('HeroCard: invalid layout.size')
  if (!content || !content.headline) throw new Error('HeroCard: content.headline required')
  if (content.headline.length > 35) throw new Error(`HeroCard: headline ≤35 chars, got ${content.headline.length}`)

  return Object.freeze({
    cardId: 'hero',
    cardIndex: 0,
    title: '命运判决',
    layout: Object.freeze({
      size: layout.size,
      displayMode: layout.displayMode || 'SHOCK',
      goldHeadline: true,
    }),
    content: Object.freeze({
      headline: content.headline,
      fullHeadline: content.fullHeadline || content.headline,
      explanation: content.explanation || '',
      confidence: content.confidence,
    }),
    action: Object.freeze({
      label: action ? action.label : '继续查看',
      nextCard: action ? action.nextCard : 'insight',
    }),
    progressiveDisclosure: {
      levels: ['headline', 'explanation', 'evidence'],
      currentLevel: 0,
    },
  })
}

module.exports = { createHeroCardOutput, CARD_SIZES, DISPLAY_MODES }
