'use strict'
/**
 * turnaroundStrategy/v6/questionnaireContractV6.js
 *
 * Canonical V6 9Q questionnaire contract.
 * Semantic option IDs are authoritative; Chinese copy is a lookup convenience.
 * No scores. No weights. No percentages. No probability.
 *
 * Pure data + pure lookup. No I/O. No AI. No network.
 */

const CONTRACT_VERSION = 'turnaround_strategy_v6_contract_v1'
const QUESTIONNAIRE_VERSION = 'turnaround_strategy_v6'

/**
 * Normalize an option string for lookup:
 *  - strip all whitespace
 *  - unify middot separators to '/'
 *  - unify en/em dashes to '-'
 * Visible copy may vary (e.g. '生意·个体经营' vs '生意 / 个体经营'); the
 * normalized key is what the runtime binds to.
 */
function norm (s) {
  if (typeof s !== 'string') return ''
  return s.replace(/\s+/g, '').replace(/·/g, '/').replace(/[–—]/g, '-')
}

// Question definitions: {id, key, group, options:[[optionId, canonicalText], ...]}
const QUESTIONS = [
  {
    id: 'Q1', key: 'AGE_STAGE', group: 'REALITY',
    options: [
      ['AGE_18_24', '18–24'],
      ['AGE_25_30', '25–30'],
      ['AGE_31_40', '31–40'],
      ['AGE_41_50', '41–50'],
      ['AGE_51_PLUS', '51+']
    ]
  },
  {
    id: 'Q2', key: 'INCOME_MODE', group: 'REALITY',
    options: [
      ['INCOME_SALARY', '固定工资'],
      ['INCOME_BUSINESS', '生意·个体经营'],
      ['INCOME_FREELANCE', '自由职业·接单'],
      ['INCOME_ASSET', '投资·资产收入'],
      ['INCOME_NONE', '暂时没有稳定收入'],
      ['INCOME_OTHER', '其他']
    ]
  },
  {
    id: 'Q3', key: 'MONTHLY_SURPLUS', group: 'REALITY',
    options: [
      ['SURPLUS_NONE', '基本留不下·经常不够'],
      ['SURPLUS_UNDER_1K', '1000元以下'],
      ['SURPLUS_1K_5K', '1000–5000元'],
      ['SURPLUS_5K_10K', '5000–10000元'],
      ['SURPLUS_OVER_10K', '1万元以上']
    ]
  },
  {
    id: 'Q4', key: 'PRIMARY_PROBLEM', group: 'DESIRED_CHANGE',
    options: [
      ['PROBLEM_INCOME_STUCK', '收入一直上不去'],
      ['PROBLEM_NO_FUTURE', '工作看不到未来'],
      ['PROBLEM_DEBT', '债务·现金流压力'],
      ['PROBLEM_CAREER_SWITCH', '想转行，但不知道往哪走'],
      ['PROBLEM_SIDE_UNSTARTED', '想做副业，但一直没做起来'],
      ['PROBLEM_MONETIZE', '有能力，但不知道怎么变现'],
      ['PROBLEM_FOCUS', '事情很多，一直无法聚焦'],
      ['PROBLEM_OTHER', '其他']
    ]
  },
  {
    id: 'Q5', key: 'USER_BELIEF', group: 'BELIEF',
    options: [
      ['BELIEF_NO_DIRECTION', '不知道该往哪走'],
      ['BELIEF_KNOW_NO_ACTION', '知道方向，但一直没真正行动'],
      ['BELIEF_TRIED_NO_RESULT', '做过不少尝试，但没结果'],
      ['BELIEF_RESOURCE', '缺钱·缺资源'],
      ['BELIEF_TIME', '没时间'],
      ['BELIEF_FEAR', '怕失败'],
      ['BELIEF_SWITCHING', '总在换方向'],
      ['BELIEF_ABILITY', '能力还不够'],
      ['BELIEF_FAMILY', '家庭·环境牵制'],
      ['BELIEF_OTHER', '其他']
    ]
  },
  {
    id: 'Q6', key: 'EXECUTION_STAGE', group: 'STAGE',
    options: [
      ['STAGE_THINKING', '主要还在想'],
      ['STAGE_RESEARCHING', '查过很多资料'],
      ['STAGE_LEARNING', '学过东西，但没真正开始'],
      ['STAGE_STARTED', '开始做过，但没坚持多久'],
      ['STAGE_TESTING', '做过产品·服务，但没人买单'],
      ['STAGE_EARLY_TRACTION', '已经有人愿意付钱'],
      ['STAGE_STABLE_TRACTION', '已经有一点稳定结果']
    ]
  },
  {
    id: 'Q7', key: 'UNCERTAINTY_BEHAVIOR', group: 'BEHAVIOR',
    options: [
      ['UNCERT_SMALL_TEST', '先做个很小的版本试试'],
      ['UNCERT_WAIT', '再等等，信息更充分再说'],
      ['UNCERT_ASK_OTHERS', '先问几个做过的人'],
      ['UNCERT_ANALYZE', '先把可能的问题都想清楚']
    ]
  },
  {
    id: 'Q8', key: 'TIME_BEHAVIOR', group: 'BEHAVIOR',
    options: [
      ['TIME_SHORT_FIRST', '先做马上有结果的'],
      ['TIME_BALANCE', '两边都会安排'],
      ['TIME_PROTECT_LONG', '会固定给长期的事留时间'],
      ['TIME_LONG_DROPS', '一忙起来，长期的事就先停']
    ]
  },
  {
    id: 'Q9', key: 'NO_RESULT_BEHAVIOR', group: 'BEHAVIOR',
    options: [
      ['NORESULT_SWITCH', '换个方向试试'],
      ['NORESULT_PERSIST', '再坚持一阵'],
      ['NORESULT_ASK_OTHERS', '找别人看看我哪里做错了'],
      ['NORESULT_RECHECK', '重新检查方法和步骤'],
      ['NORESULT_STOP', '先停下来，不再继续投入']
    ]
  }
]

// Build lookup maps.
const BY_ID = {} // qid -> {optionId: canonicalText}
const BY_NORM = {} // qid -> {normalizedText: optionId}
const KEY_TO_ID = {} // semantic key (AGE_STAGE) -> Q1
const ID_TO_KEY = {} // Q1 -> AGE_STAGE
const ID_TO_GROUP = {}

for (const q of QUESTIONS) {
  BY_ID[q.id] = {}
  BY_NORM[q.id] = {}
  KEY_TO_ID[q.key] = q.id
  ID_TO_KEY[q.id] = q.key
  ID_TO_GROUP[q.id] = q.group
  for (const [optId, text] of q.options) {
    BY_ID[q.id][optId] = text
    BY_NORM[q.id][norm(text)] = optId
  }
}

/** Resolve a canonical question ref ('Q1' or 'AGE_STAGE') to 'Q1'. */
function canonicalQid (ref) {
  if (KEY_TO_ID[ref]) return KEY_TO_ID[ref]
  if (BY_ID[ref]) return ref
  return null
}

/**
 * Resolve an answer value (semantic option id OR canonical text variant)
 * to a semantic option id. Returns null if unresolvable.
 */
function resolveOption (qid, value) {
  const q = canonicalQid(qid)
  if (!q) return null
  if (value == null) return null
  if (BY_ID[q][value]) return value
  const n = norm(value)
  return BY_NORM[q][n] || null
}

/** Canonical text for an option id. */
function optionText (qid, optionId) {
  const q = canonicalQid(qid)
  if (!q) return null
  return BY_ID[q][optionId] || null
}

module.exports = {
  CONTRACT_VERSION,
  QUESTIONNAIRE_VERSION,
  QUESTIONS,
  KEY_TO_ID,
  ID_TO_KEY,
  ID_TO_GROUP,
  norm,
  canonicalQid,
  resolveOption,
  optionText
}
