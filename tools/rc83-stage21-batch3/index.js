/**
 * tools/rc83-stage21-batch3/index.js
 *
 * Stage21 Batch3 public surface (W6 cohort assignment, W7 pre-selective gate,
 * W8 rollback tooling + activation plan). LOCAL_DIRECT / synthetic only.
 * No production access. No real production mutation. DRY_RUN by default.
 */

'use strict'

module.exports = {
  cohortAssignment: require('./lib/cohortAssignment'),
  preSelectiveGate: require('./lib/preSelectiveGate'),
  rollbackTooling: require('./lib/rollbackTooling'),
  activationPlan: require('./lib/activationPlan'),
}
