'use strict'
// Minimal boot runner (P0-A1). Loads the harness module and prints HARNESS_BOOT.
// Does NOT run bulk tests, make production requests, or write to any DB.
const path = require('path')

// Canonical V2.1 engine surface (read-only; resolve only, no invocation).
const WORKTREE_ROOT = path.resolve(__dirname, '..', '..', '..')
const ENGINE_V21 = path.join(
  WORKTREE_ROOT,
  'cloudfunctions', 'generateAiReport', 'lib', 'engine', 'worldModel', 'v2_1'
)

const MANIFEST = require('./manifest')

function boot() {
  // Load the harness module surface (resolvable without side effects).
  const adapterPath = MANIFEST.runtimeAdapterPath
  const adapter = require(adapterPath)

  const surface = {
    harness: 'rc83-v21-test-harness',
    stage: 'P0-A1',
    executionArchitecture: MANIFEST.executionArchitecture,
    adapterExports: Object.keys(adapter).sort(),
    productionTrafficUsed: MANIFEST.productionTrafficUsed,
  }

  const ok =
    surface.executionArchitecture === 'LOCAL_DIRECT_ENGINE' &&
    Array.isArray(surface.adapterExports) &&
    surface.adapterExports.includes('runRuntimeShadowV21')

  console.log(JSON.stringify({ HARNESS_BOOT: ok ? 'PASS' : 'FAIL', surface }, null, 2))
  return ok
}

if (require.main === module) {
  process.exit(boot() ? 0 : 1)
}

module.exports = { boot }
