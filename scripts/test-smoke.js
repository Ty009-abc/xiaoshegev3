/**
 * scripts/test-smoke.js
 *
 * Smoke test — 快速验证关键文件存在且语法正确
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const checkFiles = [
  'AGENTS.md',
  'contracts/report/turnaroundReportV4.contract.js',
  'contracts/poster/posterExport.contract.js',
  'tests/contracts/report-engine-to-contract.test.js',
  'tests/regression/report-fixtures-regression.test.js',
]

let passed = 0
let failed = 0

for (const f of checkFiles) {
  const p = path.resolve(__dirname, '..', f)
  if (fs.existsSync(p)) {
    passed++
  } else {
    failed++
    console.log(`  ✗ missing: ${f}`)
  }
}

// Syntax check on contracts
const syntaxFiles = [
  'contracts/report/turnaroundReportV4.contract.js',
  'contracts/report/turnaroundPoster.contract.js',
  'contracts/poster/posterExport.contract.js',
  'contracts/world-rule/normalizedWorldRule.contract.js',
  'contracts/world-rule/worldRulePoster.contract.js',
]
for (const f of syntaxFiles) {
  const p = path.resolve(__dirname, '..', f)
  try {
    execSync(`node --check "${p}"`, { stdio: 'pipe', timeout: 5000 })
    passed++
  } catch (e) {
    failed++
    console.log(`  ✗ syntax error: ${f}`)
  }
}

console.log(`Smoke Tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
else process.exit(0)
