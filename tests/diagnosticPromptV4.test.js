/**
 * tests/diagnosticPromptV4.test.js
 *
 * V4 Diagnostic Prompt 测试
 */

const { buildSystemPrompt, buildUserPrompt } = require('../cloudfunctions/generateAiReport/lib/prompt-v4/diagnosticPromptV4')
const { buildPromptPayload } = require('../cloudfunctions/generateAiReport/lib/prompt-v4/promptPayloadV4')
const { analyze } = require('../cloudfunctions/generateAiReport/lib/engine/turnaroundEngineV4')
const { mapEngineToReport } = require('../cloudfunctions/generateAiReport/lib/report/reportMapperV4')
const { createReportContract } = require('../cloudfunctions/generateAiReport/lib/report/reportContractV4')

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

function makePayload() {
  const a = {
    diagnosticVersion: 'v4',
    answers: {
      lifeStage: '31-40岁', incomeStructure: '工资/固定薪资', occupationDetail: '程序员',
      monthlySurplus: '1000-5000元', safetyMonths: '3-6个月', debtPressure: '无负债',
      skillValidation: '从未变现过', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '10-20小时', executionStability: '有固定计划，基本能执行',
      pastAttemptStage: '还没开始过任何尝试', decisionStyle: '边上班边小规模测试',
      primaryGoal: '搞一份副业收入', maxTrialCost: '1000-5000元', failureResponse: '复盘优化后继续',
    },
  }
  const er = analyze(a)
  const skeleton = mapEngineToReport(er)
  const contract = createReportContract(er, skeleton)
  return buildPromptPayload(contract, er)
}

// ═══ SYSTEM PROMPT ═══
test('System prompt — non-empty', () => {
  const p = buildSystemPrompt()
  return typeof p === 'string' && p.length > 500
})

test('System prompt — contains core rules', () => {
  const p = buildSystemPrompt()
  return p.includes('认知审判书') &&
         p.includes('不得修改任何数字') &&
         p.includes('不得推荐被引擎标记') &&
         p.includes('只输出严格JSON') &&
         p.includes('禁止使用"加油"')
})

test('System prompt — forbids global patterns', () => {
  const p = buildSystemPrompt()
  return p.includes('"你是一个很优秀的人"') &&
         p.includes('"乾坤未定"') &&
         p.includes('"静待花开"')
})

test('System prompt — contains output format', () => {
  const p = buildSystemPrompt()
  return p.includes('"headline"') &&
         p.includes('"fatalDiagnosis"') &&
         p.includes('"actionPlan"') &&
         p.includes('"finalStrike"')
})

// ═══ USER PROMPT ═══
test('User prompt — non-empty', () => {
  const p = buildUserPrompt(makePayload())
  return typeof p === 'string' && p.length > 300
})

// ═══ PAYLOAD ═══
test('Payload — has all 15 V4 userContext fields', () => {
  const pl = makePayload()
  const keys = Object.keys(pl.userContext)
  const expected = ['lifeStage', 'incomeStructure', 'occupationDetail', 'monthlySurplus',
    'safetyMonths', 'debtPressure', 'skillValidation', 'monetizableSkill', 'weeklyTime',
    'executionStability', 'pastAttemptStage', 'decisionStyle', 'primaryGoal', 'maxTrialCost', 'failureResponse']
  const missing = expected.filter(k => !keys.includes(k))
  if (missing.length) console.log('\n  MISSING:', missing)
  return missing.length === 0
})

test('Payload — does NOT contain openid', () => {
  const pl = makePayload()
  const str = JSON.stringify(pl)
  return !str.includes('openid') && !str.includes('_openid')
})

test('Payload — does NOT contain payment info', () => {
  const pl = makePayload()
  const str = JSON.stringify(pl)
  const forbidden = ['payment', 'transaction', 'prepay_id', 'orderId', 'mchid', 'sign', 'nonceStr']
  for (const f of forbidden) {
    if (str.includes(f)) {
      console.log('\n  FOUND:', f)
      return false
    }
  }
  return true
})

test('Payload — does NOT contain phone/email/realName', () => {
  const pl = makePayload()
  const str = JSON.stringify(pl)
  return !str.includes('phone') && !str.includes('email') && !str.includes('realName')
})

test('Payload — lockedFacts are complete', () => {
  const pl = makePayload()
  const lf = pl.lockedFacts
  if (!lf) return false
  return 'wealthStage' in lf &&
         'scoreCard' in lf &&
         'wealthProbability' in lf &&
         'wealthPathStatus' in lf &&
         Array.isArray(lf.wealthPathStatus) &&
         lf.wealthPathStatus.length === 7
})

test('Payload — writableSchema is present', () => {
  const pl = makePayload()
  const ws = pl.writableSchema
  return ws && ws.headline && ws.actionPlan && ws.finalStrike && ws.identityUpgrade
})

test('Payload — has judgment section', () => {
  const pl = makePayload()
  const j = pl.judgment
  return j && j.wealthStage && j.scores && j.matchedFatalRules !== undefined && j.wealthProbability
})

test('Payload — scores match engine output', () => {
  const a = {
    diagnosticVersion: 'v4',
    answers: {
      lifeStage: '31-40岁', incomeStructure: '工资/固定薪资', occupationDetail: '程序员',
      monthlySurplus: '1000-5000元', safetyMonths: '3-6个月', debtPressure: '无负债',
      skillValidation: '从未变现过', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '10-20小时', executionStability: '有固定计划，基本能执行',
      pastAttemptStage: '还没开始过任何尝试', decisionStyle: '边上班边小规模测试',
      primaryGoal: '搞一份副业收入', maxTrialCost: '1000-5000元', failureResponse: '复盘优化后继续',
    },
  }
  const er = analyze(a)
  const skeleton = mapEngineToReport(er)
  const contract = createReportContract(er, skeleton)
  const pl = buildPromptPayload(contract, er)
  return pl.judgment.scores.cashflow === er.scores.cashflow &&
         pl.judgment.scores.skill === er.scores.skill &&
         pl.judgment.scores.execution === er.scores.execution
})

// ═══ SUMMARY ═══
console.log('\n' + '='.repeat(60))
console.log('RESULTS: ' + pass + ' pass, ' + fail + ' fail')
console.log('='.repeat(60))
process.exit(fail > 0 ? 1 : 0)
