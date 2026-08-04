/**
 * scripts/test-impact.js
 *
 * 影响分析测试 — 验证 ci/impact/analyze-impact.js 正常工作
 */
const { execSync } = require('child_process')
const path = require('path')

const analyzerPath = path.resolve(__dirname, '../ci/impact/analyze-impact.js')

try {
  const out = execSync(`node "${analyzerPath}"`, { encoding: 'utf8', timeout: 10000 })
  console.log(out)
  if (out.includes('BLOCKED')) {
    console.log('Impact: BLOCKED')
    process.exit(1)
  }
  console.log('Impact Analysis: PASS')
  process.exit(0)
} catch (e) {
  console.log('Impact Analysis: FAILED')
  console.log(e.stdout?.toString() || e.stderr?.toString() || e.message)
  process.exit(1)
}
