'use strict'
/**
 * tests/v6/thesis/rc8.4-v6-r75-report-compression.test.js
 *
 * RC8.4 V6 R75 — REPORT COMPRESSION + CARD HIERARCHY.
 *
 * Proves the R70/R73 brain is PRESERVED while the USER-VISIBLE five cards are
 * compressed deterministically (post-thesis, NO second model call):
 *   CARD01 <=40  CARD02 <=140  CARD03 <=220 (<=3 bullets)  CARD04 <=160
 *   CARD05 <=240 (<=3 actions: goal + ACTION 1/2/3 + 验收标准)
 * Plus: questionnaire-fact repetition <=2, no cross-card duplicate sentences,
 * strategicThesis full depth preserved, duplicate constraint render = 0.
 *
 * Deterministic. No network.
 */

const path = require('path')
const ROOT = path.resolve(__dirname, '..', '..', '..')
const V = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6/thesis')
const { runHybridDiagnosisV6 } = require(path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6/hybrid/hybridDiagnosisV6.js'))
const { buildReportV6 } = require(path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6/report/reportBuilderV6.js'))
const { normalizeV4RestoredOutput } = require(path.join(V, 'v4RestoredAdapterV6.js'))
const { mapV4RestoredToReport } = require(path.join(V, 'v4RestoredReportRuntimeV6.js'))
const { compressVisibleCards, BUDGET, charLen, FACT_MARKERS } = require(path.join(V, 'v4RestoredCompressV6.js'))

let pass = 0, fail = 0
const results = []
function ok (name, cond, extra) {
  if (cond) { pass++; results.push('  PASS ' + name) }
  else { fail++; results.push('  FAIL ' + name + (extra ? ' :: ' + extra : '')) }
}

const OWNER = {
  lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', occupationDetail: '',
  monthlySurplus: 'SURPLUS_1K_5K', safetyMonths: 'SAFETY_3_6', debtPressure: 'DEBT_NONE',
  skillValidation: 'PROOF_PAID_ONCE', monetizableSkill: 'ASSET_CONTENT', weeklyTime: 'TIME_20_PLUS',
  executionStability: 'EXEC_VOLATILE', pastAttemptStage: 'ATTEMPT_NONE', selfBelief: 'BELIEF_KNOW_NO_ACTION',
  decisionStyle: 'DECISION_ALL_IN', timeBehavior: 'TIME_BALANCE', primaryProblem: 'PROBLEM_MONETIZE',
  primaryGoal: 'GOAL_SKILL_MONETIZE', maxTrialCost: 'COST_5K_20K', failureResponse: 'FAIL_GIVE_UP'
}

// An OVER-BUDGET, fact-repeating output (mirrors the real long R74 shape).
const OVERBUDGET = {
  strategicThesis: {
    identityInterpretation: '你的价值位置不是"有技能的人"，而是"有产品的人"。',
    coreContradiction: '你不是没本事，你是一直没让本事反复接受市场检验。',
    systemTrap: '工资提供稳定现金流，也给了他"还有时间"的错觉；内容能力被付过一次钱，证明市场有入口，但一次交易不等于生意；他用全押或放弃的二元决策回避小步试错，用生活和工作平衡稀释可支配时间。结果是：能力始终停在"作品/技能"层，没有变成"报价—成交—交付—复购"的闭环。',
    worldRule: '市场不为潜力付费，只为被明确包装、被反复交付、被信任累积的解决方案付费。',
    strategicMigration: { from: '有内容能力、被付过一次钱、靠工资兜底的潜在创作者', to: '有一个可重复售卖的内容服务或产品、能持续获得市场反馈的独立经营者', steps: ['拆解交付', '重新定价', '固定复购'] },
    commercialThesis: { objective: '把内容创作能力变成至少一条不依赖工资的、可重复的收入流。' }
  },
  cards: {
    card01: '你不是没本事，你是一直没让本事反复接受市场检验。同时你也一直靠一份工资兜底，每月结余1000到5000元，存款能撑3到6个月，每周有20小时自由时间。',
    card02: '你现在的身份是"靠工资兜底、被付过一次钱的内容创作者"，不是"有稳定变现系统的经营者"。一次付费证明市场有入口，但入口不等于生意。你真正缺的不是能力，是把能力变成报价、交付、复购的动作系统。31-40岁、每月结余1000到5000元、存款能撑3到6个月、每周20小时、能承受5000到20000元试错——这些条件足够你启动。',
    card03: [
      '工资给你安全感，也让你觉得还有时间，于是真实商业动作一直被推迟。',
      '被付过一次钱后，你没有把它变成可重复的报价和交付流程，能力停在作品层。',
      '全押或放弃的决策方式，让你回避小步试错，也回避了市场反馈。',
      '每周20小时自由时间被"平衡"稀释，没有固定投入变现实验。',
      '执行不稳定不是原因，是结果：没有小目标、短周期、可验证的成功信号。'
    ],
    card04: { from: '有内容能力、被付过一次钱、靠工资兜底的潜在创作者', to: '有一个可重复售卖的内容服务或产品、能持续获得市场反馈的独立经营者', steps: ['拆解', '定价', '复购'] },
    card05: {
      objective: '未来12个月，把内容创作能力变成至少一条不依赖工资的、可重复的收入流。',
      actions: [
        '写下3个你被付过费或有人咨询过的内容服务，选一个最具体的，做成一句话报价。',
        '每周拿出10小时，在公开平台发布"过程+案例+方法"，并主动私信5个潜在买家。',
        '用5000元以内预算做小测试：低价诊断、单次代写或小批量交付，目标不是赚钱，是拿到反馈。',
        '每次交付后追问买家：还需要什么、愿不愿复购、愿不愿转介绍。',
        '把重复出现的需求做成模板、清单或月度服务，降低下次交付成本。'
      ],
      target: '每周20小时', timebox: '12个月', successSignal: '有人第二次付钱，或同一个需求被不同买家重复购买。'
    }
  }
}

function countFact (text, src) { return (String(text || '').match(new RegExp(src, 'g')) || []).length }

function main () {
  const o = runHybridDiagnosisV6(OWNER)
  const fb = buildReportV6(o.diagnosis, o.hybridContext)
  const norm = normalizeV4RestoredOutput(OVERBUDGET)

  const cmp = compressVisibleCards(norm)
  const rep = mapV4RestoredToReport(fb, norm)
  const v = rep.visibleCards

  // ═══ §14 BUDGETS ═══
  ok('R75 §2 CARD01 <= 40', charLen(v.card01) <= BUDGET.CARD01 && charLen(v.card01) > 0, charLen(v.card01))
  ok('R75 §3 CARD02 <= 140', charLen(v.card02) <= BUDGET.CARD02 && charLen(v.card02) > 0, charLen(v.card02))
  const c3len = v.card03.steps.reduce((a, s) => a + charLen(s), 0) + charLen(v.card03.rule)
  ok('R75 §4 CARD03 <= 220', c3len <= BUDGET.CARD03, c3len)
  const c4len = charLen(v.card04.from) + charLen(v.card04.to) + charLen(v.card04.rule)
  ok('R75 §5 CARD04 <= 160', c4len <= BUDGET.CARD04, c4len)
  const c5len = charLen(v.card05.goal) + v.card05.actions.reduce((a, s) => a + charLen(s), 0) + charLen(v.card05.acceptance)
  ok('R75 §6 CARD05 <= 240', c5len <= BUDGET.CARD05, c5len)

  // ═══ §2 CARD01 is a cognitive collision, not a summary/fact list ═══
  ok('R75 §2 CARD01 is a collision (不是/并非/而是)', /不是|并非|而不是/.test(v.card01), v.card01)
  ok('R75 §2 CARD01 no raw-fact enumeration', !/岁|结余|存款|试错|每周\d/.test(v.card01), v.card01)

  // ═══ §3 CARD02 identity interpretation, not fact list ═══
  let c2facts = 0
  for (const m of FACT_MARKERS) c2facts += countFact(v.card02, m.src)
  ok('R75 §3 CARD02 drops raw-fact enumeration (<=1 fact)', c2facts <= 1, 'facts=' + c2facts)
  ok('R75 §3 CARD02 states identity/value position', /身份|价值|位置|经营者|创作者/.test(v.card02))

  // ═══ §4 CARD03 <=3 bullets + exactly 1 rule; rule ≠ bullet restatement ═══
  ok('R75 §4 CARD03 <= 3 bullets', v.card03.steps.length <= 3 && v.card03.steps.length >= 1, v.card03.steps.length)
  const normRule = v.card03.rule.replace(/[。，,；;、！？\s"']/g, '')
  const restates = v.card03.steps.some((s) => { const n = s.replace(/[。，,；;、！？\s"']/g, ''); return n && (normRule.includes(n) || n.includes(normRule)) })
  ok('R75 §4 CARD03 rule does NOT restate a bullet', !restates, v.card03.rule)

  // ═══ §5 CARD04 FROM -> TO + 1 rule; FROM != TO ═══
  ok('R75 §5 CARD04 real FROM -> TO', !!v.card04.from && !!v.card04.to && v.card04.from !== v.card04.to)
  ok('R75 §5 CARD04 has one world-rule', !!v.card04.rule)

  // ═══ §6 CARD05 goal + <=3 actions + 验收标准 ═══
  ok('R75 §6 CARD05 <= 3 actions', v.card05.actions.length <= 3 && v.card05.actions.length >= 1, v.card05.actions.length)
  ok('R75 §6 CARD05 has goal + acceptance', !!v.card05.goal && !!v.card05.acceptance)
  ok('R75 §6 CARD05 commercial behavior (报价/卖/交付/复购/产品)', /报价|卖|交付|复购|产品|买家/.test(v.card05.goal + v.card05.actions.join('') + v.card05.acceptance))

  // ═══ §9 strategicThesis full depth preserved ═══
  ok('R75 §9 strategicThesis full depth preserved', JSON.stringify(rep.strategicThesis) === JSON.stringify(norm.strategicThesis))
  ok('R75 §9 strategicThesis NOT compressed (systemTrap long)', charLen(rep.strategicThesis.systemTrap) > 120, charLen(rep.strategicThesis.systemTrap))

  // ═══ §7 questionnaire-fact repetition <= 2 across visible cards ═══
  const all = [v.card01, v.card02, v.card03.rule, v.card04.from, v.card04.to, v.card04.rule, v.card05.goal, v.card05.acceptance].concat(v.card03.steps, v.card05.actions)
  let maxRep = 0
  const per = {}
  for (const m of FACT_MARKERS) { let n = 0; for (const s of all) n += countFact(s, m.src); per[m.id] = n; maxRep = Math.max(maxRep, n) }
  ok('R75 §7 QUESTIONNAIRE_FACT_REPETITION_COUNT_MAX <= 2', maxRep <= 2, JSON.stringify(per))

  // ═══ §8 cross-card dedup (no duplicate sentences) ═══
  const sents = []
  const push = (s) => { String(s || '').split(/(?<=[。！？])/).forEach((x) => { const t = x.trim(); if (charLen(t) > 10) sents.push(t) }) }
  push(v.card01); push(v.card02); v.card03.steps.forEach(push); push(v.card03.rule); push(v.card04.from); push(v.card04.to); push(v.card04.rule); push(v.card05.goal); v.card05.actions.forEach(push); push(v.card05.acceptance)
  const uniq = new Set(sents.map((s) => s.replace(/\s+/g, '')))
  ok('R75 §8 USER_VISIBLE_DUPLICATE_SENTENCE_COUNT = 0', uniq.size === sents.length, 'sent=' + sents.length + ' uniq=' + uniq.size)

  // ═══ §13 duplicate constraint render = 0 (target/timebox removed from card05) ═══
  ok('R75 §13 DUPLICATE_CONSTRAINT_RENDER_COUNT = 0', rep.cards.firstAction.target === '' && rep.cards.firstAction.timebox === '')
  const c5blob = [v.card05.goal].concat(v.card05.actions, [v.card05.acceptance]).join('|')
  ok('R75 §13 CARD05 no repeated constraint sentence', !/(每周20小时[\s\S]*每周20小时)/.test(c5blob))

  // ═══ §14 deterministic; no second model call ═══
  const cmp2 = compressVisibleCards(norm)
  ok('R75 §14 compression is deterministic', JSON.stringify(cmp) === JSON.stringify(cmp2))
  ok('R75 §14 no truncation mid-sentence (ends on punctuation)', /[。！？]$/.test(v.card01) && (charLen(v.card02) === 0 || /[。！？]$/.test(v.card02)))

  // ═══ §15 BEFORE vs AFTER reduction >= 30% ═══
  const beforeTotal = charLen(norm.cards.card01) + charLen(norm.cards.card02) +
    norm.cards.card03.reduce((a, s) => a + charLen(s), 0) + charLen(norm.strategicThesis.systemTrap) +
    charLen(norm.cards.card04.from) + charLen(norm.cards.card04.to) + charLen(norm.strategicThesis.worldRule) +
    charLen(norm.cards.card05.objective) + norm.cards.card05.actions.reduce((a, s) => a + charLen(s), 0) + charLen(norm.cards.card05.successSignal)
  const afterTotal = charLen(v.card01) + charLen(v.card02) + c3len + c4len + c5len
  const red = (beforeTotal - afterTotal) / beforeTotal * 100
  ok('R75 §15 VISIBLE_CHAR_REDUCTION_PERCENT >= 30', red >= 30, red.toFixed(1) + '%')

  // ═══ §16 A/B/C control replay (skip-soft when the readback artifact is absent) ═══
  let abc = null
  try { abc = require('/tmp/r70/real_provider_readback.json') } catch (e) { abc = null }
  if (abc && abc.cases) {
    let boldOK = 0, mechOK = 0, migOK = 0, actOK = 0, notSummary = 0, budgetOK = 0, tot = 0
    for (const k of ['A', 'B', 'C']) {
      const raw = abc.cases[k] && abc.cases[k].report
      if (!raw) continue
      tot++
      const out = normalizeV4RestoredOutput({
        strategicThesis: raw.renderStrategy || {},
        cards: { card01: raw.card01, card02: raw.card02, card03: raw.card03, card04: raw.card04, card05: raw.card05 }
      })
      const cc = compressVisibleCards(out)
      // BOLD: CARD01 strong judgment/collision, not neutral summary
      if (/不是|并非|而不是|真正|其实/.test(cc.card01)) boldOK++
      // MECHANISM: >=1 bullet + a rule (distinct)
      if (cc.card03.steps.length >= 1 && cc.card03.rule) mechOK++
      // MIGRATION: FROM -> TO distinct
      if (cc.card04.from && cc.card04.to && cc.card04.from !== cc.card04.to) migOK++
      // COMMERCIAL ACTION: goal + >=1 action + acceptance
      if (cc.card05.goal && cc.card05.actions.length >= 1 && cc.card05.acceptance) actOK++
      // NOT collapsed to R69 generic summary
      if (!/^(你现在的处境是|总的来说|综合来看)/.test(cc.card02) && charLen(cc.card02) > 20) notSummary++
      // budgets respected
      if (charLen(cc.card01) <= BUDGET.CARD01 && charLen(cc.card02) <= BUDGET.CARD02 &&
          (cc.card03.steps.reduce((a, s) => a + charLen(s), 0) + charLen(cc.card03.rule)) <= BUDGET.CARD03 &&
          (charLen(cc.card04.from) + charLen(cc.card04.to) + charLen(cc.card04.rule)) <= BUDGET.CARD04 &&
          (charLen(cc.card05.goal) + cc.card05.actions.reduce((a, s) => a + charLen(s), 0) + charLen(cc.card05.acceptance)) <= BUDGET.CARD05) budgetOK++
    }
    ok('R75 §16 BOLD_JUDGMENT_PRESERVED = YES', boldOK === tot, boldOK + '/' + tot)
    ok('R75 §16 SYSTEM_MECHANISM_PRESERVED = YES', mechOK === tot, mechOK + '/' + tot)
    ok('R75 §16 VALUE_MIGRATION_PRESERVED = YES', migOK === tot, migOK + '/' + tot)
    ok('R75 §16 COMMERCIAL_ACTION_PRESERVED = YES', actOK === tot, actOK + '/' + tot)
    ok('R75 §16 NO_R69_SUMMARY_COLLAPSE = YES', notSummary === tot, notSummary + '/' + tot)
    ok('R75 §16 A/B/C budgets respected', budgetOK === tot, budgetOK + '/' + tot)
  } else {
    results.push('  SKIP R75 §16 (no /tmp/r70/real_provider_readback.json)')
  }

  console.log(results.join('\n'))
  console.log('\nR75 TESTS: ' + pass + ' passed, ' + fail + ' failed')
  if (fail > 0) process.exit(1)
}

main()
