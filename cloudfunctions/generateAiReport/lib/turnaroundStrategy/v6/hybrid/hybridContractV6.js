'use strict'
/**
 * turnaroundStrategy/v6/hybrid/hybridContractV6.js
 *
 * RC8.4 V6 R44 — HYBRID 10-SCREEN QUESTIONNAIRE CONTRACT (backend authority).
 *
 * 10 visible screens · 18 raw fields (17 required + 1 optional free text).
 *      S1  lifeStage
 *      S2  incomeStructure + occupationDetail (optional free text)
 *      S3  monthlySurplus
 *      S4  safetyMonths + debtPressure
 *      S5  skillValidation + monetizableSkill
 *      S6  weeklyTime + executionStability
 *      S7  pastAttemptStage + selfBelief
 *      S8  decisionStyle + timeBehavior
 *      S9  primaryProblem + primaryGoal
 *      S10 maxTrialCost + failureResponse
 *
 * AUTHORITY (frozen, non-negotiable):
 *   - V6 B1 remains the ONLY bottleneck-diagnosis authority.
 *   - The asset/reality layer has ZERO bottleneck authority.
 *   - AI has ZERO diagnosis authority.
 *   - The V4 engine is NEVER a runtime authority (historical mapping reference only).
 *
 * B1-CRITICAL CANONICAL SEMANTICS ARE REUSED VERBATIM (no SB_* / TB_* / PP_* ids):
 *   selfBelief     -> canonical BELIEF_*  (Q5 semantics)
 *   timeBehavior   -> canonical TIME_*    (Q8 semantics)
 *   primaryProblem -> canonical PROBLEM_* (Q4 semantics)
 *
 * Pure data + pure lookup. No I/O. No AI. No network. No scoring.
 */

const HYBRID_CONTRACT_VERSION = 'turnaround_strategy_v6_hybrid_10q_contract_v1'
const HYBRID_DIAGNOSTIC_VERSION = 'turnaround_strategy_v6_hybrid_10q'

// ── canonical B1 semantic option sets (verbatim from questionnaireContractV6) ──
const CANONICAL_BELIEF_IDS = [
  'BELIEF_NO_DIRECTION', 'BELIEF_KNOW_NO_ACTION', 'BELIEF_TRIED_NO_RESULT',
  'BELIEF_RESOURCE', 'BELIEF_TIME', 'BELIEF_FEAR', 'BELIEF_SWITCHING',
  'BELIEF_ABILITY', 'BELIEF_FAMILY', 'BELIEF_OTHER'
]
const CANONICAL_TIME_IDS = [
  'TIME_SHORT_FIRST', 'TIME_BALANCE', 'TIME_PROTECT_LONG', 'TIME_LONG_DROPS'
]
const CANONICAL_PROBLEM_IDS = [
  'PROBLEM_INCOME_STUCK', 'PROBLEM_NO_FUTURE', 'PROBLEM_DEBT', 'PROBLEM_CAREER_SWITCH',
  'PROBLEM_SIDE_UNSTARTED', 'PROBLEM_MONETIZE', 'PROBLEM_FOCUS', 'PROBLEM_OTHER'
]

// Canonical Chinese copy (frozen; mirrors questionnaireContractV6 canonical text).
const CANONICAL_TEXT = {
  BELIEF_NO_DIRECTION: '不知道该往哪走',
  BELIEF_KNOW_NO_ACTION: '知道方向，但一直没真正行动',
  BELIEF_TRIED_NO_RESULT: '做过不少尝试，但没结果',
  BELIEF_RESOURCE: '缺钱·缺资源',
  BELIEF_TIME: '没时间',
  BELIEF_FEAR: '怕失败',
  BELIEF_SWITCHING: '总在换方向',
  BELIEF_ABILITY: '能力还不够',
  BELIEF_FAMILY: '家庭·环境牵制',
  BELIEF_OTHER: '其他',
  TIME_SHORT_FIRST: '先做马上有结果的',
  TIME_BALANCE: '两边都会安排',
  TIME_PROTECT_LONG: '会固定给长期的事留时间',
  TIME_LONG_DROPS: '一忙起来，长期的事就先停',
  PROBLEM_INCOME_STUCK: '收入一直上不去',
  PROBLEM_NO_FUTURE: '工作看不到未来',
  PROBLEM_DEBT: '债务·现金流压力',
  PROBLEM_CAREER_SWITCH: '想转行，但不知道往哪走',
  PROBLEM_SIDE_UNSTARTED: '想做副业，但一直没做起来',
  PROBLEM_MONETIZE: '有能力，但不知道怎么变现',
  PROBLEM_FOCUS: '事情很多，一直无法聚焦',
  PROBLEM_OTHER: '其他'
}

// R43/R44 frozen prompt copy for the three B1-critical canonical selectors.
const FROZEN_PROMPTS = {
  selfBelief: '你觉得自己一直没真正做起来，最主要卡在哪？',
  timeBehavior: '如果一件事今天就能见效，另一件事要几个月才见效，你通常会怎么选？',
  primaryProblem: '未来12个月，如果只能先解决一个问题，你最想先解决什么？'
}

/**
 * The 10 screens. Each field declares its option ids + text.
 * `opt(key, optionId, text, v6)` binds the hybrid option to its canonical V6
 * semantic id where a GENUINELY EQUIVALENT canonical exists (else v6: null).
 */
const SCREENS = [
  {
    screen: 1, key: 'lifeStage', required: true, group: 'REALITY',
    prompt: '你目前处于什么人生阶段？',
    options: [
      ['LIFE_18_24', '18-24岁', 'AGE_18_24'],
      ['LIFE_25_30', '25-30岁', 'AGE_25_30'],
      ['LIFE_31_40', '31-40岁', 'AGE_31_40'],
      ['LIFE_41_50', '41-50岁', 'AGE_41_50'],
      ['LIFE_51_PLUS', '50岁以上', 'AGE_51_PLUS']
    ]
  },
  {
    screen: 2, key: 'incomeStructure', required: true, group: 'REALITY',
    prompt: '你的主要收入结构是？',
    secondaryText: { key: 'occupationDetail', required: false, placeholder: '（可选）你的具体职业，例如：厨师、销售、程序员' },
    options: [
      ['INC_SALARY', '工资/固定薪资', 'INCOME_SALARY'],
      ['INC_SKILL_SERVICE', '技能服务（按次/项目收费）', 'INCOME_FREELANCE'],
      ['INC_COMMISSION', '销售/佣金/提成', null],
      ['INC_BUSINESS', '实体生意/经营收入', 'INCOME_BUSINESS'],
      ['INC_CONTENT', '线上内容/流量变现', null],
      ['INC_ASSET', '资产/投资/租金收入', 'INCOME_ASSET'],
      ['INC_UNSTABLE', '收入不稳定', null]
    ]
  },
  {
    screen: 3, key: 'monthlySurplus', required: true, group: 'REALITY',
    prompt: '你每个月扣除所有支出后，还剩多少？',
    options: [
      ['SURPLUS_NEGATIVE', '负数（入不敷出）', 'SURPLUS_NONE'],
      ['SURPLUS_ZERO', '基本为零', 'SURPLUS_NONE'],
      ['SURPLUS_UNDER_1K', '1000元以下', 'SURPLUS_UNDER_1K'],
      ['SURPLUS_1K_5K', '1000-5000元', 'SURPLUS_1K_5K'],
      ['SURPLUS_5K_10K', '5000-10000元', 'SURPLUS_5K_10K'],
      ['SURPLUS_OVER_10K', '10000元以上', 'SURPLUS_OVER_10K']
    ]
  },
  {
    screen: 4, key: 'safetyMonths', required: true, group: 'REALITY',
    prompt: '如果明天开始你没有任何收入，存款能撑多久？',
    options: [
      ['SAFETY_UNDER_1', '不到1个月', null],
      ['SAFETY_1_3', '1-3个月', null],
      ['SAFETY_3_6', '3-6个月', null],
      ['SAFETY_6_12', '6-12个月', null],
      ['SAFETY_12_24', '12-24个月', null],
      ['SAFETY_24_PLUS', '24个月以上', null]
    ],
    secondary: {
      key: 'debtPressure', required: true,
      prompt: '你目前的负债情况是？',
      options: [
        ['DEBT_NONE', '无负债'],
        ['DEBT_MORTGAGE', '房贷为主（低月供）'],
        ['DEBT_CONSUMER', '消费贷/信用卡压力较大'],
        ['DEBT_HIGH', '债务压力高/以贷养贷']
      ]
    }
  },
  {
    screen: 5, key: 'skillValidation', required: true, group: 'ASSET',
    prompt: '你的能力被市场验证到什么程度了？',
    options: [
      ['PROOF_NEVER', '从未变现过', null],
      ['PROOF_FREE_HELPED', '免费帮人做过', null],
      ['PROOF_FREE_THANKED', '免费被感谢过', null],
      ['PROOF_PAID_ONCE', '赚到过一次钱', null],
      ['PROOF_OCCASIONAL', '偶尔有付费需求', null],
      ['PROOF_STABLE', '有稳定客户/收入', null]
    ],
    secondary: {
      key: 'monetizableSkill', required: true,
      prompt: '你最可能变现的能力是哪一类？',
      options: [
        ['ASSET_TECHNICAL', '技术类（编程/设计/工程）'],
        ['ASSET_SALES', '销售/商务谈单'],
        ['ASSET_OPS', '运营/管理/统筹'],
        ['ASSET_CONTENT', '内容创作（写/拍/剪/直播）'],
        ['ASSET_NETWORK', '人脉/资源对接'],
        ['ASSET_CRAFT', '手艺人（厨师/维修/美业）'],
        ['ASSET_UNCLEAR', '暂时不清楚']
      ]
    }
  },
  {
    screen: 6, key: 'weeklyTime', required: true, group: 'CAPACITY',
    prompt: '你每周能挤出多少可自由支配的时间？',
    options: [
      ['TIME_UNDER_2', '不到2小时', null],
      ['TIME_2_5', '2-5小时', null],
      ['TIME_5_10', '5-10小时', null],
      ['TIME_10_20', '10-20小时', null],
      ['TIME_20_PLUS', '20小时以上', null]
    ],
    secondary: {
      key: 'executionStability', required: true,
      prompt: '你的执行力更接近哪一种？',
      options: [
        ['EXEC_VOLATILE', '很容易三分钟热度，计划经常中断'],
        ['EXEC_UNSTABLE', '偶尔能坚持，但不稳定'],
        ['EXEC_STABLE', '有固定计划，基本能执行'],
        ['EXEC_VERY_STABLE', '非常稳定，不需要外部督促']
      ]
    }
  },
  {
    screen: 7, key: 'pastAttemptStage', required: true, group: 'STAGE',
    prompt: '过去一年，你最接近赚钱的一次尝试是？',
    options: [
      ['ATTEMPT_NONE', '还没开始过任何尝试', 'STAGE_THINKING'],
      ['ATTEMPT_COURSE_ONLY', '只买过课/看过教程，没真正做过', 'STAGE_LEARNING'],
      ['ATTEMPT_UNDER_30D', '坚持不到30天就停了', 'STAGE_STARTED'],
      ['ATTEMPT_NO_SALE', '做了一个产品/服务但没卖出去', 'STAGE_TESTING'],
      ['ATTEMPT_FEW_SALES', '卖出过几个，有少量收入', 'STAGE_EARLY_TRACTION'],
      ['ATTEMPT_STABLE_SIDE', '已有稳定的副业/兼职收入', 'STAGE_STABLE_TRACTION']
    ],
    secondary: {
      key: 'selfBelief', required: true,
      prompt: FROZEN_PROMPTS.selfBelief,
      canonical: true,
      options: CANONICAL_BELIEF_IDS.map((id) => [id, CANONICAL_TEXT[id], id])
    }
  },
  {
    screen: 8, key: 'decisionStyle', required: true, group: 'BEHAVIOR',
    prompt: '当一个机会看起来不错但不确定时，你一般怎么做？',
    options: [
      ['DECISION_ALL_IN', '直接辞职/全职All-in', null],
      ['DECISION_SMALL_TEST', '边上班边小规模测试', 'UNCERT_SMALL_TEST'],
      ['DECISION_LEARN_FIRST', '先学一阵子再判断', 'UNCERT_ANALYZE'],
      ['DECISION_WAIT_OTHERS', '等别人先做了我再跟上', 'UNCERT_WAIT'],
      ['DECISION_AVOID', '能不动就不动', null]
    ],
    secondary: {
      key: 'timeBehavior', required: true,
      prompt: FROZEN_PROMPTS.timeBehavior,
      canonical: true,
      options: CANONICAL_TIME_IDS.map((id) => [id, CANONICAL_TEXT[id], id])
    }
  },
  {
    screen: 9, key: 'primaryProblem', required: true, group: 'DESIRED_CHANGE',
    prompt: FROZEN_PROMPTS.primaryProblem,
    canonical: true,
    options: CANONICAL_PROBLEM_IDS.map((id) => [id, CANONICAL_TEXT[id], id]),
    secondary: {
      key: 'primaryGoal', required: true,
      prompt: '同一个未来12个月，这些里面你最想先做成的是哪件？',
      reportOnly: true,
      options: [
        ['GOAL_SIDE_INCOME', '搞一份副业收入'],
        ['GOAL_SKILL_MONETIZE', '把技能变现/做咨询'],
        ['GOAL_PERSONAL_BRAND', '建立个人IP/品牌'],
        ['GOAL_CAREER_SWITCH', '转行进入新领域'],
        ['GOAL_SIDE_TO_MAIN', '从副业变主业/独立'],
        ['GOAL_DEBT', '还清债务/修复现金流'],
        ['GOAL_FIND_DIRECTION', '先找到方向再说']
      ]
    }
  },
  {
    screen: 10, key: 'maxTrialCost', required: true, group: 'CAPACITY',
    prompt: '你能承受的最大试错成本是多少？',
    options: [
      ['COST_ZERO', '几乎为零（赔不起）', null],
      ['COST_UNDER_1K', '1000元以内', null],
      ['COST_1K_5K', '1000-5000元', null],
      ['COST_5K_20K', '5000-20000元', null],
      ['COST_OVER_20K', '20000元以上', null]
    ],
    secondary: {
      key: 'failureResponse', required: true,
      prompt: '如果试错失败了，你会？',
      options: [
        ['FAIL_GIVE_UP', '直接放弃，不再尝试', 'NORESULT_STOP'],
        ['FAIL_SWITCH', '换个方向继续试', 'NORESULT_SWITCH'],
        ['FAIL_RECHECK', '复盘优化后继续', 'NORESULT_RECHECK'],
        ['FAIL_ADD_MONEY', '追加投入再试一次', null],
        ['FAIL_UNSURE', '不确定', null]
      ]
    }
  }
]

// ── field registry ──────────────────────────────────────────────────────────
const FIELDS = [] // {key, screen, required, group, canonical:boolean}
for (const s of SCREENS) {
  FIELDS.push({
    key: s.key, screen: s.screen, required: s.required !== false,
    group: s.group, canonical: !!s.canonical
  })
  if (s.secondaryText) {
    FIELDS.push({
      key: s.secondaryText.key, screen: s.screen, required: false,
      group: s.group, canonical: false, freeText: true
    })
  }
  if (s.secondary) {
    FIELDS.push({
      key: s.secondary.key, screen: s.screen, required: s.secondary.required !== false,
      group: s.group, canonical: !!s.secondary.canonical, reportOnly: !!s.secondary.reportOnly
    })
  }
}

// Fast lookups.
const FIELD_BY_KEY = {}
for (const f of FIELDS) FIELD_BY_KEY[f.key] = f

const OPTIONS_BY_FIELD = {} // key -> [{optionId, text, v6}]
const OPTION_BY_ID = {} // key -> {optionId: {text, v6}}
for (const s of SCREENS) {
  const collect = (holder) => {
    if (!holder || !holder.key) return
    const list = (holder.options || []).map((o) => ({ optionId: o[0], text: o[1], v6: o[2] || null }))
    OPTIONS_BY_FIELD[holder.key] = list
    OPTION_BY_ID[holder.key] = {}
    for (const o of list) OPTION_BY_ID[holder.key][o.optionId] = { text: o.text, v6: o.v6 }
  }
  collect(s)
  collect(s.secondary)
  // secondaryText has no option list (free text)
  if (s.secondaryText) OPTIONS_BY_FIELD[s.secondaryText.key] = []
}

const REQUIRED_FIELD_KEYS = FIELDS.filter((f) => f.required).map((f) => f.key)
const ALL_FIELD_KEYS = FIELDS.map((f) => f.key)
const FREE_TEXT_FIELD_KEYS = FIELDS.filter((f) => f.freeText).map((f) => f.key)

const HYBRID_SCREEN_COUNT = SCREENS.length
const HYBRID_RAW_FIELD_COUNT = FIELDS.length

function isFreeText (key) { return FREE_TEXT_FIELD_KEYS.indexOf(key) !== -1 }
function isRequiredField (key) { return REQUIRED_FIELD_KEYS.indexOf(key) !== -1 }
function optionsFor (key) { return OPTIONS_BY_FIELD[key] || [] }
function resolveOptionId (key, value) {
  if (typeof value !== 'string') return null
  const map = OPTION_BY_ID[key]
  if (!map) return null
  return Object.prototype.hasOwnProperty.call(map, value) ? value : null
}
function canonicalFor (key, optionId) {
  const map = OPTION_BY_ID[key]
  if (!map || !map[optionId]) return null
  return map[optionId].v6 || null
}
function optionTextFor (key, optionId) {
  const map = OPTION_BY_ID[key]
  if (!map || !map[optionId]) return null
  return map[optionId].text
}

/**
 * Validate a hybrid submission. Fail-closed: unknown optionId → error (NEVER a
 * silent default to a valid semantic answer).
 * @param {Object} raw
 * @returns {{valid:boolean, errors:string[], malformed:boolean}}
 */
function validateHybridRaw (raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['INPUT_NOT_OBJECT'], malformed: true }
  }
  const errors = []
  for (const key of REQUIRED_FIELD_KEYS) {
    if (isFreeText(key)) continue
    const v = raw[key]
    if (v === undefined || v === null || v === '') { errors.push('MISSING:' + key); continue }
    if (!resolveOptionId(key, v)) errors.push('UNKNOWN_OPTION:' + key + ':' + v)
  }
  // optional free text: if present must be a string (never blocks)
  for (const key of FREE_TEXT_FIELD_KEYS) {
    const v = raw[key]
    if (v !== undefined && v !== null && typeof v !== 'string') errors.push('MALFORMED_TEXT:' + key)
  }
  return { valid: errors.length === 0, errors, malformed: false }
}

module.exports = {
  HYBRID_CONTRACT_VERSION,
  HYBRID_DIAGNOSTIC_VERSION,
  CANONICAL_BELIEF_IDS,
  CANONICAL_TIME_IDS,
  CANONICAL_PROBLEM_IDS,
  CANONICAL_TEXT,
  FROZEN_PROMPTS,
  SCREENS,
  FIELDS,
  FIELD_BY_KEY,
  REQUIRED_FIELD_KEYS,
  ALL_FIELD_KEYS,
  FREE_TEXT_FIELD_KEYS,
  HYBRID_SCREEN_COUNT,
  HYBRID_RAW_FIELD_COUNT,
  isFreeText,
  isRequiredField,
  optionsFor,
  resolveOptionId,
  canonicalFor,
  optionTextFor,
  validateHybridRaw
}
