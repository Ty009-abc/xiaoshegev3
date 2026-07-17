/**
 * tests/diagnosticPromptV4.test.js
 *
 * V4 Diagnostic Prompt 测试 (v3.2 — trimmed & fixed)
 */

const { buildSystemPrompt, buildUserPrompt, buildPersonaSummary } = require('../cloudfunctions/generateAiReport/lib/prompt-v4/diagnosticPromptV4')
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

function makeEngineAndPayload() {
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
  return { er, payload: buildPromptPayload(contract, er) }
}

function makePayload() {
  return makeEngineAndPayload().payload
}

// ═══ SYSTEM PROMPT ═══
test('System prompt — non-empty', () => {
  const p = buildSystemPrompt()
  return typeof p === 'string' && p.length > 300
})

test('System prompt — contains core rules', () => {
  const p = buildSystemPrompt()
  return p.includes('世界运行规则解释者') &&
         p.includes('不得修改任何数字') &&
         p.includes('只输出严格JSON')
})

test('System prompt — contains world view', () => {
  const p = buildSystemPrompt()
  return p.includes('看清系统') && p.includes('寻找杠杆') &&
         p.includes('建立系统') && p.includes('长期复利')
})

test('System prompt — contains wealth stage anchors', () => {
  const p = buildSystemPrompt()
  return p.includes('SURVIVAL') && p.includes('ACCUMULATION') &&
         p.includes('LEVERAGE') && p.includes('FREEDOM')
})

test('System prompt — under 2800 chars', () => {
  const p = buildSystemPrompt()
  console.log('  (' + p.length + ' chars)')
  return p.length <= 2800
})

// ═══ USER PROMPT ═══
test('User prompt — non-empty', () => {
  const { er, payload } = makeEngineAndPayload()
  const p = buildUserPrompt(payload, er)
  return typeof p === 'string' && p.length > 300
})

test('User prompt — contains persona summary', () => {
  const { er, payload } = makeEngineAndPayload()
  const p = buildUserPrompt(payload, er)
  return p.includes('STATUS') && p.includes('MODE') &&
         p.includes('MISTAKE') && p.includes('LEVER') &&
         p.includes('DANGER') && p.includes('BET')
})

test('User prompt — persona summary without engineResult', () => {
  const p = buildUserPrompt(makePayload())
  return typeof p === 'string' && p.length > 300 && !p.includes('STATUS    ')
})

test('Persona summary — standalone function', () => {
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
  const ps = buildPersonaSummary(er)
  console.log('\n  PERSONA:\n  ' + ps.replace(/\n/g, '\n  '))
  return ps.includes('STATUS') && ps.includes('MODE') && ps.includes('MISTAKE')
})

// ═══ PERSONA FIX TESTS ═══

test('Stay-home mom — no "工资安全性/唯一收入是月薪/打工者"', () => {
  const a = {
    diagnosticVersion: 'v4',
    answers: {
      lifeStage: '31-40岁', incomeStructure: '暂时没有收入', occupationDetail: '全职妈妈/家庭管理',
      monthlySurplus: '0-1000元', safetyMonths: '1-3个月', debtPressure: '无负债',
      skillValidation: '从未变现过', monetizableSkill: '无特定变现技能',
      weeklyTime: '5-10小时', executionStability: '偶尔能坚持，但不稳定',
      pastAttemptStage: '还没开始过任何尝试', decisionStyle: '不知道从哪里开始',
      primaryGoal: '搞一份副业收入', maxTrialCost: '1000-5000元', failureResponse: '复盘优化后继续',
    },
  }
  const er = analyze(a)
  const ps = buildPersonaSummary(er)
  const hasSalaryRef = ps.includes('工资安全性') || ps.includes('唯一收入是月薪') || ps.includes('月薪') || ps.includes('高估了工资')
  if (hasSalaryRef) console.log('\n  BAD PERSONA:\n  ' + ps)
  return !hasSalaryRef && ps.includes('暂无稳定收入')
})

test('Content creator — recognizes content/flow semantics', () => {
  const a = {
    diagnosticVersion: 'v4',
    answers: {
      lifeStage: '25-30岁', incomeStructure: '自由职业/不稳定收入', occupationDetail: '内容创作者/短视频',
      monthlySurplus: '0-1000元', safetyMonths: '3-6个月', debtPressure: '无负债',
      skillValidation: '有稳定客户或长期合作', monetizableSkill: '内容类（写作/视频/设计/营销）',
      weeklyTime: '20小时以上', executionStability: '有固定计划，基本能执行',
      pastAttemptStage: '曾在30天内获得过小额收入', decisionStyle: '边上班边小规模测试',
      primaryGoal: '搞一份副业收入', maxTrialCost: '5000-10000元', failureResponse: '复盘优化后继续',
    },
  }
  const er = analyze(a)
  const ps = buildPersonaSummary(er)
  const hasSalaryRef = ps.includes('工资安全性') || ps.includes('唯一收入是月薪') || ps.includes('高估了工资')
  const hasContentRecog = ps.includes('内容') || ps.includes('流量') || ps.includes('出售内容')
  console.log('\n  PERSONA:\n  ' + ps.replace(/\n/g, '\n  '))
  return !hasSalaryRef && hasContentRecog
})

test('Freelancer — no "高估工资安全性"', () => {
  const a = {
    diagnosticVersion: 'v4',
    answers: {
      lifeStage: '25-30岁', incomeStructure: '自由职业/不稳定收入', occupationDetail: '内容创作者',
      monthlySurplus: '0-1000元', safetyMonths: '3-6个月', debtPressure: '无负债',
      skillValidation: '偶尔有付费需求', monetizableSkill: '内容类（写作/视频/设计/营销）',
      weeklyTime: '20小时以上', executionStability: '有固定计划，基本能执行',
      pastAttemptStage: '曾完成过一个完整项目', decisionStyle: '边上班边小规模测试',
      primaryGoal: '搞一份副业收入', maxTrialCost: '1000-5000元', failureResponse: '复盘优化后继续',
    },
  }
  const er = analyze(a)
  const ps = buildPersonaSummary(er)
  const hasSalaryFallback = ps.includes('高估了工资安全性') || ps.includes('高估了工资的安全性')
  if (hasSalaryFallback) console.log('\n  BAD PERSONA:\n  ' + ps)
  return !hasSalaryFallback
})

test('Adequate safety cushion — no "先把安全垫建起来"', () => {
  const a = {
    diagnosticVersion: 'v4',
    answers: {
      lifeStage: '25-30岁', incomeStructure: '工资/固定薪资', occupationDetail: '程序员',
      monthlySurplus: '1000-5000元', safetyMonths: '3-6个月', debtPressure: '无负债',
      skillValidation: '偶尔有付费需求', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '10-20小时', executionStability: '有固定计划，基本能执行',
      pastAttemptStage: '曾在30天内获得过小额收入', decisionStyle: '边上班边小规模测试',
      primaryGoal: '搞一份副业收入', maxTrialCost: '1000-5000元', failureResponse: '复盘优化后继续',
    },
  }
  const er = analyze(a)
  const ps = buildPersonaSummary(er)
  const hasMisplacedBet = ps.includes('先把安全垫建起来')
  if (hasMisplacedBet) console.log('\n  BAD PERSONA:\n  ' + ps)
  return !hasMisplacedBet
})

test('High debt — danger keeps cashflow heal first', () => {
  const a = {
    diagnosticVersion: 'v4',
    answers: {
      lifeStage: '31-40岁', incomeStructure: '工资/固定薪资', occupationDetail: '销售/金融',
      monthlySurplus: '0-1000元', safetyMonths: '1-3个月', debtPressure: '消费贷/信用卡压力较大',
      skillValidation: '从未变现过', monetizableSkill: '无特定变现技能',
      weeklyTime: '少于5小时', executionStability: '偶尔能坚持，但不稳定',
      pastAttemptStage: '坚持不到30天就停了', decisionStyle: '不知道从哪里开始',
      primaryGoal: '开始投资', maxTrialCost: '1000元以下', failureResponse: '很沮丧，暂时不敢再试',
    },
  }
  const er = analyze(a)
  const ps = buildPersonaSummary(er)
  const hasInvestEncouragement = ps.includes('投资翻身')
  const hasDanger = ps.includes('DANGER') && (ps.includes('债务') || ps.includes('利息') || ps.includes('现金流') || ps.includes('前期投入'))
  if (hasInvestEncouragement || !hasDanger) console.log('\n  BAD PERSONA:\n  ' + ps)
  return !hasInvestEncouragement && hasDanger
})

test('Insufficient evidence — allows downsizing, no fabrication', () => {
  // Use a profile with extremely sparse answers
  const a = {
    diagnosticVersion: 'v4',
    answers: {
      lifeStage: '18-24岁', incomeStructure: '暂时没有收入', occupationDetail: '学生',
      monthlySurplus: '0-1000元', safetyMonths: '1-3个月', debtPressure: '无负债',
      skillValidation: '从未变现过', monetizableSkill: '无特定变现技能',
      weeklyTime: '少于5小时', executionStability: '偶尔能坚持，但不稳定',
      pastAttemptStage: '还没开始过任何尝试', decisionStyle: '不知道从哪里开始',
      primaryGoal: '搞一份副业收入', maxTrialCost: '1000元以下', failureResponse: '复盘优化后继续',
    },
  }
  const er = analyze(a)
  const ps = buildPersonaSummary(er)
  // Should not fabricate: must not mention customer/client/market validated
  const hasFabrication = ps.includes('客户稳定') || ps.includes('已验证') || ps.includes('已验证的付费') || ps.includes('市场信号') || ps.includes('有客户')
  if (hasFabrication) console.log('\n  FABRICATED PERSONA:\n  ' + ps)
  return !hasFabrication
})

test('No internal enum leaks in persona summary', () => {
  const { er } = makeEngineAndPayload()
  const ps = buildPersonaSummary(er)
  const forbidden = ['unknown', 'highly_recommended', 'not_recommended', 'undefined', 'null', 'ruleId', 'snake_case']
  for (const token of forbidden) {
    if (ps.includes(token)) {
      console.log('\n  ENUM LEAK in persona: found "' + token + '"')
      return false
    }
  }
  return true
})

test('Persona — under 320 chars', () => {
  const { er } = makeEngineAndPayload()
  const ps = buildPersonaSummary(er)
  console.log('  (' + ps.length + ' chars)')
  return ps.length <= 320
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

test('Prompt token growth — under 35% vs old baseline', () => {
  const oldSP = 1364 // old system prompt from commit 873a2a7 HEAD
  const oldUP = 5063 // ~old user prompt for typical case
  const oldTotal = oldSP + oldUP

  const { er, payload } = makeEngineAndPayload()
  const newSP = buildSystemPrompt().length
  const newUP = buildUserPrompt(payload, er).length
  const newTotal = newSP + newUP
  const growth = Math.round((newTotal / oldTotal - 1) * 100)

  console.log('  OLD:' + oldTotal + ' NEW:' + newTotal + ' GROWTH:+' + growth + '%')
  return growth <= 35
})

// ═══ SUMMARY ═══
console.log('\n' + '='.repeat(60))
console.log('RESULTS: ' + pass + ' pass, ' + fail + ' fail')
console.log('='.repeat(60))
process.exit(fail > 0 ? 1 : 0)
