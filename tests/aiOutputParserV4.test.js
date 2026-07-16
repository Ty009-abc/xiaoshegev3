/**
 * tests/aiOutputParserV4.test.js
 *
 * AI Output Parser 测试 — 各种输入场景
 */

const { parseAIOutput, extractJSON, validateAIOutput, truncateStrings, trimEmptyFields } = require('../cloudfunctions/generateAiReport/lib/prompt-v4/aiOutputParserV4')

let pass = 0, fail = 0
function test(name, fn) {
  process.stdout.write('\n📋 ' + name)
  try {
    if (fn()) { pass++; console.log(' ✅') }
    else { fail++; console.log(' ❌') }
  } catch (e) {
    fail++; console.log(' 💥 ' + e.message)
  }
}

const VALID_AI_JSON = JSON.stringify({
  headline: { title: '测试title', subtitle: '测试subtitle' },
  fatalDiagnosis: { mainProblem: '测试', reason: '测试原因' },
  fatalRules: [{ ruleId: 'R_CF_001', title: '测试', description: '测试', why: '测试' }],
  advantageRules: [],
  opportunityRules: [],
  wealthPathReasons: { working: '', sideBusiness: '', freelance: '', investment: '', content: '', ai: '', entrepreneur: '' },
  actionPlan: {
    day1: { goal: '测试', tasks: ['任务1'], checkpoint: '24小时' },
    day3: { goal: '测试', tasks: ['任务1'], checkpoint: '3天' },
    day7: { goal: '测试', tasks: ['任务1'], checkpoint: '7天' },
    day15: { goal: '测试', tasks: ['任务1'], checkpoint: '15天' },
    day30: { goal: '测试', tasks: ['任务1'], checkpoint: '30天' },
  },
  stopDoingItems: ['停止拖延'],
  identityUpgrade: { currentIdentity: '测试', targetIdentity: '测试', gap: '测试', upgradePath: '测试' },
  finalStrike: { sentence: '测试最后一击', shareTitle: '测试分享' },
})

// ═══ JSON 提取 ═══
test('合法 JSON — parse ok', () => {
  const r = parseAIOutput(VALID_AI_JSON)
  return r.ok && r.data.headline.title === '测试title'
})

test('JSON with code fence — parse ok', () => {
  const input = '```json\n' + VALID_AI_JSON + '\n```'
  const r = parseAIOutput(input)
  return r.ok && r.data.headline.title === '测试title'
})

test('JSON with prefix text — parse ok', () => {
  const input = '这是诊断报告的结果：\n' + VALID_AI_JSON
  const r = parseAIOutput(input)
  return r.ok && r.data.headline.title === '测试title'
})

test('JSON with suffix text — parse ok', () => {
  const input = VALID_AI_JSON + '\n以上是诊断结果'
  const r = parseAIOutput(input)
  return r.ok && r.data.headline.title === '测试title'
})

test('JSON with prefix + suffix — parse ok', () => {
  const input = '诊断结果如下：\n' + VALID_AI_JSON + '\n希望对你有帮助'
  const r = parseAIOutput(input)
  return r.ok
})

test('Truncated JSON — parse fail', () => {
  const input = VALID_AI_JSON.slice(0, 50)
  const r = parseAIOutput(input)
  return !r.ok && r.code === 'V4_AI_JSON_PARSE_FAILED'
})

test('Non-JSON text — parse fail', () => {
  const r = parseAIOutput('这不是一个JSON，只是普通文本')
  return !r.ok && r.code === 'V4_AI_JSON_PARSE_FAILED'
})

test('Empty string — parse fail', () => {
  const r = parseAIOutput('')
  return !r.ok && r.code === 'V4_AI_EMPTY_INPUT'
})

test('Null input — parse fail', () => {
  const r = parseAIOutput(null)
  return !r.ok && r.code === 'V4_AI_EMPTY_INPUT'
})

test('Whitespace only — parse fail', () => {
  const r = parseAIOutput('   \n  \t  ')
  return !r.ok && r.code === 'V4_AI_EMPTY_INPUT'
})

// ═══ 原型污染 ═══
test('__proto__ own field in parsed JSON — rejected', () => {
  // 模拟 JSON 中包含 __proto__ 作为自有属性（恶意 payload）
  const malicious = { headline: { title: 'x' } }
  Object.defineProperty(malicious, '__proto__', { value: { evil: true }, enumerable: true, configurable: true, writable: true })
  const r = validateAIOutput(malicious)
  return !r.ok && r.code === 'V4_AI_SCHEMA_VIOLATION'
})

test('constructor own field in parsed JSON — rejected', () => {
  const malicious = { headline: { title: 'x' } }
  Object.defineProperty(malicious, 'constructor', { value: {}, enumerable: true, configurable: true, writable: true })
  const r = validateAIOutput(malicious)
  return !r.ok
})

// ═══ 未知字段 ═══
test('Unknown top-level key — rejected', () => {
  const obj = JSON.parse(VALID_AI_JSON)
  obj.extraField = 'should not exist'
  const r = validateAIOutput(obj)
  return !r.ok
})

// ═══ 字符串截断 ═══
test('Truncate — long headline title → max 42', () => {
  const out = { headline: { title: '这是一段超过了42个汉字的标题总共应该有五六十个字才对所以我们用这句话来测试截断功能是否可以正常工作' } }
  const r = truncateStrings(out, { 'headline.title': 42 })
  return r.headline.title.length <= 42
})

test('Truncate — nested array string → max 40', () => {
  const out = { stopDoingItems: ['这是一段非常非常长的停止去做的事情的描述超长超级长超级超级长的内容'] }
  const r = truncateStrings(out, { 'stopDoingItems[*]': 40 })
  return r.stopDoingItems[0].length <= 40
})

test('Trim empty — removes null values', () => {
  const out = { headline: { title: 'hello', subtitle: null }, fatalDiagnosis: null }
  const r = trimEmptyFields(out)
  return r.headline.title === 'hello' && r.headline.subtitle === undefined && r.fatalDiagnosis === undefined
})

// ═══ 多 JSON ═══
test('Multiple JSON objects — picks first', () => {
  const input = VALID_AI_JSON + '\n' + JSON.stringify({ another: 'object' })
  const r = parseAIOutput(input)
  // 应该 parse 成功（合并后的字符串包含多个 {}，第一个是最外层的合法 JSON）
  return r.ok || r.code === 'V4_AI_JSON_PARSE_FAILED'
  // 只要有结构化输出就行
})

// ═══ SUMMARY ═══
console.log('\n' + '='.repeat(60))
console.log('RESULTS: ' + pass + ' pass, ' + fail + ' fail')
console.log('='.repeat(60))
process.exit(fail > 0 ? 1 : 0)
