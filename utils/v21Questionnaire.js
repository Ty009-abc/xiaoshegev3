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
    prompt: "有个机会你琢磨挺久了，大概七成把握。你会怎么做？",
    options: [
      { optionId: 'A', text: '先小做一点，边做边看' },
      { optionId: 'B', text: '再等等，稳一点再上' },
      { optionId: 'C', text: '问问做过的人，有底了再动' },
      { optionId: 'D', text: '先把问题都想全，再拍板' },
    ],
  },
  {
    questionId: 'SC_DEC_02',
    prompt: "一条新消息可能让你改主意，但要多等一天才拿到。你会怎么做？",
    options: [
      { optionId: 'A', text: '等等看，这消息可能有用' },
      { optionId: 'B', text: '不等，先干起来再说' },
      { optionId: 'C', text: '定了就不太回头，消息再说' },
    ],
  },

  // ── FEEDBACK ──
  {
    questionId: 'SC_FB_01',
    prompt: "你敬重的人否定了你做的东西，但他给的理由你不太认同。你会怎么做？",
    options: [
      { optionId: 'A', text: '当面问他，分歧到底在哪' },
      { optionId: 'B', text: '先放放，按自己的想法来' },
      { optionId: 'C', text: '再找个信得过的人问问' },
      { optionId: 'D', text: '记下来，但先照原计划来' },
    ],
  },
  {
    questionId: 'SC_FB_02',
    prompt: "你的方案连着被否了两次，两次说的原因还不一样。你怎么想？",
    options: [
      { optionId: 'A', text: '可能真有问题，改改看' },
      { optionId: 'B', text: '他们没看明白，我再说一遍' },
      { optionId: 'C', text: '说法对不上，先放一放' },
      { optionId: 'D', text: '先都记下，回头一条条试' },
    ],
  },

  // ── PROBABILITY ──
  {
    questionId: 'SC_PROB_01',
    prompt: "一个朋友创业成了，劝你也一起干。你脑子里先冒出来的是什么？",
    options: [
      { optionId: 'A', text: '干这行的，成的到底有多少' },
      { optionId: 'B', text: '他趟过路了，跟着干心里有底' },
      { optionId: 'C', text: '他都能成，我试一把也行' },
      { optionId: 'D', text: '先不想这些，机会来了先上' },
    ],
  },
  {
    questionId: 'SC_PROB_02',
    prompt: "你觉得一件事八成能成。再花点时间，可能查到一条推翻它的消息。你会？",
    options: [
      { optionId: 'A', text: '查查，说不定我得改主意' },
      { optionId: 'B', text: '都八成了，不用再折腾' },
      { optionId: 'C', text: '我不太估几成，差不多就做' },
    ],
  },

  // ── RISK ──
  {
    questionId: 'SC_RISK_01',
    prompt: "眼下有个事，最多亏一千（你亏得起），成了能赚一万。你会怎么做？",
    options: [
      { optionId: 'A', text: '先看看最坏能亏多少，再定' },
      { optionId: 'B', text: '想想那一千块，有点不想动' },
      { optionId: 'C', text: '能赚一万，值得搏一把' },
      { optionId: 'D', text: '没细看，感觉靠谱就上' },
    ],
  },
  {
    questionId: 'SC_RISK_02',
    prompt: "有件事，就算做砸了也能收回来。你会怎么决定？",
    options: [
      { optionId: 'A', text: '能收回来，那就先试试' },
      { optionId: 'B', text: '做砸了就是砸了，得慎重' },
      { optionId: 'C', text: '能不能收回，平时没太留意' },
    ],
  },

  // ── LEVERAGE ──
  {
    questionId: 'SC_LEV_01',
    prompt: "有个问题老反复出现，你得花一周处理。你会怎么弄？",
    options: [
      { optionId: 'A', text: '先把这次弄利索' },
      { optionId: 'B', text: '顺手做个以后能用的' },
      { optionId: 'C', text: '喊人搭把手一起弄' },
      { optionId: 'D', text: '还是照老办法来' },
    ],
  },
  {
    questionId: 'SC_LEV_02',
    prompt: "你不盯着的时候，你做的那些事还会往前走吗？",
    options: [
      { optionId: 'A', text: '我一停手，它就停了' },
      { optionId: 'B', text: '有的做完，别人接着还能用' },
      { optionId: 'C', text: '做完就交差，没再往下接' },
    ],
  },

  // ── TIME ──
  {
    questionId: 'SC_TIME_01',
    prompt: "有件事很快出结果；另一件得三个月才见效、好处能一直攒着。你先顾哪件？",
    options: [
      { optionId: 'A', text: '先顾马上能出结果的那件' },
      { optionId: 'B', text: '宁可慢点，也给慢的那件留出时间' },
      { optionId: 'C', text: '平时一忙，慢的那件就排后面了' },
    ],
  },
  {
    questionId: 'SC_TIME_02',
    prompt: "过去三个月，你有没有一直往同一件事上使劲？",
    options: [
      { optionId: 'A', text: '就那一件，一直在弄' },
      { optionId: 'B', text: '中间换过一两回' },
      { optionId: 'C', text: '来来回回换了好几次' },
    ],
  },

  // ── IDENTITY ──
  {
    questionId: 'SC_ID_01',
    prompt: "一个机会，要你做件从没干过、跟现在工作也不沾边的事。你第一反应？",
    options: [
      { optionId: 'A', text: '没干过，但可以学' },
      { optionId: 'B', text: '这活不是我这块的' },
      { optionId: 'C', text: '找懂行的人一起弄' },
      { optionId: 'D', text: '心里没底，怕做不好' },
    ],
  },
  {
    questionId: 'SC_ID_02',
    prompt: "刚认识的人问你「你擅长什么」，你一般先怎么答？",
    options: [
      { optionId: 'A', text: '先报一下自己做什么的' },
      { optionId: 'B', text: '讲一件自己做出过的事' },
      { optionId: 'C', text: '说自己上手快、能学' },
      { optionId: 'D', text: '看对面是谁，挑着说' },
    ],
  },

  // ── OPPORTUNITY ──
  {
    questionId: 'SC_OPP_01',
    prompt: "你最近冒出的一个新想法，最早是怎么来的？",
    options: [
      { optionId: 'A', text: '跟圈外的人聊着聊出来的' },
      { optionId: 'B', text: '熟人圈子里聊出来的' },
      { optionId: 'C', text: '想不起来最近有啥新想法' },
      { optionId: 'D', text: '没特意想，碰上了才有' },
    ],
  },
  {
    questionId: 'SC_OPP_02',
    prompt: "你平时来往的人里，跟你背景、行业不一样的，多吗？",
    options: [
      { optionId: 'A', text: '挺多的' },
      { optionId: 'B', text: '有几个' },
      { optionId: 'C', text: '基本一个圈子' },
    ],
  },

  // ── SYSTEMS ──
  {
    questionId: 'SC_SYS_01',
    prompt: "团队里总出同样的岔子，人换了好几拨还是老样子。你觉得是咋回事？",
    options: [
      { optionId: 'A', text: '可能是安排的问题，换谁都差不多' },
      { optionId: 'B', text: '可能是人不行，换个人看看' },
      { optionId: 'C', text: '每次情况都不太一样，说不好' },
      { optionId: 'D', text: '没怎么细想，出了先处理' },
    ],
  },
  {
    questionId: 'SC_SYS_02',
    prompt: "你有个方法，在这儿好使，换个地方就不灵了。你会怎么想？",
    options: [
      { optionId: 'A', text: '水土不服，也正常' },
      { optionId: 'B', text: '这方法本身有短板' },
      { optionId: 'C', text: '这次运气差了点' },
      { optionId: 'D', text: '再多试几次看看' },
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
