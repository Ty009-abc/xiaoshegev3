'use strict'
// Architecture manifest (P0-A1). Frozen at scaffold time; records canonical
// source locations and the chosen execution architecture.
const path = require('path')

const WORKTREE_ROOT = path.resolve(__dirname, '..', '..', '..')
const E = path.join(WORKTREE_ROOT, 'cloudfunctions', 'generateAiReport', 'lib', 'engine', 'worldModel', 'v2_1')

module.exports = {
  canonicalSha: '0874254ede490d7fef6c20942ff663c0970a445c',
  executionArchitecture: 'LOCAL_DIRECT_ENGINE',

  runtimeAdapterPath: path.join(E, 'runtimeShadowAdapterV21.js'),
  validityEnginePath: path.join(E, 'responseValidityV21.js'),
  questionSourcePath: path.join(E, 'questionnaireV21.js'),

  // Trace builders live inside the runtime adapter (not separate files).
  traceSourcePaths: {
    answerTrace: path.join(E, 'runtimeShadowAdapterV21.js'),
    validityTrace: path.join(E, 'runtimeShadowAdapterV21.js'),
    evidenceTrace: path.join(E, 'runtimeShadowAdapterV21.js'),
  },

  productionTrafficUsed: false,
  productionDbWrites: false,
  inferenceFilesChanged: false,
  gateBProtocolChanged: false,
  primaryModeChanged: false,

  // P0-A3 additions.
  displayPositionCanonicalDomain: { validValues: [0, 1, 2, 3], semantics: '0-based integer render index (R3C)', dynamicByOptionCount: false },
  securityMode: 'INTERNAL_LOCALHOST_ONLY',
}
