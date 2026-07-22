/**
 * core/turnaround-intelligence/contracts/experience/reportComposer.js
 *
 * CP6-F Report Composer Output Contract — 完整报告
 *
 * 这是 V6 最终输出
 *
 * @version 6.4.0
 * @checkpoint CP6-F
 */

const RHYTHM_STEPS = ['shock', 'reflection', 'hope', 'direction', 'action', 'proof']

function createReportOutput({ version, meta, cards, experience, shareVersion, premiumVersion }) {
  if (!version) throw new Error('Report: version required')
  if (!meta) throw new Error('Report: meta required')
  if (!cards || cards.length < 7) throw new Error('Report: need ≥7 cards')
  if (!experience || !experience.readingRhythm) throw new Error('Report: experience.readingRhythm required')

  const rhythm = experience.readingRhythm
  if (rhythm.length !== 6 || !rhythm.every((r, i) => r === RHYTHM_STEPS[i])) {
    throw new Error(`Report: readingRhythm must be [${RHYTHM_STEPS.join(', ')}]`)
  }

  return Object.freeze({
    version,
    meta: Object.freeze({
      generatedAt: meta.generatedAt || new Date().toISOString(),
      decisionVersion: meta.decisionVersion || version,
      pipelineHash: meta.pipelineHash || '',
    }),
    heroCard: cards.find(c => c.cardId === 'hero') || null,
    cards: Object.freeze(cards.map(c => Object.freeze({ ...c }))),
    reportCards: Object.freeze(cards.map(c => Object.freeze({ ...c }))),
    shareVersion: shareVersion ? Object.freeze({ ...shareVersion }) : null,
    premiumVersion: premiumVersion ? Object.freeze({ ...premiumVersion }) : null,
    experience: Object.freeze({
      readingRhythm: Object.freeze([...rhythm]),
      progressiveDisclosure: experience.progressiveDisclosure || false,
      visualHierarchy: experience.visualHierarchy || {
        headline: { size: 32, color: 'Gold' },
        body: { size: 18, color: 'White' },
        explanation: { size: 15, color: 'Gray' },
        evidence: { size: 13, color: 'Gray60' },
      },
      emotionCurve: experience.emotionCurve || RHYTHM_STEPS,
      animationTimeline: experience.animationTimeline || [],
    }),
  })
}

module.exports = { createReportOutput, RHYTHM_STEPS }
