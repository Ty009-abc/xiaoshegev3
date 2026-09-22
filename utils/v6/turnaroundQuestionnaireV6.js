'use strict'
/**
 * utils/v6/turnaroundQuestionnaireV6.js
 *
 * RC8.4 V6 — production CLIENT 9-question questionnaire (single source of truth
 * for the client). Mirrors the FROZEN backend contract
 * `cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6/questionnaireContractV6.js`
 * EXACTLY: question ids Q1..Q9, semantic option ids, canonical option text.
 *
 * Authority:
 *   docs/RC8.4_TURNAROUND_STRATEGY_V6_9Q_REFOUNDATION_DESIGN.md §4 (frozen copy)
 *   + backend questionnaireContractV6.js (authoritative option ids)
 *
 * Pure data + pure helpers. No I/O, no wx, no AI, no network.
 * Client is PRESENTATION + INPUT only: it never diagnoses, scores or rewrites.
 *
 * @version turnaround_strategy_v6 (client mirror)
 */

const CONTRACT_VERSION = 'turnaround_strategy_v6_contract_v1'
const QUESTIONNAIRE_VERSION = 'turnaround_strategy_v6'
const QUESTION_COUNT_V6 = 9

// Questions in canonical order. Option text is the frozen Chinese copy;
// optionId is the authoritative semantic id (must match backend exactly).
const V6_QUESTIONS = [
  {
    qid: 'Q1',
    key: 'AGE_STAGE',
    group: 'REALITY',
    prompt: '你现在处于哪个年龄阶段？',
    options: [
      { optionId: 'AGE_18_24', text: '18–24' },
      { optionId: 'AGE_25_30', text: '25–30' },
      { optionId: 'AGE_31_40', text: '31–40' },
      { optionId: 'AGE_41_50', text: '41–50' },
      { optionId: 'AGE_51_PLUS', text: '51+' },
    ],
  },
  {
    qid: 'Q2',
    key: 'INCOME_MODE',
    group: 'REALITY',
    prompt: '你现在主要靠什么获得收入？',
    // Optional free-text occupation captured on this step (optional).
    optionalOccupation: true,
    options: [
      { optionId: 'INCOME_SALARY', text: '固定工资' },
      { optionId: 'INCOME_BUSINESS', text: '生意·个体经营' },
      { optionId: 'INCOME_FREELANCE', text: '自由职业·接单' },
      { optionId: 'INCOME_ASSET', text: '投资·资产收入' },
      { optionId: 'INCOME_NONE', text: '暂时没有稳定收入' },
      { optionId: 'INCOME_OTHER', text: '其他' },
    ],
  },
  {
    qid: 'Q3',
    key: 'MONTHLY_SURPLUS',
    group: 'REALITY',
    prompt: '扣掉必须支出后，你一个月通常还能留下多少钱？',
    options: [
      { optionId: 'SURPLUS_NONE', text: '基本留不下·经常不够' },
      { optionId: 'SURPLUS_UNDER_1K', text: '1000元以下' },
      { optionId: 'SURPLUS_1K_5K', text: '1000–5000元' },
      { optionId: 'SURPLUS_5K_10K', text: '5000–10000元' },
      { optionId: 'SURPLUS_OVER_10K', text: '1万元以上' },
    ],
  },
  {
    qid: 'Q4',
    key: 'PRIMARY_PROBLEM',
    group: 'DESIRED_CHANGE',
    prompt: '如果现在只能先解决一个问题，你最想先解决什么？',
    options: [
      { optionId: 'PROBLEM_INCOME_STUCK', text: '收入一直上不去' },
      { optionId: 'PROBLEM_NO_FUTURE', text: '工作看不到未来' },
      { optionId: 'PROBLEM_DEBT', text: '债务·现金流压力' },
      { optionId: 'PROBLEM_CAREER_SWITCH', text: '想转行，但不知道往哪走' },
      { optionId: 'PROBLEM_SIDE_UNSTARTED', text: '想做副业，但一直没做起来' },
      { optionId: 'PROBLEM_MONETIZE', text: '有能力，但不知道怎么变现' },
      { optionId: 'PROBLEM_FOCUS', text: '事情很多，一直无法聚焦' },
      { optionId: 'PROBLEM_OTHER', text: '其他' },
    ],
  },
  {
    qid: 'Q5',
    key: 'USER_BELIEF',
    group: 'BELIEF',
    prompt: '你觉得自己一直没走出来，最主要是什么原因？',
    options: [
      { optionId: 'BELIEF_NO_DIRECTION', text: '不知道该往哪走' },
      { optionId: 'BELIEF_KNOW_NO_ACTION', text: '知道方向，但一直没真正行动' },
      { optionId: 'BELIEF_TRIED_NO_RESULT', text: '做过不少尝试，但没结果' },
      { optionId: 'BELIEF_RESOURCE', text: '缺钱·缺资源' },
      { optionId: 'BELIEF_TIME', text: '没时间' },
      { optionId: 'BELIEF_FEAR', text: '怕失败' },
      { optionId: 'BELIEF_SWITCHING', text: '总在换方向' },
      { optionId: 'BELIEF_ABILITY', text: '能力还不够' },
      { optionId: 'BELIEF_FAMILY', text: '家庭·环境牵制' },
      { optionId: 'BELIEF_OTHER', text: '其他' },
    ],
  },
  {
    qid: 'Q6',
    key: 'EXECUTION_STAGE',
    group: 'STAGE',
    prompt: '过去一年，为了改变现状，你真正做到哪一步了？',
    options: [
      { optionId: 'STAGE_THINKING', text: '主要还在想' },
      { optionId: 'STAGE_RESEARCHING', text: '查过很多资料' },
      { optionId: 'STAGE_LEARNING', text: '学过东西，但没真正开始' },
      { optionId: 'STAGE_STARTED', text: '开始做过，但没坚持多久' },
      { optionId: 'STAGE_TESTING', text: '做过产品·服务，但没人买单' },
      { optionId: 'STAGE_EARLY_TRACTION', text: '已经有人愿意付钱' },
      { optionId: 'STAGE_STABLE_TRACTION', text: '已经有一点稳定结果' },
    ],
  },
  {
    qid: 'Q7',
    key: 'UNCERTAINTY_BEHAVIOR',
    group: 'BEHAVIOR',
    prompt: '遇到一个你觉得有机会、但还没十足把握的事情，你通常怎么做？',
    options: [
      { optionId: 'UNCERT_SMALL_TEST', text: '先做个很小的版本试试' },
      { optionId: 'UNCERT_WAIT', text: '再等等，信息更充分再说' },
      { optionId: 'UNCERT_ASK_OTHERS', text: '先问几个做过的人' },
      { optionId: 'UNCERT_ANALYZE', text: '先把可能的问题都想清楚' },
    ],
  },
  {
    qid: 'Q8',
    key: 'TIME_BEHAVIOR',
    group: 'BEHAVIOR',
    prompt: '一件事今天就能看到结果，另一件三个月后才见效但能长期积累，你通常先顾哪件？',
    options: [
      { optionId: 'TIME_SHORT_FIRST', text: '先做马上有结果的' },
      { optionId: 'TIME_BALANCE', text: '两边都会安排' },
      { optionId: 'TIME_PROTECT_LONG', text: '会固定给长期的事留时间' },
      { optionId: 'TIME_LONG_DROPS', text: '一忙起来，长期的事就先停' },
    ],
  },
  {
    qid: 'Q9',
    key: 'NO_RESULT_BEHAVIOR',
    group: 'BEHAVIOR',
    prompt: '一件事做了一阵还没结果，你通常下一步会怎么做？',
    options: [
      { optionId: 'NORESULT_SWITCH', text: '换个方向试试' },
      { optionId: 'NORESULT_PERSIST', text: '再坚持一阵' },
      { optionId: 'NORESULT_ASK_OTHERS', text: '找别人看看我哪里做错了' },
      { optionId: 'NORESULT_RECHECK', text: '重新检查方法和步骤' },
      { optionId: 'NORESULT_STOP', text: '先停下来，不再继续投入' },
    ],
  },
]

const REQUIRED_QIDS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9']

function getQuestionsV6 () {
  // Return a shallow, immutable-by-convention copy (pages never mutate source).
  return V6_QUESTIONS.map((q) => ({
    qid: q.qid,
    key: q.key,
    group: q.group,
    prompt: q.prompt,
    optionalOccupation: !!q.optionalOccupation,
    options: q.options.map((o) => ({ optionId: o.optionId, text: o.text })),
  }))
}

/**
 * Validate a completed answer set.
 * @param {Object} answers  { Q1..Q9: optionId, occupationDetail?: string }
 * @returns {{valid:boolean, errors:string[]}}
 */
function validateAnswersV6 (answers) {
  const errors = []
  const input = answers || {}
  for (const qid of REQUIRED_QIDS) {
    const v = input[qid]
    if (v === undefined || v === null || v === '') { errors.push('MISSING:' + qid); continue }
    const q = V6_QUESTIONS.find((x) => x.qid === qid)
    if (!q.options.some((o) => o.optionId === v)) errors.push('INVALID_OPTION:' + qid + ':' + v)
  }
  return { valid: errors.length === 0, errors }
}

/**
 * Build the exact production V6 cloud payload. Client sends raw Q1..Q9 semantic
 * option ids (+ optional occupation). NEVER sends world_model_v2_1 / previewMode.
 * @param {Object} answers
 * @returns {{name:string, data:object}}
 */
function buildCloudRequestV6 (answers) {
  const input = answers || {}
  const out = {}
  for (const qid of REQUIRED_QIDS) out[qid] = input[qid]
  // §4 — Q2 「其他」 supplemental occupation is stored SEPARATELY from incomeMode
  // (incomeMode stays INCOME_OTHER; the raw text never overwrites it) and is only
  // serialized when Q2 is actually 「其他」 — guaranteeing no stale leak. The value
  // is emitted under BOTH the mission-canonical key `occupationDetail` and the
  // frozen native V6 backend key `occupation` (profileBuilderV6 reads .occupation).
  const detail = (typeof input.occupationDetail === 'string' && input.occupationDetail.trim())
    ? input.occupationDetail.trim()
    : ((typeof input.occupation === 'string' && input.occupation.trim()) ? input.occupation.trim() : '')
  if (out.Q2 === 'INCOME_OTHER' && detail) {
    out.occupation = detail
    out.occupationDetail = detail
  }
  return {
    name: 'generateAiReport',
    data: {
      type: 'diagnostic',
      diagnosticVersion: QUESTIONNAIRE_VERSION,
      answers: out,
    },
  }
}

/**
 * Build the §7 client-side semantic profile from answers (mirrors backend
 * profileBuilderV6 shape for local clarity/validation — NOT sent as diagnosis).
 * @param {Object} answers
 * @returns {Object|null} turnaroundProfile or null when incomplete
 */
function buildTurnaroundProfileV6 (answers) {
  const input = answers || {}
  const { valid } = validateAnswersV6(input)
  if (!valid) return null
  return {
    reality: {
      ageStage: input.Q1,
      incomeMode: input.Q2,
      monthlySurplus: input.Q3,
      occupation: ((typeof input.occupationDetail === 'string' && input.occupationDetail.trim())
        ? input.occupationDetail.trim()
        : ((typeof input.occupation === 'string' && input.occupation.trim()) ? input.occupation.trim() : null)),
    },
    desiredChange: { primaryProblem: input.Q4 },
    userBelief: { perceivedRootCause: input.Q5 },
    executionStage: { currentStage: input.Q6 },
    behavior: {
      uncertaintyResponse: input.Q7,
      timeAllocation: input.Q8,
      noResultResponse: input.Q9,
    },
  }
}

module.exports = {
  CONTRACT_VERSION,
  QUESTIONNAIRE_VERSION,
  QUESTION_COUNT_V6,
  REQUIRED_QIDS,
  V6_QUESTIONS,
  getQuestionsV6,
  validateAnswersV6,
  buildCloudRequestV6,
  buildTurnaroundProfileV6,
}
