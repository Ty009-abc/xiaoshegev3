/**
 * scripts/test-fixtures.js
 *
 * 统一 Fixture + Regression 测试入口
 */
const { execSync } = require('child_process')
const path = require('path')

const regDir = path.resolve(__dirname, '../tests/regression')
const testFiles = [
  'report-fixtures-regression.test.js',
  'world-rule-fixtures-regression.test.js',
  'poster-data-regression.test.js',
  'semantic-quality-regression.test.js',
]

let totalPass = 0
let totalFail = 0

for (const f of testFiles) {
  const filePath = path.join(regDir, f)
  try {
    const out = execSync(`node "${filePath}"`, { encoding: 'utf8', timeout: 60000 })
    const match = out.match(/(\d+) passed/)
    if (match) totalPass += parseInt(match[1])
    const fmatch = out.match(/(\d+) failed/)
    if (fmatch) totalFail += parseInt(fmatch[1])
    console.log(`  ✓ ${f} — exit=0`)
  } catch (e) {
    totalFail++
    console.log(`  ✗ ${f} — exit=${e.status}`)
    console.log(e.stdout?.toString().slice(-300) || e.stderr?.toString().slice(-300) || '')
  }
}

console.log(`\nFixture Tests: ${totalPass + totalFail} total — ${totalPass} passed, ${totalFail} failed`)
if (totalFail > 0) process.exit(1)
else process.exit(0)
