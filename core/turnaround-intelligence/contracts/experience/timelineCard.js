/**
 * core/turnaround-intelligence/contracts/experience/timelineCard.js
 *
 * CP6-F Timeline Card Contract — 时间轴卡片
 *
 * @version 6.4.0
 * @checkpoint CP6-F
 */

function createTimelineCardOutput({ version, milestones, startDay }) {
  if (!version) throw new Error('TimelineCard: version required')
  if (!milestones || !Array.isArray(milestones) || milestones.length < 2) {
    throw new Error('TimelineCard: milestones need ≥2')
  }

  for (const m of milestones) {
    if (!m.day || !m.title || !m.successCriteria) throw new Error('TimelineCard: each milestone needs day/title/successCriteria')
  }

  return Object.freeze({
    cardId: 'timeline',
    cardIndex: 5,
    title: '时间轴',
    layout: Object.freeze({
      type: 'TIMELINE_VERTICAL',
      startDay: startDay || 0,
    }),
    milestones: Object.freeze(milestones.map(m => Object.freeze({
      day: m.day,
      title: m.title,
      milestone: m.milestone || '',
      successCriteria: m.successCriteria,
    }))),
  })
}

module.exports = { createTimelineCardOutput }
