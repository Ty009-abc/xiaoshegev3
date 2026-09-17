'use strict'
/**
 * tests/v6/thesis/rc8.4-v6-r73-minimal-hard-ban-repair.test.js
 *
 * RC8.4 V6 R73 — MINIMAL HARD BAN REPAIR (narrow fix of three weaknesses ONLY):
 *   1. FABRICATED_INCOME       generic income TYPE must not authorize an AMOUNT claim
 *   2. GUARANTEED_OUTCOME      guarantee token + outcome class coverage
 *   3. FABRICATED_CUSTOMER     existence/history assertion (NOT forward hypothesis)
 *
 * R70 philosophy preserved: MINIMAL HARD BANS ONLY (7). No style/lexical blocks.
 * FACT-vs-HYPOTHESIS boundary is mandatory:
 *   BLOCK "你已经有 X" / "你赚 X"   ALLOW "你可以面向 X" / "下一步做到 X"
 */

const path = require('path')
const ROOT = path.resolve(__dirname, '..', '..', '..')
const V = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6/thesis')
const { runHybridDiagnosisV6 } = require(path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6/hybrid/hybridDiagnosisV6.js'))
const { buildV4RestoredPayload } = require(path.join(V, 'v4RestoredContextV6.js'))
const { validateV4Restored, BLOCKING_REASON_CODES, HARD_BAN_COUNT } = require(path.join(V, 'v4RestoredValidatorV6.js'))

let pass = 0, fail = 0
const results = []
function ok (name, cond, extra) {
  if (cond) { pass++; results.push('  PASS ' + name) }
  else { fail++; results.push('  FAIL ' + name + (extra ? ' :: ' + extra : '')) }
}

// Owner R66/R69 exact class (NO_PRIMARY, PAID_ONCE, no occupation, salary structure).
const OWNER = {
  lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', occupationDetail: '',
  monthlySurplus: 'SURPLUS_1K_5K', safetyMonths: 'SAFETY_3_6', debtPressure: 'DEBT_NONE',
  skillValidation: 'PROOF_PAID_ONCE', monetizableSkill: 'ASSET_CONTENT', weeklyTime: 'TIME_20_PLUS',
  executionStability: 'EXEC_VOLATILE', pastAttemptStage: 'ATTEMPT_NONE', selfBelief: 'BELIEF_KNOW_NO_ACTION',
  decisionStyle: 'DECISION_ALL_IN', timeBehavior: 'TIME_BALANCE', primaryProblem: 'PROBLEM_MONETIZE',
  primaryGoal: 'GOAL_SKILL_MONETIZE', maxTrialCost: 'COST_5K_20K', failureResponse: 'FAIL_GIVE_UP'
}
const o = runHybridDiagnosisV6(OWNER)
const payload = buildV4RestoredPayload(o.hybridProfile, o.diagnosis, o.hybridContext)

// Build a full output whose visible text is exactly `t` (card01), or spread across fields.
const mk = (t) => ({
  strategicThesis: { identityInterpretation: 'i', coreContradiction: 'c', systemTrap: 's', worldRule: 'w', strategicMigration: { from: 'f', to: 't', steps: ['a'] }, commercialThesis: { objective: 'o' } },
  cards: { card01: t, card02: 'x', card03: ['a'], card04: { from: 'f', to: 't', steps: ['a'] }, card05: { objective: 'o', actions: ['a'], target: 'g', timebox: 'b', successSignal: 's' } }
})
const blocks = (t, code) => validateV4Restored(mk(t), payload).blocking.indexOf(code) !== -1

async function main () {
  // ═══ §2 PHILOSOPHY: no style/lexical blocking rules ═══
  const bold = ['你一直在骗自己：你不是没时间，是不敢把能力明码标价。', '你把能力攥在手里，市场永远不会自己找上门。', '你不是能力不够，是把能力一直攥在手里没敢标价。', '你的价值位置不是"有技能的人"，而是"有产品的人"。', '你活在一个自己设计的困局里，而这个困局正在悄悄吃掉你的时间。']
  let styleBlocked = 0
  for (const b of bold) if (validateV4Restored(mk(b), payload).blocking.length) styleBlocked++
  ok('R73 §2 STYLE_BLOCKING_RULE_COUNT = 0', styleBlocked === 0, 'blocked=' + styleBlocked)

  // ═══ §3 FABRICATED_INCOME — must block specific unsupported amounts ═══
  const incomeMustBlock = [
    '你月薪30000', '你每月收入3万', '你年收入36万', '你月入三万', '你每个月赚两万', '你工资是25000',
    '你的月收入大概是2万', '你现在月入10k', '你月薪两万五', '你月收入有12000元'
  ]
  let incomeBlockHits = 0
  for (const s of incomeMustBlock) if (blocks(s, 'FABRICATED_INCOME')) incomeBlockHits++
  ok('R73 §3 specific income amounts blocked', incomeBlockHits === incomeMustBlock.length, incomeBlockHits + '/' + incomeMustBlock.length)
  ok('R73 §3 CHINESE_NUMERIC_INCOME_SUPPORTED (三万/两万五)', blocks('你月薪三万', 'FABRICATED_INCOME') && blocks('你月薪两万五', 'FABRICATED_INCOME'))

  // ═══ §4 ALLOWED INCOME INFERENCE — qualitative reading is fine ═══
  const qualitativeOK = ['你主要依赖工资', '你的收入结构单一', '工资仍是你的安全垫', '你现在靠一份固定工资生活', '你的收入来源只有一条']
  let qualBlocked = 0
  for (const s of qualitativeOK) if (validateV4Restored(mk(s), payload).blocking.length) qualBlocked++
  ok('R73 §4 SUPPORTED_QUALITATIVE_INCOME_INTERPRETATION_PASS', qualBlocked === 0, 'blocked=' + qualBlocked)

  // ═══ §5 KNOWN RANGE handling — surplus/budget/safety/debt are not income ═══
  const crossField = ['你每月结余1000到5000元', '你的试错预算是20000元', '你的存款能撑3到6个月', '你目前没有负债', '你能承受50000元的试错成本',
    '你只有一份工资，结余1000-5000，存款撑3-6个月', '你月结余3000元左右', '你的预算大概在5000以内', '你手上存款不多，大概两万', '你的房贷每月要还8000']
  let crossLeak = 0
  for (const s of crossField) if (validateV4Restored(mk(s), payload).blocking.indexOf('FABRICATED_INCOME') !== -1) crossLeak++
  ok('R73 §5 CROSS_FIELD_NUMERIC_AUTHORITY_LEAK_COUNT = 0', crossLeak === 0, 'leaks=' + crossLeak)

  // ═══ §6 GUARANTEED_OUTCOME — coverage ═══
  const guaranteeMustBlock = ['保证你成功', '保证你月入十万', '一定能赚到钱', '你肯定会月入3万', '照做必然翻身', '确保你赚钱', '包你月入过万', '保准你成功', '你必定会发财', '管保你翻身', '肯定能赚到钱', '你一定实现收入目标']
  let gBlockHits = 0
  for (const s of guaranteeMustBlock) if (blocks(s, 'GUARANTEED_OUTCOME')) gBlockHits++
  ok('R73 §6 guarantee outcomes blocked', gBlockHits === guaranteeMustBlock.length, gBlockHits + '/' + guaranteeMustBlock.length)

  // ═══ §7 GUARANTEE FALSE-POSITIVE CONTROL — strong non-guarantee wording allowed ═══
  const strongOK = ['你一定要停止免费帮忙', '这一步一定要真实报价', '市场一定会给你反馈', '你必须在30天内完成第一次交付', '务必本周发出第一条付费邀请', '切记不要等到准备好', '这次一定要把定价写出来', '你不能再回避定价了', '需要立刻开始交付', '一定要向陌生人开口收钱']
  let strongBlocked = 0
  for (const s of strongOK) if (validateV4Restored(mk(s), payload).blocking.indexOf('GUARANTEED_OUTCOME') !== -1) strongBlocked++
  ok('R73 §7 STRONG_INSTRUCTION_FALSE_BLOCK_COUNT = 0', strongBlocked === 0, 'blocked=' + strongBlocked)

  // ═══ §8 FABRICATED_CUSTOMER — existence/history assertion blocks ═══
  const customerMustBlock = ['你已经有了一批稳定客户', '你已经有一批稳定客户', '你已经有稳定客户', '你手上有固定客户', '你积累了长期客户', '你拥有付费客户', '你已经服务过企业客户', '你目前有一群客户', '你已经有复购客户了', '你手头有一批老客户']
  let custBlockHits = 0
  for (const s of customerMustBlock) if (blocks(s, 'FABRICATED_CUSTOMER')) custBlockHits++
  ok('R73 §8 existing-customer assertions blocked', custBlockHits === customerMustBlock.length, custBlockHits + '/' + customerMustBlock.length)

  // ═══ §9 CUSTOMER HYPOTHESIS must remain allowed ═══
  const custHypoOK = ['你的目标客户可以是小商家', '可以先找3个潜在客户', '适合服务需要内容的小团队', '下一步去接触第一批客户', '你可以面向有内容需求的商家', '优先服务预算有限的小团队', '试着找到第一个愿意付费的客户', '你可以把本地小店当作目标客户']
  let custHypoBlocked = 0
  for (const s of custHypoOK) if (validateV4Restored(mk(s), payload).blocking.indexOf('FABRICATED_CUSTOMER') !== -1) custHypoBlocked++
  ok('R73 §9 CUSTOMER_HYPOTHESIS_FALSE_BLOCK_COUNT = 0', custHypoBlocked === 0, 'blocked=' + custHypoBlocked)

  // ═══ §7b ILLEGAL false-positive control — contrastive topic word is not an instruction ═══
  const illegalContrastive = ['这不是赌博，而是一次可承受的商业实验。', '别把它当成赌博，先做一次小额测试。', '你要远离赌博式的一次性投入。']
  let illegalFP = 0
  for (const s of illegalContrastive) if (validateV4Restored(mk(s), payload).blocking.indexOf('ILLEGAL_CONTENT') !== -1) illegalFP++
  ok('R73 §7b contrative illegal-topic NOT blocked', illegalFP === 0, 'blocked=' + illegalFP)

  // ═══ §10 FACT vs HYPOTHESIS boundary ═══
  ok('R73 §10 BLOCK "你已经有3个稳定客户"', blocks('你已经有3个稳定客户。', 'FABRICATED_CUSTOMER'))
  ok('R73 §10 ALLOW "试着拿到你的前3个稳定客户"', validateV4Restored(mk('试着拿到你的前3个稳定客户。'), payload).blocking.indexOf('FABRICATED_CUSTOMER') === -1)
  ok('R73 §10 BLOCK "你月入3万"', blocks('你月入3万。', 'FABRICATED_INCOME'))
  ok('R73 §10 ALLOW "下一步做到月入3万"', validateV4Restored(mk('下一步做到月入3万。'), payload).blocking.indexOf('FABRICATED_INCOME') === -1)

  // ═══ §12 ORIGINAL 9-CONTROL REPLAY (from R72 §6) ═══
  const replay = [
    ['你是一个资深后端程序员，每天和代码打交道。', 'FABRICATED_OCCUPATION'],
    ['你是一名注册会计师，已在这个行业干了十年。', 'FABRICATED_OCCUPATION'],
    ['你月薪三万，其实早就衣食无忧了。', 'FABRICATED_INCOME'],
    ['你已经有了一批稳定客户在排队等你交付。', 'FABRICATED_CUSTOMER'],
    ['你持有注册会计师执照和多年从业资历。', 'FABRICATED_CREDENTIAL'],
    ['你过去曾在一家大厂工作过很多年。', 'FABRICATED_HISTORY'],
    ['照这个方法做，你一定能赚到钱。', 'GUARANTEED_OUTCOME'],
    ['只要你坚持，保证你月入十万。', 'GUARANTEED_OUTCOME'],
    ['先刷单把数据做起来，再想办法虚开发票过账。', 'ILLEGAL_CONTENT']
  ]
  let replayOK = 0
  const replayLines = []
  replay.forEach(([text, expect], i) => {
    const v = validateV4Restored(mk(text), payload)
    const got = expect ? (v.blocking.indexOf(expect) !== -1) : true
    if (got) replayOK++
    replayLines.push('    ' + (got ? 'OK  ' : 'BAD ') + '#' + (i + 1) + ' expect=' + (expect || 'BLOCK(any)') + ' actual=' + JSON.stringify(v.blocking))
  })
  ok('R73 §12 R70_HARD_BAN_CONTROL_PASS = 9/9', replayOK === 9, replayOK + '/9')

  // ═══ §13 ADVERSARIAL MATRIX — 0 false negatives ═══
  const advIncome = [
    '你月薪30000', '你月薪三万', '你每月收入3万', '你年收入36万', '你月入三万', '你每个月赚两万',
    '你工资是25000', '你月收入12000元', '你现在月入10k', '你一年能挣50万', '你收入达到3万一个月',
    '你的月薪是两万五', '你每月净收入4万', '你到手工资18000', '你一年收入六十万', '你现在赚3万一个月',
    '你月薪20k', '你的收入是5万每月', '你一个月挣一万五', '你现在年入100万'
  ]
  const advGuarantee = [
    '保证你成功', '保证你月入十万', '一定能赚到钱', '你肯定会月入3万', '照做必然翻身', '确保你赚钱',
    '包你月入过万', '保准你成功', '你必定会发财', '管保你翻身', '肯定能赚到钱', '你一定实现收入目标',
    '稳赚不赔', '保证你能月入5万', '照这个做必然成功'
  ]
  const advCustomer = [
    '你已经有了一批稳定客户', '你已经有一批稳定客户', '你已经有稳定客户', '你手上有固定客户',
    '你积累了长期客户', '你拥有付费客户', '你已经服务过企业客户', '你目前有一群客户', '你已经有复购客户了',
    '你手头有一批老客户', '你已经发展出稳定客户群', '你维护着一批长期客户', '你现在有一批客户',
    '你已经有长期合作客户', '你已经拥有一群付费客户'
  ]
  const fnOf = (list, code) => list.filter((s) => !blocks(s, code))
  const fnAll = fnOf(advIncome, 'FABRICATED_INCOME').concat(fnOf(advGuarantee, 'GUARANTEED_OUTCOME'), fnOf(advCustomer, 'FABRICATED_CUSTOMER'))
  ok('R73 §13 ADVERSARIAL_FALSE_NEGATIVE_COUNT = 0', fnAll.length === 0, JSON.stringify(fnAll))
  // illegal must still block as an instruction, and must survive punctuation/synonyms
  ok('R73 §13 illegal instruction blocks', blocks('先刷单把销量做起来，再走灰色渠道过账。', 'ILLEGAL_CONTENT') && blocks('通过传销拉人头快速回本。', 'ILLEGAL_CONTENT') && blocks('用套现的方式周转。', 'ILLEGAL_CONTENT') && blocks('建议去赌博赚快钱。', 'ILLEGAL_CONTENT') && blocks('靠赌博回本。', 'ILLEGAL_CONTENT'))

  // ═══ §14 FALSE-POSITIVE MATRIX — 0 false positives ═══
  const fpIncome = ['你主要依赖工资', '你的收入结构单一', '工资仍是你的安全垫', '你现在靠一份固定工资生活', '你的收入来源只有一条', '收入不稳定让你难以规划', '工资是你的唯一缓冲', '你的主要收入来自一份工作', '你对收入的依赖很集中', '现金流主要靠工资支撑',
    '月收入达到3000-5000元', '月独立收入达到3000元以上', '争取半年内月收入到5000', '目标是把月收入做到1万', '你的目标客户月均预算5000元', '你每月可支配时间20小时']
  const fpStrong = ['你一定要停止免费帮忙', '这一步一定要真实报价', '市场一定会给你反馈', '你必须在30天内完成第一次交付', '务必本周发出第一条付费邀请', '切记不要等到准备好', '这次一定要把定价写出来', '你不能再回避定价了', '需要立刻开始交付', '一定要向陌生人开口收钱']
  const fpCustomer = ['你的目标客户可以是小商家', '可以先找3个潜在客户', '适合服务需要内容的小团队', '下一步去接触第一批客户', '你可以面向有内容需求的商家', '优先服务预算有限的小团队', '试着找到第一个愿意付费的客户', '你可以把本地小店当作目标客户', '争取拿到第一个付费客户', '计划接触10个潜在客户']
  const fpOf = (list, code) => list.filter((s) => validateV4Restored(mk(s), payload).blocking.indexOf(code) !== -1)
  const fpAll = fpOf(fpIncome, 'FABRICATED_INCOME').concat(fpOf(fpStrong, 'GUARANTEED_OUTCOME'), fpOf(fpCustomer, 'FABRICATED_CUSTOMER'))
  ok('R73 §14 FALSE_POSITIVE_COUNT = 0', fpAll.length === 0, JSON.stringify(fpAll))

  // ═══ §15 R70 PRODUCT-COPY REPLAY (A/B/C accepted outputs) ═══
  let abc
  try { abc = require('/tmp/r70/real_provider_readback.json') } catch (e) { abc = null }
  if (abc) {
    const toInput = (rep) => {
      const rs = rep.renderStrategy || {}
      return { strategicThesis: { identityInterpretation: rs.identityInterpretation || '', coreContradiction: rs.coreContradiction || '', systemTrap: rs.systemTrap || '', worldRule: rs.worldRule || '', strategicMigration: rs.migration || { from: '', to: '', steps: [] }, commercialThesis: rs.commercialThesis || {} }, cards: { card01: rep.card01, card02: rep.card02, card03: rep.card03, card04: rep.card04, card05: rep.card05 } }
    }
    const vA = validateV4Restored(toInput(abc.cases.A.report), payload)
    const vB = validateV4Restored(toInput(abc.cases.B.report), payload)
    const vC = validateV4Restored(toInput(abc.cases.C.report), payload)
    ok('R73 §15 A_BLOCKING_COUNT = 0', vA.blocking.length === 0, JSON.stringify(vA.blocking))
    ok('R73 §15 B_BLOCKING_COUNT = 0', vB.blocking.length === 0, JSON.stringify(vB.blocking))
    ok('R73 §15 C_BLOCKING_COUNT = 0', vC.blocking.length === 0, JSON.stringify(vC.blocking))
  } else {
    results.push('  SKIP R73 §15 (no /tmp/r70/real_provider_readback.json)')
  }

  // ═══ §16 HARD BAN SET SIZE (unchanged) ═══
  ok('R73 §16 HARD_BAN_CATEGORY_COUNT unchanged (7)', HARD_BAN_COUNT === 7 && BLOCKING_REASON_CODES.length === 7)

  console.log(results.join('\n'))
  if (replayLines.length) console.log('\nR73 §12 replay detail:\n' + replayLines.join('\n'))
  console.log('\nR73 TESTS: ' + pass + ' passed, ' + fail + ' failed')
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error('R73 TEST ERROR', e); process.exit(2) })
