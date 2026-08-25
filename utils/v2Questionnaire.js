/**
 * utils/v2Questionnaire.js
 *
 * World Model v2 — 客户端 18 题问卷数据结构（Stage 16B）。
 *
 * 与云函数冻结 contract（engine/worldModel/v2/questionnaireV2.js）严格对齐：
 *   - 18 个 question（稳定 id）
 *   - 74 个 option（稳定 optionId，A/B/C/D/E）
 *   - 中文文案仅用于 UI 展示，绝不作为 inference key
 *
 * 客户端提交稳定协议：
 *   diagnosticVersion = 'world_model_v2'
 *   answers = [ { questionId, optionId }, ... ]
 *
 * @version world_model_v2
 */

// U1-U5 内部 allowlist（与云端 RC83_WORLD_MODEL_ALLOWLIST 一致）
const V2_INTERNAL_ALLOWLIST = [
  'oZa463Yb2VY0k9Es_pGzdHFtigNo', // U1
  'oZa463TBnL6-nVamuxxIi4UcDflY', // U2
  'oZa463aevHMMq68difgd7RNWycCY', // U3
  'oZa463b1OpLdxZKgH-2Q2oJ0Yl60', // U4
  'oZa463Te7dLGGA5yQlRearlD8B3I', // U5
]

// 18 题，每题 4-5 个选项。id/optionId 为稳定 ID（契约 key），text 仅展示。
const V2_QUESTIONS = [
  {
    id: 'Q_DEC_01', construct: 'DECISION', text: '最近一次你有了一个想做的事，从「想到」到「第一次动手」，隔了多久？',
    options: [
      { optionId: 'A', text: '当天就动手' },
      { optionId: 'B', text: '几天到一周' },
      { optionId: 'C', text: '几周到一个月' },
      { optionId: 'D', text: '一个月以上' },
      { optionId: 'E', text: '到现在还没动手' },
    ],
  },
  {
    id: 'Q_DEC_02', construct: 'DECISION', text: '一个看起来不错、但结果不确定的机会，你通常怎么处理？',
    options: [
      { optionId: 'A', text: '先做个小实验试一下' },
      { optionId: 'B', text: '边做边看，随时调整' },
      { optionId: 'C', text: '先想清楚再决定' },
      { optionId: 'D', text: '等别人先做了我再跟' },
      { optionId: 'E', text: '先放着，等更确定' },
    ],
  },
  {
    id: 'Q_FB_01', construct: 'FEEDBACK', text: '做完一件重要的事之后，你通常怎么做？',
    options: [
      { optionId: 'A', text: '我会复盘，记下什么有效' },
      { optionId: 'B', text: '简单想想，很少记录' },
      { optionId: 'C', text: '做完就换下一件' },
      { optionId: 'D', text: '很少做重要的事' },
    ],
  },
  {
    id: 'Q_FB_02', construct: 'FEEDBACK', text: '你会主动让别人（或市场）评价你的成果吗？',
    options: [
      { optionId: 'A', text: '经常主动找人/市场验证' },
      { optionId: 'B', text: '偶尔，被问才说' },
      { optionId: 'C', text: '基本不，自己判断' },
      { optionId: 'D', text: '刻意回避被评价' },
    ],
  },
  {
    id: 'Q_PROB_01', construct: 'PROBABILITY', text: '做重要决定时，你如何估计「成功的可能有多大」？',
    options: [
      { optionId: 'A', text: '给个百分比或区间' },
      { optionId: 'B', text: '会说大概率/小概率' },
      { optionId: 'C', text: '只判断行/不行' },
      { optionId: 'D', text: '凭感觉，不估计' },
    ],
  },
  {
    id: 'Q_PROB_02', construct: 'PROBABILITY', text: '做决定前，你会去查同类事情的成功/失败比例吗？',
    options: [
      { optionId: 'A', text: '会查数据/案例比例' },
      { optionId: 'B', text: '偶尔想起来会查' },
      { optionId: 'C', text: '不会，凭自己的判断' },
      { optionId: 'D', text: '从没想过要查' },
    ],
  },
  {
    id: 'Q_RISK_01', construct: 'RISK', text: '一个能承受的、可逆的小风险，你一般怎么处理？',
    options: [
      { optionId: 'A', text: '会去试，可逆就敢做' },
      { optionId: 'B', text: '看情况，损失可控就做' },
      { optionId: 'C', text: '尽量回避所有风险' },
      { optionId: 'D', text: '没想过可逆不可逆' },
    ],
  },
  {
    id: 'Q_RISK_02', construct: 'RISK', text: '决定前，你会提前算「最坏会亏多少」吗？',
    options: [
      { optionId: 'A', text: '会，明确算最坏情况' },
      { optionId: 'B', text: '大概想过，没细算' },
      { optionId: 'C', text: '不会，只想着能赚多少' },
      { optionId: 'D', text: '从不算，凭感觉' },
    ],
  },
  {
    id: 'Q_LEV_01', construct: 'LEVERAGE', text: '你的成果是一次性交付，还是能被反复使用/放大？',
    options: [
      { optionId: 'A', text: '一次交付一次回报' },
      { optionId: 'B', text: '部分成果能复用' },
      { optionId: 'C', text: '我做的东西能反复卖/用' },
      { optionId: 'D', text: '没想过复用这回事' },
    ],
  },
  {
    id: 'Q_LEV_02', construct: 'LEVERAGE', text: '你会用工具、流程、或别人的力量来放大自己的产出吗？',
    options: [
      { optionId: 'A', text: '会，用系统/工具/团队放大' },
      { optionId: 'B', text: '偶尔用工具提效' },
      { optionId: 'C', text: '全靠自己一个人做' },
      { optionId: 'D', text: '没想过放大产出' },
    ],
  },
  {
    id: 'Q_TIME_01', construct: 'TIME', text: '你会给「几个月后才见效」的事留固定的时间吗？',
    options: [
      { optionId: 'A', text: '有固定的时间块' },
      { optionId: 'B', text: '偶尔，忙起来就挤掉' },
      { optionId: 'C', text: '基本没有，都忙眼前' },
      { optionId: 'D', text: '只做马上见效的事' },
    ],
  },
  {
    id: 'Q_TIME_02', construct: 'TIME', text: '过去三个月，你是否持续投入同一个方向？',
    options: [
      { optionId: 'A', text: '一直在同一个方向' },
      { optionId: 'B', text: '换过一两次' },
      { optionId: 'C', text: '换来换去，没定下来' },
      { optionId: 'D', text: '没投入任何方向' },
    ],
  },
  {
    id: 'Q_ID_01', construct: 'IDENTITY', text: '你更常怎么描述自己？',
    options: [
      { optionId: 'A', text: '我是XX职业的人' },
      { optionId: 'B', text: '我能做XX这些事' },
      { optionId: 'C', text: '我拥有这些能力，可以做很多' },
      { optionId: 'D', text: '没想过这个问题' },
    ],
  },
  {
    id: 'Q_ID_02', construct: 'IDENTITY', text: '你做过当前身份/职业之外的事吗？',
    options: [
      { optionId: 'A', text: '经常做跨领域的事' },
      { optionId: 'B', text: '做过一两次' },
      { optionId: 'C', text: '从没做过' },
      { optionId: 'D', text: '想做但没敢做' },
    ],
  },
  {
    id: 'Q_OPP_01', construct: 'OPPORTUNITY', text: '你的新想法/新机会通常从哪里来？',
    options: [
      { optionId: 'A', text: '来自不同领域的人/信息' },
      { optionId: 'B', text: '来自我熟悉的圈子' },
      { optionId: 'C', text: '很少遇到新机会' },
      { optionId: 'D', text: '主要靠被动等' },
    ],
  },
  {
    id: 'Q_OPP_02', construct: 'OPPORTUNITY', text: '你常接触的人里，多少和你背景不同？',
    options: [
      { optionId: 'A', text: '很多不同背景的人' },
      { optionId: 'B', text: '有一些' },
      { optionId: 'C', text: '基本都是同类' },
      { optionId: 'D', text: '几乎不接触外人' },
    ],
  },
  {
    id: 'Q_SYS_01', construct: 'SYSTEMS', text: '反复出现的问题，你倾向认为是单个事件，还是背后某个系统造成的？',
    options: [
      { optionId: 'A', text: '是背后系统造成的' },
      { optionId: 'B', text: '有时是系统，有时是偶然' },
      { optionId: 'C', text: '就是单个独立事件' },
      { optionId: 'D', text: '没想过这个区别' },
    ],
  },
  {
    id: 'Q_SYS_02', construct: 'SYSTEMS', text: '解决问题时，你倾向先找根本原因，还是先处理表面症状？',
    options: [
      { optionId: 'A', text: '先找根本原因' },
      { optionId: 'B', text: '看情况，紧急先灭火' },
      { optionId: 'C', text: '先处理表面症状' },
      { optionId: 'D', text: '处理完就完了，不深究' },
    ],
  },
]

/**
 * 校验客户端已收集的答案是否满足冻结 contract：
 *   - 18/18 题全部作答
 *   - optionId 均为已知合法值
 *   - 无重复 questionId
 * 返回 { valid, errors }（仅客户端前置校验，最终以服务端 validateV2Answers 为准）。
 */
function validateV2AnswersClient(answersMap) {
  var errors = []
  var byId = {}
  V2_QUESTIONS.forEach(function (q) { byId[q.id] = q })

  var answered = 0
  var seen = {}
  Object.keys(answersMap || {}).forEach(function (qid) {
    var q = byId[qid]
    if (!q) { errors.push('UNKNOWN_QUESTION:' + qid); return }
    if (seen[qid]) { errors.push('DUPLICATE_QUESTION:' + qid); return }
    seen[qid] = true
    var oid = answersMap[qid]
    var validOpt = q.options.some(function (o) { return o.optionId === oid })
    if (!validOpt) errors.push('UNKNOWN_OPTION:' + qid + ':' + oid)
    else answered++
  })

  var missing = V2_QUESTIONS.filter(function (q) { return !(q.id in (answersMap || {})) })
  if (missing.length > 0) errors.push('MISSING:' + missing.map(function (q) { return q.id }).join(','))

  return { valid: errors.length === 0 && answered === V2_QUESTIONS.length, errors: errors, answered: answered }
}

/**
 * 把 { questionId: optionId } 答案映射为提交协议数组 [{ questionId, optionId }]。
 * 中文 option text 绝不出现在 payload 中，仅 optionId 作为契约 key。
 */
function buildV2SubmissionPayload(answersMap) {
  return {
    diagnosticVersion: 'world_model_v2',
    answers: V2_QUESTIONS.map(function (q) {
      return { questionId: q.id, optionId: answersMap[q.id] }
    }),
  }
}

module.exports = {
  V2_QUESTIONS,
  V2_INTERNAL_ALLOWLIST,
  validateV2AnswersClient,
  buildV2SubmissionPayload,
}
