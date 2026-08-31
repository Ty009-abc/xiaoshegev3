'use strict'
// Harness CLI. Only run-1 is exercised in P0-A3; the rest are wired but never
// auto-run.
const { modeRunOne, modeRun100, modeDeterminism, modeNegative, modeStress } = require('./core/modes')

const MODES = {
  'run-1': modeRunOne,
  'run-100': modeRun100,
  'determinism': modeDeterminism,
  'negative': modeNegative,
}

async function main() {
  const arg = process.argv[2] || 'run-1'
  let out
  if (arg.startsWith('stress')) {
    const n = arg.includes(':') ? parseInt(arg.split(':')[1], 10) : 500
    out = await modeStress(n)
  } else if (MODES[arg]) {
    out = await MODES[arg]()
  } else {
    console.error('unknown mode: ' + arg)
    process.exit(2)
  }
  console.log(JSON.stringify(out, null, 2))
}

if (require.main === module) {
  main().catch((e) => { console.error(e.stack || e); process.exit(1) })
}

module.exports = { main, MODES }
