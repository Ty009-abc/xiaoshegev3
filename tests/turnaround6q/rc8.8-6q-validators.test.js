'use strict'
/**
 * tests/turnaround6q/rc8.8-6q-validators.test.js
 *
 * Proves the validator layer (§10/§12):
 *   - golden examples PASS both validators
 *   - generic / unsupported / enum-leak / overclaim copy is REJECTED
 *   - mismatch is impossible: identity+explanation === body (view model)
 */

const h = require('./_harness.js')
const { FIXTURES, OWNER_STYLE_FIXTURE } = require('./fixtures.js')
const { GOLDEN_EXAMPLES } = require('./goldenExamples.js')
const { validateStructure6Q, validateSemantics6Q, validateRequiredFields6Q } = require('../../cloudfunctions/generateAiReport/lib/turnaround6q/reportValidator6Q.js')
const { buildFallbackReport6Q } = require('../../cloudfunctions/generateAiReport/lib/turnaround6q/fallbackReport6Q.js')
const { normalizeFacts6Q } = require('../../cloudfunctions/generateAiReport/lib/turnaround6q/questionContract6Q.js')
const { buildCardList6Q } = require('../../utils/turnaround6q/turnaround6qReportViewModel.js')

h.section('RC8.8 6Q — validators')

const all = [...FIXTURES, OWNER_STYLE_FIXTURE]
for (const fx of all) {
  const { facts } = normalizeFacts6Q(fx.answers)
  const g = GOLDEN_EXAMPLES[fx.id]
  h.ok(!!g, fx.id + ' has a golden example')
  if (!g) continue
  const st = validateStructure6Q(g)
  const se = validateSemantics6Q(g, facts)
  h.ok(st.ok, fx.id + ' golden passes structural (' + st.errors.join(',') + ')')
  h.ok(se.ok, fx.id + ' golden passes semantic (' + se.errors.join(',') + ')')
  h.ok(se.FACT_GROUNDING_COUNT >= 3, fx.id + ' FACT_GROUNDING_COUNT>=3 (' + se.FACT_GROUNDING_COUNT + ')')
  h.eq(se.GENERIC_COPY_COUNT, 0, fx.id + ' no generic copy')
  h.eq(se.UNSUPPORTED_FACT_COUNT, 0, fx.id + ' no unsupported fact')

  // deterministic fallback must ALSO pass both validators
  const fb = buildFallbackReport6Q(facts)
  const fst = validateStructure6Q(fb)
  const fse = validateSemantics6Q(fb, facts)
  h.ok(fst.ok, fx.id + ' fallback passes structural (' + fst.errors.join(',') + ')')
  h.ok(fse.ok, fx.id + ' fallback passes semantic (' + fse.errors.join(',') + ')')

  // view-model identity+explanation === body
  const cards = buildCardList6Q({ coreProblem: { title: '核心问题', text: g.core_problem } })
  const cp = cards.find((c) => c.key === 'coreProblem')
  h.eq((cp.identity + cp.explanation).replace(/\s+/g, ' ').trim(), g.core_problem.replace(/\s+/g, ' ').trim(), fx.id + ' identity+explanation === body')
}

// ── negative cases ──
const facts = normalizeFacts6Q(FIXTURES[0].answers).facts

const generic = JSON.parse(JSON.stringify(GOLDEN_EXAMPLES.F01))
generic.fatal_sentence = '要相信自己，保持努力，坚持下去，提升认知，多学习，加油，不要放弃。'
h.ok(!validateSemantics6Q(generic, facts).ok, 'generic copy rejected')

const unsupported = JSON.parse(JSON.stringify(GOLDEN_EXAMPLES.F01))
unsupported.core_problem = '你的房贷和孩子的学费让你不敢换工作，你的妻子也在抱怨。' + unsupported.core_problem
h.ok(validateSemantics6Q(unsupported, facts).codes.includes('INVENTED_USER_FACT'), 'invented private fact rejected (INVENTED_USER_FACT)')

const leak = JSON.parse(JSON.stringify(GOLDEN_EXAMPLES.F01))
leak.strategy_path = '按 VALIDATION_GAP 处理，状态 PRIMARY。'
h.ok(!validateStructure6Q(leak).ok, 'enum leak rejected')

const over = JSON.parse(JSON.stringify(GOLDEN_EXAMPLES.F01))
over.strategy_path = '跟着做，30天后你的月收入一定能翻倍，成功率90%。'
const overV = validateSemantics6Q(over, facts)
h.ok(overV.codes.includes('UNSUPPORTED_CAUSAL_CERTAINTY') && overV.codes.includes('UNSUPPORTED_NUMERIC_CLAIM'), 'overclaim split into subtypes (' + overV.codes.join(',') + ')')
h.ok(overV.explanations.length > 0 && overV.explanations.every((e) => e.code && e.field && e.reason), 'rejection carries {code,field,evidence,reason}')

h.summary('6Q validators')

// ══════════════════════════════════════════════════════════════════
// R2 — SEMANTIC CALIBRATION (§3–§12)
// ══════════════════════════════════════════════════════════════════
h.section('RC8.8 R2 — semantic calibration')

const baseReport = () => JSON.parse(JSON.stringify(GOLDEN_EXAMPLES.F01))
const f01 = normalizeFacts6Q(FIXTURES[0].answers).facts

// §11 ADVERSARIAL SAFETY SET — every one MUST reject
const ADVERSARIAL = {
  A_INVENTED_DEBT: (r) => { r.core_problem = '你在外卖之外还背着房贷和网贷，' + r.core_problem; return r },
  B_INVENTED_FAMILY: (r) => { r.fatal_sentence = '你孩子的学费和父母的医药费，让你根本没资格谈转型。'; return r },
  C_INVENTED_FAILED_BIZ: (r) => { r.core_problem = '你之前开过公司，生意失败倒闭亏了不少，' + r.core_problem; return r },
  D_FUTURE_INCOME: (r) => { r.strategy_path = '照这个方向做，你未来收入一定会翻倍。'; return r },
  E_PROBABILITY: (r) => { r.fatal_sentence = '按这个路径走，你半年内翻身成功的概率高达80%。'; return r },
  F_MENTAL_STATE: (r) => { r.core_problem = '你其实一直在逃避，内心深处是自卑和恐惧，' + r.core_problem; return r },
  G_INVENTED_SKILL: (r) => { r.strategy_path = '你天生就是一个销售型的人，只要去谈客户就一定能成交。'; return r },
  H_CONTRADICTION: (r) => { r.core_problem = '你月入20000，' + r.core_problem; return r },
}
let advFail = 0
for (const [name, mut] of Object.entries(ADVERSARIAL)) {
  const v = validateSemantics6Q(mut(baseReport()), f01)
  if (!v.ok && v.explanations.length > 0) advFail++
  h.ok(!v.ok, 'adversarial ' + name + ' MUST reject (' + v.codes.join(',') + ')')
}
h.eq(advFail, 8, 'ADVERSARIAL_REJECTION = 8/8')

// §12 STRONG-BUT-GROUNDED SET — every one MUST pass (grounded sharp judgment)
const STRONG = {
  S1_reframe: (r) => { r.fatal_sentence = '你以为自己输在没学历没关系，真正让你原地打转的，是你把所有时间都卖给了当天结算的系统。'; return r },
  S2_contradiction: (r) => { r.core_problem = '你说再拼也没用，可你每天跑十几个小时恰恰说明你在拼；矛盾的是你拼的是体力，而不是能积累的东西。'; return r },
  S3_career_reframe: (r) => { r.strategy_path = '把骑手这个身份从体力工种，重新定义成一座城市里最懂时间和路线的人。'; return r },
  S4_income_reframe: (r) => { r.core_problem = '月入6000不是你能力的天花板，而是你当前收入结构的定价结果：所有钱都来自同一小时里的一次跑单。'; return r },
  S5_rootcause_challenge: (r) => { r.fatal_sentence = '你把问题归为没学历没关系，但这解释不了为什么你每天十几个小时仍卡在6000。'; return r },
  S7_mechanism: (r) => { r.system_trap = '你被困在一个干一天才有一天钱的机制里：不是你不努力，而是这份努力永远无法离开你的身体。'; return r },
  S8_hard_truth: (r) => { r.fatal_sentence = '你不是不够拼，你是一直在做一件今天做完、明天归零的事，所以才会年年原地打转。'; return r },
  S9_grounded_mechanism: (r) => { r.core_problem = '你把时间全押在一个随体力下降必然贬值的系统里，' + r.core_problem; return r },
}
let strongPass = 0
for (const [name, mut] of Object.entries(STRONG)) {
  const rep = mut(baseReport())
  const st = validateStructure6Q(rep)
  const v = validateSemantics6Q(rep, f01)
  if (st.ok && v.ok) strongPass++
  h.ok(st.ok && v.ok, 'strong-grounded ' + name + ' MUST pass (struct=' + st.errors.join(',') + ' sem=' + v.errors.join(',') + ')')
}
h.eq(strongPass, 8, 'STRONG_GROUNDED_PASS = 8/8')

// §5 OVERCLAIM subtypes are INDEPENDENT, never one bucket
const bt = (mut) => validateSemantics6Q(mut(baseReport()), f01).subtypeCounts
h.eq(bt((r) => { r.core_problem = '你背着房贷，' + r.core_problem; return r }).INVENTED_USER_FACT, 1, 'subtype INVENTED_USER_FACT fires alone')
h.eq(bt((r) => { r.strategy_path = '你未来一定会成功。'; return r }).UNSUPPORTED_FUTURE_PREDICTION >= 1, true, 'subtype UNSUPPORTED_FUTURE_PREDICTION fires')
h.eq(bt((r) => { r.fatal_sentence = '你成功的概率高达90%。'; return r }).UNSUPPORTED_NUMERIC_CLAIM, 1, 'subtype UNSUPPORTED_NUMERIC_CLAIM fires')
h.eq(bt((r) => { r.core_problem = '你内心深处在逃避，' + r.core_problem; return r }).UNSUPPORTED_PSYCHOLOGICAL_ASSERTION, 1, 'subtype UNSUPPORTED_PSYCHOLOGICAL_ASSERTION fires')
h.eq(bt((r) => { r.strategy_path = '你天生就是一个领袖型的人。'; return r }).UNSUPPORTED_CAPABILITY_ASSERTION, 1, 'subtype UNSUPPORTED_CAPABILITY_ASSERTION fires')

// §7 grounding counts STRUCTURE, not decorative number repetition
const structGround = JSON.parse(JSON.stringify(GOLDEN_EXAMPLES.F01))
structGround.core_problem = '你34岁做外卖骑手月入6000，但你真正的问题不是钱少，而是收入没有积累。'
h.eq(validateSemantics6Q(structGround, f01).FACT_GROUNDING_COUNT >= 3, true, 'structural grounding >=3 counts material use')

// §9 every rejection is field-specific with evidence + reason
const ex = validateSemantics6Q((r => { r.core_problem = '你背着房贷，' + r.core_problem; return r })(baseReport()), f01)
h.ok(ex.explanations.every((e) => e.code && e.field && e.card && ('evidence' in e) && e.reason), 'explanations are field-specific {code,field,card,evidence,reason}')

h.summary('6Q validators R2')

// ══════════════════════════════════════════════════════════════════
// R4 — EVIDENCE BOUNDARY + ACTION FOCUS (§2–§7, §12)
// ══════════════════════════════════════════════════════════════════
h.section('RC8.8 R4 — evidence boundary + action focus')

const f3 = normalizeFacts6Q(FIXTURES[2].answers).facts   // F03 个体经营
const f4 = normalizeFacts6Q(FIXTURES[3].answers).facts   // F04 行政
const f5 = normalizeFacts6Q(FIXTURES[4].answers).facts   // F05 护士长
const f06 = normalizeFacts6Q(FIXTURES[5].answers).facts  // F06 模糊自我评估
const repOf = (id) => JSON.parse(JSON.stringify(GOLDEN_EXAMPLES[id]))

// §12 adversarial — invented business economics / employer policy / job duties /
// motivation / past behaviour / irreversible advice. ALL must reject.
h.ok(!validateSemantics6Q((r => { r.core_problem = '你的收入结构完全依赖到店客流。'; return r })(repOf('F03')), f3).ok, 'R4: invented business economics rejected')
h.ok(!validateSemantics6Q((r => { r.core_problem = '你的收入上限由编制和绩效规则决定。'; return r })(repOf('F05')), f5).ok, 'R4: invented employer policy rejected')
h.ok(!validateSemantics6Q((r => { r.core_problem = '你的时间全被临床管理占满。'; return r })(repOf('F05')), f5).ok, 'R4: invented job duties rejected')
h.ok(!validateSemantics6Q((r => { r.fatal_sentence = '你其实真正怕的是承认自己选错了。'; return r })(repOf('F05')), f5).ok, 'R4: invented motivation rejected')
h.ok(!validateSemantics6Q((r => { r.core_problem = '你从未在任何一件事上扛过完整责任。'; return r })(repOf('F04')), f4).ok, 'R4: invented past behaviour rejected')
h.ok(!validateSemantics6Q((r => { r.strategy_path = '减少一名前厅人员，把人工成本压下来。'; return r })(repOf('F03')), f3).ok, 'R4: irreversible advice (lay off) rejected')
h.ok(!validateSemantics6Q((r => { r.strategy_path = '直接涨价20%并砍掉所有老客优惠。'; return r })(repOf('F03')), f3).ok, 'R4: irreversible advice (raise prices) rejected')

// §4 conditional rewrite is ALLOWED (hypothesis wording turns a claim into C)
const condBiz = repOf('F03'); condBiz.core_problem = '如果客流真的只靠老客，那么店的风险会随时间上升——值得先验证新客到底从哪来。' + condBiz.core_problem
h.ok(validateSemantics6Q(condBiz, f3).ok, 'R4: conditional hypothesis (if…) allowed')
const condPolicy = repOf('F05'); condPolicy.core_problem = '从你目前提供的信息看，你的收入上限可能和编制与绩效规则有关，需要先确认。' + condPolicy.core_problem
h.ok(validateSemantics6Q(condPolicy, f5).ok, 'R4: conditional hypothesis (…信息看/先确认) allowed')

// §7 irreversible rewritten as a verification experiment is ALLOWED
const saferAction = repOf('F03'); saferAction.experiment.actions = ['记录一周前厅高峰与低峰的工作量']
h.ok(validateStructure6Q(saferAction).ok, 'R4: high-impact action rewritten as verification allowed')

// §5/§12 Card05 = ONE experiment: multi-action / long-horizon REJECTED
h.eq(validateStructure6Q((r => { r.experiment.actions = ['a1', 'a2', 'a3', 'a4']; return r })(repOf('F01'))).codes.includes('EXPERIMENT_ACTIONS_INVALID'), true, 'R4: 4-wide action plan rejected (Card05 = 1 experiment)')
h.eq(validateStructure6Q((r => { r.experiment.goal = '制定6个月的转型路线图'; return r })(repOf('F01'))).codes.includes('LONG_HORIZON_PLAN'), true, 'R4: 6-month roadmap rejected')

// §6 mandatory experiment fields: a MISSING sub-field is a required-field violation
for (const k of ['goal', 'target', 'output', 'success_signal', 'time_horizon']) {
  const mm = repOf('F01'); delete mm.experiment[k]
  h.ok(validateRequiredFields6Q(mm).codes.includes('MISSING_REQUIRED_FIELD'), 'R4: missing experiment.' + k + ' -> MISSING_REQUIRED_FIELD')
}

// §1 frozen voice — a strong but grounded reframe still PASSES (no sanitizing)
const stillSharp = repOf('F01')
stillSharp.fatal_sentence = '你不是被学历困住，是被“干一天才有一天钱”的收入结构困住了——再拼十年，你手里也不会多出任何能自己产生价值的东西。'
h.ok(validateSemantics6Q(stillSharp, f01).ok, 'R4: Card01 stays sharp, grounded reframe allowed')

// every R4 rejection carries a field-specific explanation with a subtype
const rj = validateSemantics6Q((r => { r.core_problem = '你的收入上限由编制和绩效规则决定。'; return r })(repOf('F05')), f5)
h.ok(rj.explanations.some((e) => e.code === 'UNSUPPORTED_ASSERTION' && e.assertionSubtype === 'INVENTED_EMPLOYER_POLICY'), 'R4: rejection carries assertionSubtype')

h.summary('6Q validators R4')

// ══════════════════════════════════════════════════════════════════
// R4.1 — EVIDENCE ATTRIBUTION HARDENING (§2–§7, §10)
// ══════════════════════════════════════════════════════════════════
h.section('RC8.8 R4.1 — evidence attribution hardening')

const mF01 = repOf('F01'), mF03 = repOf('F03'), mF04 = repOf('F04'), mF05 = repOf('F05'), mF06 = repOf('F06')
const S = (r, f) => validateSemantics6Q(r, f)

// §2 ABSENCE OF EVIDENCE — “你没有/从未/一直/不敢…” as FACT must be rejected
h.ok(!S((r => { r.core_problem = '你从来没有面对过真正的验证，' + r.core_problem; return r })(repOf('F01')), f01).ok, 'R4.1 §2: 你从来没有… as fact rejected')
// …but the ABSENCE FORM is ALLOWED
h.ok(S((r => { r.core_problem = '从你目前提供的信息里，还看不到你验证过别的路。' + r.core_problem; return r })(repOf('F01')), f01).ok, 'R4.1 §2: “从你提供的信息里还看不到…” allowed')

// §3 MOTIVE — 不敢/害怕/真正怕的是… as fact rejected; conditional or user-paraphrase allowed
h.ok(!S((r => { r.fatal_sentence = '你不敢验证别的路，' + r.fatal_sentence; return r })(repOf('F01')), f01).ok, 'R4.1 §3: 不敢验证 as fact rejected')
h.ok(!S((r => { r.core_problem = '你真正怕的其实是变量失效。' + r.core_problem; return r })(repOf('F03')), f3).ok, 'R4.1 §3: 真正怕的是 as fact rejected')
h.ok(S((r => { r.core_problem = '一种可能是你怕冒险，但这需要你确认。' + r.core_problem; return r })(repOf('F03')), f3).ok, 'R4.1 §3: conditional motive allowed')

// §4 HISTORY — 从未/一直/每一份工作都… as fact rejected
h.ok(!S((r => { r.core_problem = '每一份工作你都停留在浅层适应期。' + r.core_problem; return r })(repOf('F04')), f4).ok, 'R4.1 §4: 每一份工作都… as fact rejected')
h.ok(S((r => { r.core_problem = '目前提供的信息里，还没有看到你在同一件事上长期投入的记录。' + r.core_problem; return r })(repOf('F04')), f4).ok, 'R4.1 §4: 目前信息里还没有看到… allowed')

// §5 EXTERNAL BENCHMARK — no external data source exists
h.ok(!S((r => { r.core_problem = '月入9000在同龄人中不算差。' + r.core_problem; return r })(repOf('F06')), f06).ok, 'R4.1 §5: 同龄人中不算差 rejected')
h.ok(!S((r => { r.system_trap = '你拿着高薪却停滞。'; return r })(repOf('F05')), f5).ok, 'R4.1 §5: 高薪 benchmark rejected')

// §6 INDUSTRY MECHANISM vs USER-SPECIFIC FACT
h.ok(S({ ...repOf('F03'), core_problem: '餐饮经营通常需要同时关注客源和固定成本。' + repOf('F03').core_problem }, f3).ok, 'R4.1 §6: general mechanism allowed')
h.ok(!S({ ...repOf('F03'), system_trap: '你的成本一直上涨。' }, f3).ok, 'R4.1 §6: user-specific cost claim rejected')
h.ok(S({ ...repOf('F03'), core_problem: '你已经提到房租和人工压力，因此成本端值得优先核对。' + repOf('F03').core_problem }, f3).ok, 'R4.1 §6: grounded user-specific form allowed')

// §7 USER_INPUT_CONTRADICTION (F04) — must be DETECTED; silent resolution forbidden
const f04Live = S(repOf('F04'), f4)
h.eq(f04Live.USER_INPUT_CONTRADICTION_DETECTED, true, 'R4.1 §7: F04 input contradiction DETECTED = YES')
h.eq(S((r => { r.core_problem = '你换过好几份工作，每份都做不长。'; return r })(repOf('F04')), f4).SILENT_CONTRADICTION_RESOLUTION_COUNT, 1, 'R4.1 §7: silent resolution counted (leans on disputed fact w/o flag)')
h.ok(S((r => { r.core_problem = '你对自己工作经历的说法本身存在矛盾；先不纠结换了几次。' + r.core_problem; return r })(repOf('F04')), f4).ok, 'R4.1 §7: flagging the contradiction is accepted')

// §10 REQUIRED RETESTS — the exact owner-listed phrases must not pass as fact
const RETEST = [
  ['F01 不敢验证', () => { const r = repOf('F01'); r.fatal_sentence = '你不敢验证别的路，' + r.fatal_sentence; return r }, f01],
  ['F03 唯一变量', () => { const r = repOf('F03'); r.core_problem = '老客户是唯一变量。' + r.core_problem; return r }, f3],
  ['F03 成本固定上涨', () => { const r = repOf('F03'); r.system_trap = '成本固定上涨，收入却不动。'; return r }, f3],
  ['F03 不敢投入', () => { const r = repOf('F03'); r.core_problem = '你一直不敢投入线上营销。' + r.core_problem; return r }, f3],
  ['F03 真正怕的是', () => { const r = repOf('F03'); r.core_problem = '你真正怕的是变量失效。' + r.core_problem; return r }, f3],
  ['F04 每份工作都', () => { const r = repOf('F04'); r.core_problem = '每一份工作你都停留在浅层适应期。' + r.core_problem; return r }, f4],
  ['F04 没到判断阶段就离开', () => { const r = repOf('F04'); r.core_problem = '还没到能判断适不适合的阶段就离开了。' + r.core_problem; return r }, f4],
  ['F05 只在内部被评价', () => { const r = repOf('F05'); r.core_problem = '你的个人价值只在内部被评价。' + r.core_problem; return r }, f5],
  ['F06 二十九岁', () => { const r = repOf('F06'); r.fatal_sentence = '你二十九岁的焦虑不是因为运气差。'; return r }, f06],
  ['F06 同龄人中不算差', () => { const r = repOf('F06'); r.core_problem = '月入9000在同龄人中不算差。' + r.core_problem; return r }, f06],
]
let retestReject = 0
for (const [name, mut, facts] of RETEST) {
  const v = S(mut(), facts)
  if (!v.ok) retestReject++
  h.ok(!v.ok, 'R4.1 §10 retest rejected as fact: ' + name)
}
h.eq(retestReject, RETEST.length, 'R4.1 §10: all required retests rejected (' + retestReject + '/' + RETEST.length + ')')

h.summary('6Q validators R4.1')
