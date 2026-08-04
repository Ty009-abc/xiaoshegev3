/**
 * scripts/test-guardrails.js
 *
 * 全量门禁测试 — 依次执行 Contracts + Fixtures + Regression
 */
const { execSync } = require('child_process')
const path = require('path')

const suites = [
  { name: 'Contract Tests', script: 'test-contracts.js' },
  { name: 'Fixture Tests', script: 'test-fixtures.js' },
  { name: 'Smoke Tests', script: 'test-smoke.js' },
]

let allPassed = 0
let allFailed = 0

for (const s of suites) {
  const p = path.resolve(__dirname, s.script)
  try {
    process.stdout.write(`\n--- ${s.name} ---\n`)
    execSync(`node "${p}"`, { stdio: 'inherit', timeout: 60000 })
    allPassed++
  } catch (e) {
    allFailed++
    console.log(`\n  ${s.name}: FAILED (exit=${e.status})`)
  }
}

console.log(`\n══════════════════════════════════════════`)
console.log(`GUARDRAILS: ${allPassed + allFailed} suites — ${allPassed} passed, ${allFailed} failed`)
if (allFailed > 0) process.exit(1)
else process.exit(0)
