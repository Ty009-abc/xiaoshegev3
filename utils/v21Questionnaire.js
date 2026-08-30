/**
 * utils/v21Questionnaire.js
 *
 * RC8.3 Stage20 R6-R4 — World Model V2.1 客户端安全镜像（18 题 / 65 选项）。
 *
 * 与云函数冻结契约严格对齐（engine/worldModel/v2_1/questionnaireV21.js）：
 *   - 18 个 question（稳定 questionId：SC_DEC_01 … SC_SYS_02）
 *   - 65 个 option（稳定 optionId：A/B/C/D）
 *   - 中文文案仅用于 UI 展示，绝不作为 inference key
 *
 * 客户端提交稳定协议：
 *   diagnosticVersion = 'world_model_v2_1'
 *   answers = [ { questionId, optionId, displayPosition }, ... ]  （裸 18 元组数组）
 *
 * 安全边界（R6-R3 §2）：
 *   - 不暴露服务端推理元数据（命题引用 / 证据编号 / 扭曲类型 /
 *     构念评分内部 / 盲点映射）
 *   - displayPosition 是「渲染后实际索引」的唯一来源（R3C），绝不由 optionId 推导
 *
 * @version world_model_v2_1 (client mirror)
 */

const QUESTION_COUNT_V21 = 18
const OPTION_COUNT_TOTAL_V21 = 65

const V21_QUESTIONS = [
  // ── DECISION ──
  {
    questionId: 'SC_DEC_01',
    prompt: "你有个想了一阵子的机会，条件七成成熟但没完全确定。你更可能？",
    options: [
      { optionId: 'A', text: '先投一点，试出结果再说' },
      { optionId: 'B', text: '等更确定再动' },
      { optionId: 'C', text: '问几个做过的人，他们说行我才敢' },
      { optionId: 'D', text: '把能想到的风险都列清楚再决定' },
    ],
  },
  {
    questionId: 'SC_DEC_02',
    prompt: "有一条可能改变你判断的新信息，但要再多等一天。你更可能？",
    options: [
      { optionId: 'A', text: '等，信息值这一天' },
      { optionId: 'B', text: '不等，先做，边做边看' },
      { optionId: 'C', text: '没想过信息能改变判断' },
    ],
  },

  // ── FEEDBACK ──
  {
    questionId: 'SC_FB_01',
    prompt: "你做的东西被一个你尊重的人否定了，但他的理由你不同意。你更可能？",
    options: [
      { optionId: 'A', text: '找他当面问清楚分歧在哪' },
      { optionId: 'B', text: '先放着，按自己判断继续' },
      { optionId: 'C', text: '换个更懂行的人再问问' },
      { optionId: 'D', text: '记下分歧，但继续不改' },
    ],
  },
  {
    questionId: 'SC_FB_02',
    prompt: "你的方案被否了两次，理由各不相同。你更可能认为？",
    options: [
      { optionId: 'A', text: '我的方案有问题，该改' },
      { optionId: 'B', text: '他们没看懂，我再解释清楚' },
      { optionId: 'C', text: '意见不统一，听谁的都一样' },
      { optionId: 'D', text: '各记一条，下次都验证' },
    ],
  },

  // ── PROBABILITY ──
  {
    questionId: 'SC_PROB_01',
    prompt: "一个朋友创业成功了，劝你也做。你更可能先想？",
    options: [
      { optionId: 'A', text: '像他这样成功的人里，失败的有多少' },
      { optionId: 'B', text: '他挺靠谱，值得信' },
      { optionId: 'C', text: '别人能成我也能' },
      { optionId: 'D', text: '没想过概率这回事' },
    ],
  },
  {
    questionId: 'SC_PROB_02',
    prompt: "你说一件事'八成把握'，如果有人能给你一条可能推翻或增强它的信息，但要花点时间。你更可能？",
    options: [
      { optionId: 'A', text: '值得看，我的八成可能会变' },
      { optionId: 'B', text: '都八成了，不用再看' },
      { optionId: 'C', text: "我一般不说'几成'，凭感觉" },
    ],
  },

  // ── RISK ──
  {
    questionId: 'SC_RISK_01',
    prompt: "一个机会，最坏亏 1000（你能承受），最好赚 1 万。你更可能？",
    options: [
      { optionId: 'A', text: '看赔率和最坏情况再定' },
      { optionId: 'B', text: "只看到'会亏'，不想碰" },
      { optionId: 'C', text: "只看到'能赚'，就上了" },
      { optionId: 'D', text: '没想过最坏和最好' },
    ],
  },
  {
    questionId: 'SC_RISK_02',
    prompt: "一个失败后可退回的决定。'可退回'这一点会不会影响你的选择？",
    options: [
      { optionId: 'A', text: '会，可逆就敢试' },
      { optionId: 'B', text: '不会，失败就是失败' },
      { optionId: 'C', text: '从没区分过可逆不可逆' },
    ],
  },

  // ── LEVERAGE ──
  {
    questionId: 'SC_LEV_01',
    prompt: "你要花一周解决一个会反复出现的问题。你更倾向？",
    options: [
      { optionId: 'A', text: '直接解决这一次' },
      { optionId: 'B', text: '先做个以后能反复用的方法/工具，哪怕这次慢' },
      { optionId: 'C', text: '拉几个人分工一起弄' },
      { optionId: 'D', text: '没想过这区别' },
    ],
  },
  {
    questionId: 'SC_LEV_02',
    prompt: "你的产出，通常更接近？",
    options: [
      { optionId: 'A', text: '我停手它就停' },
      { optionId: 'B', text: '一部分能被别人/流程接着用' },
      { optionId: 'C', text: '从没想过放大' },
    ],
  },

  // ── TIME ──
  {
    questionId: 'SC_TIME_01',
    prompt: "今天有件事能立刻出结果，还有件事三个月后才见效但能持续。你的时间更倾向？",
    options: [
      { optionId: 'A', text: '先做立刻见效的' },
      { optionId: 'B', text: '给长期的事留固定时间' },
      { optionId: 'C', text: '忙起来长期的就先搁置' },
    ],
  },
  {
    questionId: 'SC_TIME_02',
    prompt: "过去三个月，你在同一件事上持续投入了吗？",
    options: [
      { optionId: 'A', text: '一直在同一方向' },
      { optionId: 'B', text: '换过一两次' },
      { optionId: 'C', text: '换来换去' },
    ],
  },

  // ── IDENTITY ──
  {
    questionId: 'SC_ID_01',
    prompt: "有个机会需要你做一个从没做过、和现在工作无关的事。你第一反应更接近？",
    options: [
      { optionId: 'A', text: '我可以学' },
      { optionId: 'B', text: '这不是我的领域' },
      { optionId: 'C', text: '我可以找会的人一起' },
      { optionId: 'D', text: '我可能做不好' },
    ],
  },
  {
    questionId: 'SC_ID_02',
    prompt: "描述你现在能做什么时，你更常从哪个角度说？",
    options: [
      { optionId: 'A', text: '我的职业/岗位' },
      { optionId: 'B', text: '我具体做过的事' },
      { optionId: 'C', text: '我学起来挺快' },
      { optionId: 'D', text: '看对方是谁' },
    ],
  },

  // ── OPPORTUNITY ──
  {
    questionId: 'SC_OPP_01',
    prompt: "你最近一个新想法，最初是从哪冒出来的？",
    options: [
      { optionId: 'A', text: '接触了不同背景的人/信息' },
      { optionId: 'B', text: '熟悉圈子里' },
      { optionId: 'C', text: '很久没新想法了' },
      { optionId: 'D', text: '主要靠等，碰上了才想' },
    ],
  },
  {
    questionId: 'SC_OPP_02',
    prompt: "你平时接触的人，多大比例和你背景/行业不同？",
    options: [
      { optionId: 'A', text: '不少' },
      { optionId: 'B', text: '有一些' },
      { optionId: 'C', text: '基本同类' },
    ],
  },

  // ── SYSTEMS ──
  {
    questionId: 'SC_SYS_01',
    prompt: "一个团队里老出同样的问题，换了几个人还是老样子。你怎么看？",
    options: [
      { optionId: 'A', text: '问题在流程/环境，换人也一样' },
      { optionId: 'B', text: '是人不行，得找对人' },
      { optionId: 'C', text: '每次原因都不一样' },
      { optionId: 'D', text: '没想过' },
    ],
  },
  {
    questionId: 'SC_SYS_02',
    prompt: "你的方法在一个场合有效，换到另一个场合失效了。你更可能？",
    options: [
      { optionId: 'A', text: '场合变了，条件不同' },
      { optionId: 'B', text: '方法本身有漏洞' },
      { optionId: 'C', text: '运气成分大' },
      { optionId: 'D', text: '继续用，多试几次' },
    ],
  },
]

/**
 * Fisher-Yates 洗牌，返回带 displayPosition 的选项数组。
 * displayPosition = 渲染后的实际 0 基索引（R3C 唯一位置来源），绝不从 optionId 推导。
 * 不修改输入数组；`random` 可注入以便测试确定性。
 *
 * @param {Array<{optionId:string, text:string}>} options
 * @param {() => number} [random]
 * @returns {Array<{optionId:string, text:string, displayPosition:number}>}
 */
function shuffleWithPositions(options, random) {
  const rnd = random || Math.random
  const arr = options.map((o) => ({ optionId: o.optionId, text: o.text }))
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr.map((o, idx) => ({ optionId: o.optionId, text: o.text, displayPosition: idx }))
}

/**
 * 构建一次问卷会话：对每题独立随机选项展示顺序并冻结。
 * 返回全新的深拷贝结构（不修改 V21_QUESTIONS 规范镜像）。
 *
 * @param {() => number} [random]
 * @returns {Array<{questionId:string, prompt:string, options:Array<{optionId:string, text:string, displayPosition:number}>}>}
 */
function buildSessionQuestions(random) {
  return V21_QUESTIONS.map((q) => ({
    questionId: q.questionId,
    prompt: q.prompt,
    options: shuffleWithPositions(q.options, random),
  }))
}

/**
 * 校验提交答案。所有失败均 BLOCK 提交。
 *
 * 规则：
 *   - 恰好 18 条
 *   - 18 个唯一 questionId
 *   - questionId 合法
 *   - optionId 对应该题合法
 *   - displayPosition 为整数
 *   - displayPosition 落在渲染选项范围内
 *   - 该 displayPosition 处渲染选项的 optionId 与提交 optionId 一致
 *
 * @param {Array} questions  buildSessionQuestions() 的结果
 * @param {Array<{questionId:string, optionId:string, displayPosition:number}>} answers
 * @returns {{valid:boolean, errors:string[]}}
 */
function validateAnswers(questions, answers) {
  const errors = []
  if (!Array.isArray(answers)) {
    return { valid: false, errors: ['ANSWERS_NOT_ARRAY'] }
  }
  if (answers.length !== questions.length) {
    return { valid: false, errors: ['ANSWER_COUNT_MISMATCH:' + answers.length + '/' + questions.length] }
  }
  const questionMap = {}
  for (const q of questions) questionMap[q.questionId] = q

  const seen = new Set()
  for (const a of answers) {
    if (!a || typeof a !== 'object') { errors.push('MALFORMED_ENTRY'); continue }
    const questionId = a.questionId
    const optionId = a.optionId
    const displayPosition = a.displayPosition

    const q = questionMap[questionId]
    if (!q) { errors.push('INVALID_QUESTION_ID:' + questionId); continue }
    if (seen.has(questionId)) { errors.push('DUPLICATE_QUESTION_ID:' + questionId); continue }
    seen.add(questionId)

    const opt = q.options.find((o) => o.optionId === optionId)
    if (!opt) { errors.push('INVALID_OPTION_ID:' + questionId + ':' + optionId); continue }

    if (typeof displayPosition !== 'number' || !Number.isInteger(displayPosition)) {
      errors.push('NON_INTEGER_DISPLAY_POSITION:' + questionId); continue
    }
    if (displayPosition < 0 || displayPosition >= q.options.length) {
      errors.push('OUT_OF_RANGE_DISPLAY_POSITION:' + questionId); continue
    }
    const atPos = q.options[displayPosition]
    if (!atPos || atPos.optionId !== optionId) {
      errors.push('POSITION_OPTION_MISMATCH:' + questionId); continue
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * 构造精确云函数请求（不携带 openid / 任何服务端推理字段：命题引用、证据、盲点、构念、财富数据）。
 *
 * @param {Array<{questionId:string, optionId:string, displayPosition:number}>} answers
 * @returns {{name:string, data:object}}
 */
function buildCloudRequest(answers) {
  return {
    name: 'generateAiReport',
    data: {
      type: 'diagnostic',
      diagnosticVersion: 'world_model_v2_1',
      answers,
    },
  }
}

module.exports = {
  QUESTION_COUNT_V21,
  OPTION_COUNT_TOTAL_V21,
  V21_QUESTIONS,
  shuffleWithPositions,
  buildSessionQuestions,
  validateAnswers,
  buildCloudRequest,
}
