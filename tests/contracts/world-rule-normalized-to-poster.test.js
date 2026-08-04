/**
 * tests/contracts/world-rule-normalized-to-poster.test.js
 *
 * 测试：Normalized World Rule → Poster 转换完整性。
 */

const WRP = require('../../contracts/world-rule/worldRulePoster.contract.js')

let passed = 0; let failed = 0; const failures = []
function test(n, fn) { try { fn(); passed++ } catch(e) { failed++; failures.push(`${n}: ${e.message}`) } }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed') }

test('valid world rule poster', () => {
  const poster = {
    id:'W001',title:'信息不对称',category:'information',
    worldRule:'信息不对称创造超额利润',
    underlyingLogic:'掌握信息不对称的一方可以获取议价优势',
    reverseLogic:'公众信息不创造溢价',
    realCase:'案例',actionAdvice:'建立信息网络',
  }
  const r = WRP.validateWorldRulePoster(poster)
  assert(r.ok, r.errors.join('; '))
})

test('worldRule=underlyingLogic in poster rejected', () => {
  const poster = {
    id:'W002',title:'test',category:'risk',
    worldRule:'same text',underlyingLogic:'same text',
    reverseLogic:'',realCase:'',actionAdvice:'',
  }
  const r = WRP.validateWorldRulePoster(poster)
  assert(!r.ok, 'poster with worldRule=underlyingLogic should fail')
})

test('missing worldRule in poster', () => {
  const poster = {
    id:'W003',title:'test',category:'skill',
    underlyingLogic:'logic',reverseLogic:'rev',realCase:'case',actionAdvice:'advice',
  }
  const r = WRP.validateWorldRulePoster(poster)
  assert(!r.ok, 'missing worldRule should fail')
})

console.log(`\nWorld Rule→Poster Tests: ${passed} passed, ${failed} failed`)
if (failed > 0) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1) }
else { console.log('ALL WORLD RULE→POSTER TESTS PASSED'); process.exit(0) }
