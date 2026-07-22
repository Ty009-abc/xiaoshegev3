/**
 * core/turnaround-intelligence/contracts/narrative/timeline.js
 *
 * CP6-E Timeline Contract — 渲染 Milestone 为时间轴
 *
 * @version 6.3.0
 * @checkpoint CP6-E
 */

function createTimelineOutput({ version, timeline }) {
  if (!version) throw new Error('Timeline: version required')
  if (!Array.isArray(timeline) || timeline.length < 2) throw new Error('Timeline: at least 2 entries required')

  for (const t of timeline) {
    if (typeof t.day !== 'number' || t.day <= 0) throw new Error('Timeline: day required')
    if (!t.title) throw new Error('Timeline: title required')
    if (!t.milestone) throw new Error('Timeline: milestone required')
    if (!t.successCriteria) throw new Error('Timeline: successCriteria required')
  }

  return Object.freeze({
    version,
    timeline: Object.freeze(timeline.map(t => Object.freeze({ ...t }))),
  })
}

module.exports = { createTimelineOutput }
