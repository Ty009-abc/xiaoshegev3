/**
 * tests/contracts/world-rule-raw-to-normalized.test.js
 *
 * 测试：World Rule 原始数据 → Normalized 数据转换完整性。
 * 必须拦截：worldRule=underlyingLogic, reverseLogic 字段丢失, Raw 对象未清理。
 */

const NWC = require('../../contracts/world-rule/normalizedWorldRule.contract.js')
const WRP = require('../../contracts/world-rule/worldRulePoster.contract.js')

let passed = 0; let failed = 0; const failures = []
function test(n, fn) { try { fn(); passed++ } catch(e) { failed++; failures.push(`${n}: ${e.message}`) } }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed') }

test('valid normalized world rule', () => {
  const rule = {
    id:'W001',title:'信息不对称',category:'information',
    worldRule:'信息不对称创造超额利润',
    underlyingLogic:'掌握信息不对称的一方可以获取议价优势',
    reverseLogic:'公众信息不创造溢价',
    realCase:'案例',actionAdvice:'建立信息网络',contentStatus:'FINAL',
  }
  const r = NWC.validateNormalizedWorldRule(rule)
  assert(r.ok, r.errors.join('; '))
})

test('worldRule equals underlyingLogic', () => {
  const rule = {
    id:'W002',title:'test',category:'risk',
    worldRule:'same text',
    underlyingLogic:'same text', // 完全相同 → error
    reverseLogic:'',realCase:'',actionAdvice:'',contentStatus:'DRAFT',
  }
  const r = NWC.validateNormalizedWorldRule(rule)
  assert(!r.ok, 'worldRule=underlyingLogic should be error')
})

test('missing reverseLogic', () => {
  const rule = {
    id:'W003',title:'test',category:'mechanism',
    worldRule:'rule',underlyingLogic:'logic',
    // reverseLogic missing
    realCase:'',actionAdvice:'',contentStatus:'EXPERIMENTAL',
  }
  const r = NWC.validateNormalizedWorldRule(rule)
  assert(!r.ok, 'missing reverseLogic should be error')
})

test('raw object in poster rejected', () => {
  const poster = {
    id:'W004',title:'test',category:'income',
    worldRule:'rule',underlyingLogic:'logic',reverseLogic:'rev',
    realCase:'case',actionAdvice:'advice',
    _raw: { rawData: true }, // 裸数据
  }
  const r = WRP.validateWorldRulePoster(poster)
  assert(!r.ok, 'poster with _raw should fail')
})

test('missing required poster fields', () => {
  const poster = { id:'W005',title:'test' }
  const r = WRP.validateWorldRulePoster(poster)
  assert(!r.ok, 'missing fields should fail poster validation')
})

console.log(`\nWorld Rule Contract Tests: ${passed} passed, ${failed} failed`)
if (failed > 0) { failures.forEach(f => console.log('  FAIL:', f)); process.exit(1) }
else { console.log('ALL WORLD RULE CONTRACT TESTS PASSED'); process.exit(0) }
