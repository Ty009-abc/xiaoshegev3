/**
 * scripts/test-contracts.js
 *
 * 统一 Contract Tests 入口
 */
const { execSync } = require('child_process')
const path = require('path')

const testsDir = path.resolve(__dirname, '../tests/contracts')
const testFiles = [
  'report-engine-to-contract.test.js',
  'report-contract-to-viewmodel.test.js',
  'report-viewmodel-to-poster.test.js',
  'world-rule-raw-to-normalized.test.js',
  'world-rule-normalized-to-poster.test.js',
  'poster-export-contract.test.js',
]

let totalPass = 0
let totalFail = 0

for (const f of testFiles) {
  const filePath = path.join(testsDir, f)
  try {
    const out = execSync(`node "${filePath}"`, { encoding: 'utf8', timeout: 30000 })
    const match = out.match(/(\d+) passed/)
    if (match) totalPass += parseInt(match[1])
    const fmatch = out.match(/(\d+) failed/)
    if (fmatch) totalFail += parseInt(fmatch[1])
    console.log(`  ✓ ${f} — exit=0`)
  } catch (e) {
    totalFail++
    console.log(`  ✗ ${f} — exit=${e.status}`)
    console.log(e.stdout?.toString().slice(-200) || '')
  }
}

console.log(`\nContract Tests: ${totalPass + totalFail} total — ${totalPass} passed, ${totalFail} failed`)
if (totalFail > 0) process.exit(1)
else process.exit(0)
