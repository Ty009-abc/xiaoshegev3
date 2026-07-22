/**
 * core/turnaround-intelligence/contracts/narrative/action.js
 *
 * CP6-E Action Contract — 只允许一个 PrimaryAction
 *
 * @version 6.3.0
 * @checkpoint CP6-E
 */

function createActionOutput({ title, why, successCriteria, basedOn }) {
  if (!title) throw new Error('Action: title required')
  if (!why) throw new Error('Action: why required')
  if (!successCriteria) throw new Error('Action: successCriteria required')
  if (!basedOn || !basedOn.milestone) throw new Error('Action: basedOn.milestone required')

  return Object.freeze({
    primaryAction: {
      title,
      why,
      successCriteria,
      basedOn: Object.freeze({ ...basedOn }),
    },
    rule: '只此一项。不需要同时做十件事。先完成这一步，再看下一步。',
  })
}

module.exports = { createActionOutput }
