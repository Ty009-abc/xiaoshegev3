/**
 * core/turnaround-intelligence/contracts/milestone.js
 *
 * CP6-D Milestone Contract — 从 Roadmap 拆出 ≥3 个里程碑
 *
 * @version 6.2.0
 * @checkpoint CP6-D
 */

function createMilestoneOutput({ version, milestones }) {
  if (!version) throw new Error('Milestones: version required')
  if (!Array.isArray(milestones)) throw new Error('Milestones: milestones must be an array')
  if (milestones.length < 3) throw new Error('Milestones: at least 3 required')

  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i]
    if (typeof m.day !== 'number' || m.day <= 0) {
      throw new Error(`Milestone[${i}]: day must be a positive number`)
    }
    if (!m.target) throw new Error(`Milestone[${i}]: target required`)
    if (typeof m.verification !== 'string') {
      throw new Error(`Milestone[${i}]: verification required`)
    }
    if (!m.phaseLabel) throw new Error(`Milestone[${i}]: phaseLabel required`)
    if (i > 0 && milestones[i].day <= milestones[i - 1].day) {
      throw new Error(`Milestone[${i}]: days must be strictly increasing`)
    }
  }

  return Object.freeze({
    version,
    milestones: Object.freeze(milestones.map(m => Object.freeze({ ...m }))),
  })
}

module.exports = { createMilestoneOutput }
