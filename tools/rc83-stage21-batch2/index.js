/**
 * tools/rc83-stage21-batch2/index.js
 *
 * Stage21 Batch2 public surface (W1 AI authority guard, W2 deterministic
 * fallback, W10 qualification runner). LOCAL_DIRECT / synthetic only.
 * No production access. No real AI API.
 */

'use strict'

module.exports = {
  authorityGuardV21: require('./lib/authorityGuardV21'),
  fallbackAdapterV21: require('./lib/fallbackAdapterV21'),
  renderPipelineV21: require('./lib/renderPipelineV21'),
  qualificationRunner: require('./lib/qualificationRunner'),
  util: require('./lib/util'),
}
