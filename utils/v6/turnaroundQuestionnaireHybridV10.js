'use strict'
/**
 * utils/v6/turnaroundQuestionnaireHybridV10.js
 *
 * RC8.4 V6 R44 — production CLIENT HYBRID 10-SCREEN questionnaire.
 *
 * Single source of truth for the client. Mirrors the FROZEN backend contract
 * `cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6/hybrid/hybridContractV6.js`
 * EXACTLY: 10 visible screens, 18 raw fields, canonical B1 option ids for the
 * three B1-critical selectors (selfBelief / timeBehavior / primaryProblem).
 *
 * Client is PRESENTATION + INPUT only: it never diagnoses, scores or rewrites.
 * It submits the explicit hybrid contract version and renders the returned
 * five-card report.
 *
 * Pure data + pure helpers. No I/O, no wx, no AI, no network.
 */

const HYBRID_DIAGNOSTIC_VERSION = 'turnaround_strategy_v6_hybrid_10q'
const HYBRID_CONTRACT_VERSION = 'turnaround_strategy_v6_hybrid_10q_contract_v1'
const HYBRID_SCREEN_COUNT = 10

// Reused canonical option sets (verbatim ids/text from the V6 contract).
const BELIEF_OPTIONS = [
  ['BELIEF_NO_DIRECTION', '不知道该往哪走'],
  ['BELIEF_KNOW_NO_ACTION', '知道方向，但一直没真正行动'],
  ['BELIEF_TRIED_NO_RESULT', '做过不少尝试，但没结果'],
  ['BELIEF_RESOURCE', '缺钱·缺资源'],
  ['BELIEF_TIME', '没时间'],
  ['BELIEF_FEAR', '怕失败'],
  ['BELIEF_SWITCHING', '总在换方向'],
  ['BELIEF_ABILITY', '能力还不够'],
  ['BELIEF_FAMILY', '家庭·环境牵制'],
  ['BELIEF_OTHER', '其他'],
]
const TIME_OPTIONS = [
  ['TIME_SHORT_FIRST', '先做马上有结果的'],
  ['TIME_BALANCE', '两边都会安排'],
  ['TIME_PROTECT_LONG', '会固定给长期的事留时间'],
  ['TIME_LONG_DROPS', '一忙起来，长期的事就先停'],
]
const PROBLEM_OPTIONS = [
  ['PROBLEM_INCOME_STUCK', '收入一直上不去'],
  ['PROBLEM_NO_FUTURE', '工作看不到未来'],
  ['PROBLEM_DEBT', '债务·现金流压力'],
  ['PROBLEM_CAREER_SWITCH', '想转行，但不知道往哪走'],
  ['PROBLEM_SIDE_UNSTARTED', '想做副业，但一直没做起来'],
  ['PROBLEM_MONETIZE', '有能力，但不知道怎么变现'],
  ['PROBLEM_FOCUS', '事情很多，一直无法聚焦'],
  ['PROBLEM_OTHER', '其他'],
]

const opt = (list) => list.map((o) => ({ optionId: o[0], text: o[1] }))

const HYBRID_SCREENS = [
  {
    sid: 'S1', key: 'lifeStage', prompt: '你目前处于什么人生阶段？',
    options: opt([
      ['LIFE_18_24', '18-24岁'], ['LIFE_25_30', '25-30岁'], ['LIFE_31_40', '31-40岁'],
      ['LIFE_41_50', '41-50岁'], ['LIFE_51_PLUS', '50岁以上'],
    ]),
  },
  {
    sid: 'S2', key: 'incomeStructure', prompt: '你的主要收入结构是？',
    options: opt([
      ['INC_SALARY', '工资/固定薪资'], ['INC_SKILL_SERVICE', '技能服务（按次/项目收费）'],
      ['INC_COMMISSION', '销售/佣金/提成'], ['INC_BUSINESS', '实体生意/经营收入'],
      ['INC_CONTENT', '线上内容/流量变现'], ['INC_ASSET', '资产/投资/租金收入'],
      ['INC_UNSTABLE', '收入不稳定'],
    ]),
    secondaryText: { key: 'occupationDetail', placeholder: '（可选）你的具体职业，例如：厨师、销售、程序员' },
  },
  {
    sid: 'S3', key: 'monthlySurplus', prompt: '你每个月扣除所有支出后，还剩多少？',
    options: opt([
      ['SURPLUS_NEGATIVE', '负数（入不敷出）'], ['SURPLUS_ZERO', '基本为零'],
      ['SURPLUS_UNDER_1K', '1000元以下'], ['SURPLUS_1K_5K', '1000-5000元'],
      ['SURPLUS_5K_10K', '5000-10000元'], ['SURPLUS_OVER_10K', '10000元以上'],
    ]),
  },
  {
    sid: 'S4', key: 'safetyMonths', prompt: '如果明天开始你没有任何收入，存款能撑多久？',
    options: opt([
      ['SAFETY_UNDER_1', '不到1个月'], ['SAFETY_1_3', '1-3个月'], ['SAFETY_3_6', '3-6个月'],
      ['SAFETY_6_12', '6-12个月'], ['SAFETY_12_24', '12-24个月'], ['SAFETY_24_PLUS', '24个月以上'],
    ]),
    secondary: {
      key: 'debtPressure', required: true, prompt: '你目前的负债情况是？',
      options: opt([
        ['DEBT_NONE', '无负债'], ['DEBT_MORTGAGE', '房贷为主（低月供）'],
        ['DEBT_CONSUMER', '消费贷/信用卡压力较大'], ['DEBT_HIGH', '债务压力高/以贷养贷'],
      ]),
    },
  },
  {
    sid: 'S5', key: 'skillValidation', prompt: '你的能力被市场验证到什么程度了？',
    options: opt([
      ['PROOF_NEVER', '从未变现过'], ['PROOF_FREE_HELPED', '免费帮人做过'],
      ['PROOF_FREE_THANKED', '免费被感谢过'], ['PROOF_PAID_ONCE', '赚到过一次钱'],
      ['PROOF_OCCASIONAL', '偶尔有付费需求'], ['PROOF_STABLE', '有稳定客户/收入'],
    ]),
    secondary: {
      key: 'monetizableSkill', required: true, prompt: '你最可能变现的能力是哪一类？',
      options: opt([
        ['ASSET_TECHNICAL', '技术类（编程/设计/工程）'], ['ASSET_SALES', '销售/商务谈单'],
        ['ASSET_OPS', '运营/管理/统筹'], ['ASSET_CONTENT', '内容创作（写/拍/剪/直播）'],
        ['ASSET_NETWORK', '人脉/资源对接'], ['ASSET_CRAFT', '手艺人（厨师/维修/美业）'],
        ['ASSET_UNCLEAR', '暂时不清楚'],
      ]),
    },
  },
  {
    sid: 'S6', key: 'weeklyTime', prompt: '你每周能挤出多少可自由支配的时间？',
    options: opt([
      ['TIME_UNDER_2', '不到2小时'], ['TIME_2_5', '2-5小时'], ['TIME_5_10', '5-10小时'],
      ['TIME_10_20', '10-20小时'], ['TIME_20_PLUS', '20小时以上'],
    ]),
    secondary: {
      key: 'executionStability', required: true, prompt: '你的执行力更接近哪一种？',
      options: opt([
        ['EXEC_VOLATILE', '很容易三分钟热度，计划经常中断'],
        ['EXEC_UNSTABLE', '偶尔能坚持，但不稳定'],
        ['EXEC_STABLE', '有固定计划，基本能执行'],
        ['EXEC_VERY_STABLE', '非常稳定，不需要外部督促'],
      ]),
    },
  },
  {
    sid: 'S7', key: 'pastAttemptStage', prompt: '过去一年，你最接近赚钱的一次尝试是？',
    options: opt([
      ['ATTEMPT_NONE', '还没开始过任何尝试'], ['ATTEMPT_COURSE_ONLY', '只买过课/看过教程，没真正做过'],
      ['ATTEMPT_UNDER_30D', '坚持不到30天就停了'], ['ATTEMPT_NO_SALE', '做了一个产品/服务但没卖出去'],
      ['ATTEMPT_FEW_SALES', '卖出过几个，有少量收入'], ['ATTEMPT_STABLE_SIDE', '已有稳定的副业/兼职收入'],
    ]),
    secondary: {
      key: 'selfBelief', required: true, canonical: true,
      prompt: '你觉得自己一直没真正做起来，最主要卡在哪？',
      options: opt(BELIEF_OPTIONS),
    },
  },
  {
    sid: 'S8', key: 'decisionStyle', prompt: '当一个机会看起来不错但不确定时，你一般怎么做？',
    options: opt([
      ['DECISION_ALL_IN', '直接辞职/全职All-in'], ['DECISION_SMALL_TEST', '边上班边小规模测试'],
      ['DECISION_LEARN_FIRST', '先学一阵子再判断'], ['DECISION_WAIT_OTHERS', '等别人先做了我再跟上'],
      ['DECISION_AVOID', '能不动就不动'],
    ]),
    secondary: {
      key: 'timeBehavior', required: true, canonical: true,
      prompt: '如果一件事今天就能见效，另一件事要几个月才见效，你通常会怎么选？',
      options: opt(TIME_OPTIONS),
    },
  },
  {
    sid: 'S9', key: 'primaryProblem', canonical: true,
    prompt: '未来12个月，如果只能先解决一个问题，你最想先解决什么？',
    options: opt(PROBLEM_OPTIONS),
    secondary: {
      key: 'primaryGoal', required: true, reportOnly: true,
      prompt: '同一个未来12个月，这些里面你最想先做成的是哪件？',
      options: opt([
        ['GOAL_SIDE_INCOME', '搞一份副业收入'], ['GOAL_SKILL_MONETIZE', '把技能变现/做咨询'],
        ['GOAL_PERSONAL_BRAND', '建立个人IP/品牌'], ['GOAL_CAREER_SWITCH', '转行进入新领域'],
        ['GOAL_SIDE_TO_MAIN', '从副业变主业/独立'], ['GOAL_DEBT', '还清债务/修复现金流'],
        ['GOAL_FIND_DIRECTION', '先找到方向再说'],
      ]),
    },
  },
  {
    sid: 'S10', key: 'maxTrialCost', prompt: '你能承受的最大试错成本是多少？',
    options: opt([
      ['COST_ZERO', '几乎为零（赔不起）'], ['COST_UNDER_1K', '1000元以内'],
      ['COST_1K_5K', '1000-5000元'], ['COST_5K_20K', '5000-20000元'], ['COST_OVER_20K', '20000元以上'],
    ]),
    secondary: {
      key: 'failureResponse', required: true, prompt: '如果试错失败了，你会？',
      options: opt([
        ['FAIL_GIVE_UP', '直接放弃，不再尝试'], ['FAIL_SWITCH', '换个方向继续试'],
        ['FAIL_RECHECK', '复盘优化后继续'], ['FAIL_ADD_MONEY', '追加投入再试一次'],
        ['FAIL_UNSURE', '不确定'],
      ]),
    },
  },
]

/** Flat list of every answerable field across the 10 screens. */
function allFieldKeys () {
  const keys = []
  for (const s of HYBRID_SCREENS) {
    keys.push(s.key)
    if (s.secondaryText) keys.push(s.secondaryText.key)
    if (s.secondary) keys.push(s.secondary.key)
  }
  return keys
}

function getScreensHybridV10 () {
  return HYBRID_SCREENS.map((s) => ({
    sid: s.sid,
    key: s.key,
    prompt: s.prompt,
    canonical: !!s.canonical,
    options: s.options.map((o) => ({ optionId: o.optionId, text: o.text })),
    secondaryText: s.secondaryText
      ? { key: s.secondaryText.key, placeholder: s.secondaryText.placeholder }
      : null,
    secondary: s.secondary
      ? {
          key: s.secondary.key,
          prompt: s.secondary.prompt,
          required: s.secondary.required !== false,
          canonical: !!s.secondary.canonical,
          options: s.secondary.options.map((o) => ({ optionId: o.optionId, text: o.text })),
        }
      : null,
  }))
}

/** True when a screen's REQUIRED fields (main + required secondary) are chosen. */
function isScreenComplete (screen, answers) {
  const a = answers || {}
  if (!a[screen.key]) return false
  if (screen.secondary && screen.secondary.required !== false && !a[screen.secondary.key]) return false
  return true
}

/** Unknown optionId → invalid (never a silent default). */
function validateAnswersHybridV10 (answers) {
  const errors = []
  const a = answers || {}
  for (const s of HYBRID_SCREENS) {
    const main = a[s.key]
    if (!main) { errors.push('MISSING:' + s.key); continue }
    if (!s.options.some((o) => o.optionId === main)) errors.push('UNKNOWN_OPTION:' + s.key + ':' + main)
    if (s.secondary) {
      const sec = a[s.secondary.key]
      if (s.secondary.required !== false) {
        if (!sec) { errors.push('MISSING:' + s.secondary.key); continue }
      }
      if (sec && !s.secondary.options.some((o) => o.optionId === sec)) {
        errors.push('UNKNOWN_OPTION:' + s.secondary.key + ':' + sec)
      }
    }
  }
  return { valid: errors.length === 0, errors }
}

/** Build the explicit hybrid cloud request (never masquerades as an old version). */
function buildCloudRequestHybridV10 (answers) {
  const a = answers || {}
  const out = {}
  for (const k of allFieldKeys()) {
    const v = a[k]
    if (typeof v === 'string' && v.trim()) out[k] = v.trim()
  }
  return {
    name: 'generateAiReport',
    data: {
      type: 'diagnostic',
      diagnosticVersion: HYBRID_DIAGNOSTIC_VERSION,
      answers: out,
    },
  }
}

module.exports = {
  HYBRID_DIAGNOSTIC_VERSION,
  HYBRID_CONTRACT_VERSION,
  HYBRID_SCREEN_COUNT,
  getScreensHybridV10,
  allFieldKeys,
  isScreenComplete,
  validateAnswersHybridV10,
  buildCloudRequestHybridV10,
}
