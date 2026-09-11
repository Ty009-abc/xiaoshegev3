'use strict'
/**
 * tests/v6/fixtures.js — V6 acceptance fixtures (runtime mirror).
 *
 * Sources (frozen design, DO NOT EDIT expected outcomes):
 *  - docs/design/rc8.4_v6_golden_fixtures_15.json  (15 product Goldens)
 *  - docs/RC8.4_V6_ADVERSARIAL_CASES.md            (16 adversarial cases)
 *
 * The Golden expectation table is deliberately extracted here so the runtime
 * test harness does not depend on parsing a JSON whose schema may evolve.
 * Any disagreement is fixed in the runtime, never in these expectations.
 */

// ── 15 product Goldens: {id, answers, expect:{stage,bottleneck,beliefRealityGap}} ──
const GOLDEN = [
  { id: 'G01', answers: { Q1: '25–30', Q2: '固定工资', Q3: '1000元以下', Q4: '有能力，但不知道怎么变现', Q5: '不知道该往哪走', Q6: '查过很多资料', Q7: '再等等，信息更充分再说', Q8: '先做马上有结果的', Q9: '换个方向试试' }, expect: { stage: 'RESEARCHING', bottleneck: 'DIRECTION_GAP', beliefRealityGap: true } },
  { id: 'G02', answers: { Q1: '31–40', Q2: '固定工资', Q3: '1000–5000元', Q4: '收入一直上不去', Q5: '知道方向，但一直没真正行动', Q6: '学过东西，但没真正开始', Q7: '先把可能的问题都想清楚', Q8: '两边都会安排', Q9: '再坚持一阵' }, expect: { stage: 'LEARNING', bottleneck: 'ACTION_GAP', beliefRealityGap: false } },
  { id: 'G03', answers: { Q1: '25–30', Q2: '自由职业 / 接单', Q3: '1000–5000元', Q4: '想做副业，但一直没做起来', Q5: '总在换方向', Q6: '开始做过，但没坚持多久', Q7: '再等等，信息更充分再说', Q8: '一忙起来，长期的事就先停', Q9: '换个方向试试' }, expect: { stage: 'STARTED', bottleneck: 'CONSISTENCY_GAP', beliefRealityGap: false } },
  { id: 'G04', answers: { Q1: '31–40', Q2: '生意 / 个体经营', Q3: '1000–5000元', Q4: '想做副业，但一直没做起来', Q5: '做过不少尝试，但没结果', Q6: '做过产品 / 服务，但没人买单', Q7: '先把可能的问题都想清楚', Q8: '两边都会安排', Q9: '重新检查方法和步骤' }, expect: { stage: 'TESTING', bottleneck: 'VALIDATION_GAP', beliefRealityGap: false } },
  { id: 'G05', answers: { Q1: '25–30', Q2: '自由职业 / 接单', Q3: '5000–10000元', Q4: '收入一直上不去', Q5: '能力还不够', Q6: '已经有人愿意付钱', Q7: '先做个很小的版本试试', Q8: '先做马上有结果的', Q9: '再坚持一阵' }, expect: { stage: 'EARLY_TRACTION', bottleneck: 'REPEATABILITY_GAP', beliefRealityGap: true } },
  { id: 'G06', answers: { Q1: '31–40', Q2: '固定工资', Q3: '基本留不下 / 经常不够', Q4: '债务 / 现金流压力', Q5: '家庭 / 环境牵制', Q6: '学过东西，但没真正开始', Q7: '先把可能的问题都想清楚', Q8: '一忙起来，长期的事就先停', Q9: '先停下来，不再继续投入' }, expect: { stage: 'LEARNING', bottleneck: 'ACTION_GAP', beliefRealityGap: false } },
  { id: 'G07', answers: { Q1: '41–50', Q2: '固定工资', Q3: '5000–10000元', Q4: '想转行，但不知道往哪走', Q5: '不知道该往哪走', Q6: '查过很多资料', Q7: '先问几个做过的人', Q8: '两边都会安排', Q9: '换个方向试试' }, expect: { stage: 'RESEARCHING', bottleneck: 'DIRECTION_GAP', beliefRealityGap: false } },
  { id: 'G08', answers: { Q1: '41–50', Q2: '生意 / 个体经营', Q3: '5000–10000元', Q4: '工作看不到未来', Q5: '能力还不够', Q6: '开始做过，但没坚持多久', Q7: '再等等，信息更充分再说', Q8: '一忙起来，长期的事就先停', Q9: '再坚持一阵' }, expect: { stage: 'STARTED', bottleneck: 'CONSISTENCY_GAP', beliefRealityGap: true } },
  { id: 'G09', answers: { Q1: '18–24', Q2: '暂时没有稳定收入', Q3: '基本留不下 / 经常不够', Q4: '有能力，但不知道怎么变现', Q5: '不知道该往哪走', Q6: '主要还在想', Q7: '先做个很小的版本试试', Q8: '先做马上有结果的', Q9: '换个方向试试' }, expect: { stage: 'THINKING', bottleneck: 'DIRECTION_GAP', beliefRealityGap: false } },
  { id: 'G10', answers: { Q1: '31–40', Q2: '固定工资', Q3: '1万元以上', Q4: '工作看不到未来', Q5: '知道方向，但一直没真正行动', Q6: '学过东西，但没真正开始', Q7: '先把可能的问题都想清楚', Q8: '两边都会安排', Q9: '再坚持一阵' }, expect: { stage: 'LEARNING', bottleneck: 'ACTION_GAP', beliefRealityGap: false } },
  { id: 'G11', answers: { Q1: '25–30', Q2: '自由职业 / 接单', Q3: '1000元以下', Q4: '收入一直上不去', Q5: '做过不少尝试，但没结果', Q6: '做过产品 / 服务，但没人买单', Q7: '先做个很小的版本试试', Q8: '会固定给长期的事留时间', Q9: '重新检查方法和步骤' }, expect: { stage: 'TESTING', bottleneck: 'VALIDATION_GAP', beliefRealityGap: false } },
  { id: 'G12', answers: { Q1: '31–40', Q2: '固定工资', Q3: '1000–5000元', Q4: '收入一直上不去', Q5: '缺钱 / 缺资源', Q6: '学过东西，但没真正开始', Q7: '再等等，信息更充分再说', Q8: '一忙起来，长期的事就先停', Q9: '先停下来，不再继续投入' }, expect: { stage: 'LEARNING', bottleneck: 'ACTION_GAP', beliefRealityGap: true } },
  { id: 'G13', answers: { Q1: '25–30', Q2: '固定工资', Q3: '1000–5000元', Q4: '事情很多，一直无法聚焦', Q5: '没时间', Q6: '开始做过，但没坚持多久', Q7: '再等等，信息更充分再说', Q8: '一忙起来，长期的事就先停', Q9: '换个方向试试' }, expect: { stage: 'STARTED', bottleneck: 'CONSISTENCY_GAP', beliefRealityGap: true, beliefRelation: 'BELIEF_PARTIAL' } },
  { id: 'G14', answers: { Q1: '41–50', Q2: '生意 / 个体经营', Q3: '5000–10000元', Q4: '有能力，但不知道怎么变现', Q5: '能力还不够', Q6: '做过产品 / 服务，但没人买单', Q7: '先把可能的问题都想清楚', Q8: '两边都会安排', Q9: '先停下来，不再继续投入' }, expect: { stage: 'TESTING', bottleneck: 'VALIDATION_GAP', beliefRealityGap: true } },
  { id: 'G15', answers: { Q1: '25–30', Q2: '自由职业 / 接单', Q3: '5000–10000元', Q4: '收入一直上不去', Q5: '做过不少尝试，但没结果', Q6: '已经有一点稳定结果', Q7: '先做个很小的版本试试', Q8: '先做马上有结果的', Q9: '再坚持一阵' }, expect: { stage: 'STABLE_TRACTION', bottleneck: 'REPEATABILITY_GAP', beliefRealityGap: true } }
]

// ── 16 adversarial cases: expected primary (null = NO_PRIMARY) ──
const ADVERSARIAL = [
  { id: 'A', expectPrimary: null, answers: { Q1: '25–30', Q2: '自由职业 / 接单', Q3: '1000–5000元', Q4: '想做副业，但一直没做起来', Q5: '知道方向，但一直没真正行动', Q6: '主要还在想', Q7: '先做个很小的版本试试', Q8: '两边都会安排', Q9: '再坚持一阵' } },
  { id: 'B', expectPrimary: null, answers: { Q1: '31–40', Q2: '固定工资', Q3: '1000–5000元', Q4: '收入一直上不去', Q5: '做过不少尝试，但没结果', Q6: '学过东西，但没真正开始', Q7: '先做个很小的版本试试', Q8: '两边都会安排', Q9: '重新检查方法和步骤' } },
  { id: 'C', expectPrimary: null, answers: { Q1: '31–40', Q2: '生意 / 个体经营', Q3: '5000–10000元', Q4: '收入一直上不去', Q5: '能力还不够', Q6: '开始做过，但没坚持多久', Q7: '先做个很小的版本试试', Q8: '会固定给长期的事留时间', Q9: '重新检查方法和步骤' } },
  { id: 'D', expectPrimary: 'VALIDATION_GAP', expectRealityConstraint: false, answers: { Q1: '25–30', Q2: '自由职业 / 接单', Q3: '1000–5000元', Q4: '收入一直上不去', Q5: '做过不少尝试，但没结果', Q6: '做过产品 / 服务，但没人买单', Q7: '先做个很小的版本试试', Q8: '一忙起来，长期的事就先停', Q9: '换个方向试试' } },
  { id: 'E', expectPrimary: null, answers: { Q1: '25–30', Q2: '自由职业 / 接单', Q3: '5000–10000元', Q4: '收入一直上不去', Q5: '做过不少尝试，但没结果', Q6: '已经有人愿意付钱', Q7: '先做个很小的版本试试', Q8: '会固定给长期的事留时间', Q9: '再坚持一阵' } },
  { id: 'F', expectPrimary: null, answers: { Q1: '41–50', Q2: '生意 / 个体经营', Q3: '5000–10000元', Q4: '工作看不到未来', Q5: '做过不少尝试，但没结果', Q6: '已经有一点稳定结果', Q7: '先做个很小的版本试试', Q8: '会固定给长期的事留时间', Q9: '再坚持一阵' } },
  { id: 'G', expectPrimary: 'VALIDATION_GAP', expectRealityConstraint: true, expectNoHardGap: true, answers: { Q1: '31–40', Q2: '生意 / 个体经营', Q3: '基本留不下 / 经常不够', Q4: '债务 / 现金流压力', Q5: '缺钱 / 缺资源', Q6: '做过产品 / 服务，但没人买单', Q7: '先做个很小的版本试试', Q8: '会固定给长期的事留时间', Q9: '重新检查方法和步骤' } },
  { id: 'H', expectPrimary: 'CONSISTENCY_GAP', expectRealityConstraint: false, expectRelation: 'BELIEF_PARTIAL', expectNoHardGap: true, answers: { Q1: '25–30', Q2: '固定工资', Q3: '1000–5000元', Q4: '事情很多，一直无法聚焦', Q5: '没时间', Q6: '开始做过，但没坚持多久', Q7: '再等等，信息更充分再说', Q8: '一忙起来，长期的事就先停', Q9: '换个方向试试' } },
  { id: 'H1', expectPrimary: 'ACTION_GAP', expectRealityConstraint: true, expectRelation: 'BELIEF_PARTIAL', expectNoHardGap: true, answers: { Q1: '31–40', Q2: '自由职业 / 接单', Q3: '基本留不下 / 经常不够', Q4: '债务 / 现金流压力', Q5: '没时间', Q6: '学过东西，但没真正开始', Q7: '再等等，信息更充分再说', Q8: '一忙起来，长期的事就先停', Q9: '先停下来，不再继续投入' } },
  { id: 'H2', expectPrimary: 'CONSISTENCY_GAP', expectRealityConstraint: false, expectRelation: 'BELIEF_PARTIAL', expectNoHardGap: true, answers: { Q1: '31–40', Q2: '固定工资', Q3: '5000–10000元', Q4: '事情很多，一直无法聚焦', Q5: '没时间', Q6: '开始做过，但没坚持多久', Q7: '再等等，信息更充分再说', Q8: '一忙起来，长期的事就先停', Q9: '换个方向试试' } },
  { id: 'I', expectPrimary: 'REPEATABILITY_GAP', expectRelation: 'BELIEF_REALITY_GAP', answers: { Q1: '25–30', Q2: '自由职业 / 接单', Q3: '5000–10000元', Q4: '收入一直上不去', Q5: '能力还不够', Q6: '已经有人愿意付钱', Q7: '再等等，信息更充分再说', Q8: '先做马上有结果的', Q9: '再坚持一阵' } },
  { id: 'J', expectPrimary: 'VALIDATION_GAP', expectRealityConstraint: true, answers: { Q1: '31–40', Q2: '生意 / 个体经营', Q3: '基本留不下 / 经常不够', Q4: '债务 / 现金流压力', Q5: '做过不少尝试，但没结果', Q6: '做过产品 / 服务，但没人买单', Q7: '先做个很小的版本试试', Q8: '会固定给长期的事留时间', Q9: '重新检查方法和步骤' } },
  { id: 'K', expectPrimary: 'ACTION_GAP', answers: { Q1: '31–40', Q2: '固定工资', Q3: '1万元以上', Q4: '工作看不到未来', Q5: '知道方向，但一直没真正行动', Q6: '学过东西，但没真正开始', Q7: '先把可能的问题都想清楚', Q8: '一忙起来，长期的事就先停', Q9: '再坚持一阵' } },
  { id: 'L', expectPrimary: null, answers: { Q1: '31–40', Q2: '固定工资', Q3: '1000–5000元', Q4: '工作看不到未来', Q5: '不知道该往哪走', Q6: '查过很多资料', Q7: '先做个很小的版本试试', Q8: '会固定给长期的事留时间', Q9: '重新检查方法和步骤' } },
  { id: 'M', expectPrimary: 'DIRECTION_GAP', expectNoHardGap: true, answers: { Q1: '18–24', Q2: '暂时没有稳定收入', Q3: '1000元以下', Q4: '想转行，但不知道往哪走', Q5: '总在换方向', Q6: '主要还在想', Q7: '再等等，信息更充分再说', Q8: '先做马上有结果的', Q9: '换个方向试试' } },
  { id: 'N', expectPrimary: null, answers: { Q1: '31–40', Q2: '自由职业 / 接单', Q3: '5000–10000元', Q4: '收入一直上不去', Q5: '能力还不够', Q6: '已经有人愿意付钱', Q7: '再等等，信息更充分再说', Q8: '会固定给长期的事留时间', Q9: '换个方向试试' } }
]

// ── D-3 discriminator trio (accepted Golden evidence) ──
const D3 = [
  { id: 'G01', answers: GOLDEN.find(g => g.id === 'G01').answers, expectGap: true },
  { id: 'G07', answers: GOLDEN.find(g => g.id === 'G07').answers, expectGap: false },
  { id: 'G09', answers: GOLDEN.find(g => g.id === 'G09').answers, expectGap: false }
]

module.exports = { GOLDEN, ADVERSARIAL, D3 }
