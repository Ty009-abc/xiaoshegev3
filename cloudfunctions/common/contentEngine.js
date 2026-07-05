/**
 * contentEngine.js — 内容引擎核心（第六册 Part 2）
 *
 * Content Engine 编排层：
 *   1. 选题生成 → topicGenerator
 *   2. Hook 匹配 → hookGenerator
 *   3. 内容评分 → contentScorer
 *   4. 脚本组装 → script template
 *   5. CTA 注入 → cta engine
 *   6. 矩阵路由 → 4 Matrix dispatch
 *
 * 公式：Hook + Conflict + Insight + CTA
 */

// ═══════════════════════════
// Content Matrix 权重
// ═══════════════════════════

const MATRIX = {
  casino:    { weight: 40, name: '赌场认知',   goal: '爆流量', key: 'casino' },
  cognition: { weight: 30, name: '认知暴击',   goal: '高分享', key: 'cognition' },
  ai:        { weight: 20, name: 'AI认知',     goal: '强转化', key: 'ai' },
  trending:  { weight: 10, name: '热点拆解',   goal: '涨粉',   key: 'trending' },
}

// ═══════════════════════════
// generate — 核心生成入口
// ═══════════════════════════

async function generate(options = {}) {
  const {
    matrix = null,        // 指定 matrix，null=按权重随机
    count = 1,            // 生成数量
    format = 'script',    // script / hook / topic / full
    tone = 'xiaoshige',   // 小事哥语气
    audience = 'free',    // free / vip
    excludeTopics = [],   // 排除已用选题
  } = options

  const results = []
  const matrixList = matrix ? [matrix] : _selectMatricesByWeight(count)

  for (let i = 0; i < count; i++) {
    const mx = matrixList[i % matrixList.length]
    const result = await _generateSingle(mx, { format, tone, audience, excludeTopics })
    results.push(result)
    if (result.topic) excludeTopics.push(result.topic.id)
  }

  return {
    generated: results,
    count: results.length,
    matrices: [...new Set(results.map(r => r.matrix))],
    generatedAt: Date.now(),
  }
}

// ═══════════════════════════
// assembleScript — 完整脚本组装
// ═══════════════════════════

async function assembleScript(options = {}) {
  const { matrix, topic, tone = 'xiaoshige' } = options

  const hook = await _selectHook(matrix, tone)
  const conflict = _buildConflict(topic, matrix, tone)
  const insight = _buildInsight(topic, matrix, tone)
  const cta = _selectCTA(matrix, tone)

  const script = `${hook.text}

${conflict}

${insight}

${cta.text}`

  return {
    hook: { id: hook.id, text: hook.text, category: hook.category },
    conflict,
    insight,
    cta: { id: cta.id, text: cta.text, strength: cta.strength },
    script,
    matrix,
    topic: topic || {},
    format: 'script',
  }
}

// ═══════════════════════════
// getMatrixDistribution — 获取矩阵分布
// ═══════════════════════════

function getMatrixDistribution() {
  const total = Object.values(MATRIX).reduce((s, m) => s + m.weight, 0)
  return Object.entries(MATRIX).map(([key, m]) => ({
    matrix: key,
    label: m.name,
    weight: m.weight,
    share: Math.round((m.weight / total) * 1000) / 10,
    goal: m.goal,
  }))
}

// ═══════════════════════════
// 辅助 — 矩阵随机选择
// ═══════════════════════════

function _selectMatricesByWeight(count) {
  const pool = []
  for (const [key, mx] of Object.entries(MATRIX)) {
    const slots = Math.round(mx.weight / 10) // casino=4, cognition=3, ai=2, trending=1
    for (let i = 0; i < slots; i++) pool.push(key)
  }
  const result = []
  for (let i = 0; i < count; i++) {
    result.push(pool[Math.floor(Math.random() * pool.length)])
  }
  return result
}

// ═══════════════════════════
// 生成单条
// ═══════════════════════════

async function _generateSingle(matrix, { format, tone, audience, excludeTopics }) {
  const mxConfig = MATRIX[matrix]
  if (!mxConfig) throw new Error(`Unknown matrix: ${matrix}`)

  // 加载选题
  let topic = null
  try {
    const { getRandomTopic } = require('./topicGenerator.js')
    topic = await getRandomTopic(matrix, excludeTopics)
  } catch (_) {
    topic = { id: `${matrix}_fallback`, key: 'default', title: mxConfig.name }
  }

  // 加载 hook
  let hook = null
  try {
    const { selectHook } = require('./hookGenerator.js')
    hook = await selectHook(matrix, { count: 3, tone })
  } catch (_) {
    hook = { primary: { id: 'default', text: '你从未从这种角度看世界', category: 'cognition' }, alternatives: [] }
  }

  // 评分
  let score = null
  try {
    const { scoreContent } = require('./contentScorer.js')
    score = await scoreContent({ matrix, topic, hook: hook.primary, format, audience })
  } catch (_) {
    score = { total: 75, breakdown: { ctr: 20, virality: 18, shareability: 18, ctaStrength: 19 }, approved: true }
  }

  return {
    matrix,
    matrixLabel: mxConfig.name,
    topic,
    hook: hook.primary,
    hookAlternatives: hook.alternatives || [],
    score,
    approved: score.approved !== false && score.total >= 75,
    format,
    generatedAt: Date.now(),
  }
}

// ═══════════════════════════
// Hook 选择
// ═══════════════════════════

async function _selectHook(matrix, tone) {
  try {
    const { selectHook } = require('./hookGenerator.js')
    const result = await selectHook(matrix, { count: 1, tone })
    return result.primary || { id: 'default', text: '这个世界运行的底层逻辑，你可能从来没看过', category: 'cognition' }
  } catch (_) {
    return { id: 'default', text: '这个世界运行的底层逻辑，你可能从来没看过', category: 'cognition' }
  }
}

// ═══════════════════════════
// Conflict 构建
// ═══════════════════════════

function _buildConflict(topic, matrix, tone) {
  const patterns = {
    casino: [
      `但你有没有想过——赌场真正的赢家，从来不是坐在牌桌上的那个人。`,
      `表面是你在赌，真相是系统在收割。`,
      `输了你想翻身，赢了你以为自己能战胜概率——这才是最大的陷阱。`,
      `什么是"认知碾压"？就是你用情绪做决定，对方用概率做设计。`,
    ],
    cognition: [
      `99%的人相信的道理，往往是错的。不是因为道理不对，是因为讲道理的人从来没上过牌桌。`,
      `你跟大多数人想的一样，那你只能得到大多数人的结果。`,
      `你以为是能力决定命运？错了，是认知决定你看到什么"选项"。`,
      `穷人不是没机会，是看不出什么是机会。富人不靠单次决策，靠认知系统。`,
    ],
    ai: [
      `你还在用"人"的思维跟"AI"拼？这就像19世纪的马车夫跟火车比耐力。`,
      `AI 淘汰的不是底层，是"不愿意更新自己操作系统"的人。`,
      `下个五年最危险的不是没技术的人，而是认知停留在过去的聪明人。`,
      `AI 时代的核心竞争力不是你懂AI，是你的认知能指挥 AI 做什么。`,
    ],
    trending: [
      `这个社会最大的错觉：以为大家都在同一条赛道上。`,
      `当所有人盯着一个方向焦虑的时候，反方向的认知才是杠杆。`,
      `经济周期吃掉的永远是同一拨人：信息最底层、认知最顶层。`,
    ],
  }
  const options = patterns[matrix] || patterns.cognition
  return options[Math.floor(Math.random() * options.length)]
}

// ═══════════════════════════
// Insight 构建
// ═══════════════════════════

function _buildInsight(topic, matrix, tone) {
  const patterns = {
    casino: [
      `在澳门10年，我总结了三条系统法则：第一，赌场从来不对抗运气，它对抗的是"人性"。第二，所有的"好运局"背后，都藏着一个你还没发现的收割逻辑。第三，真正在赌场赚钱的只有两种人——开赌场的和卖铲子的。`,
      `赌场设计师的学历比你高、算法比你精密、心理学比你透彻。你用自己的工资去挑战别人十年的专业设计，这不叫勇气，这叫认知税。`,
    ],
    cognition: [
      `人和人的差距，本质是"认知操作系统"的版本差异。有人还在用 Windows 95 看世界，有人在刷到信息的第一秒就已经拆解了三个层次：信息->逻辑->动机。你的操作系统，现在什么版本？`,
      `认知升级的残酷在于：升级之前的你，根本不知道自己有多"蠢"。就像坐在井底的青蛙，以为天空就是那个圆洞的大小——除非你爬出来过，否则你一辈子都不知道自己错过了什么。`,
    ],
    ai: [
      `AI 不是敌人，AI 是"认知放大器"。会用AI的人，一个人就是一个团队；不会用的人，一个团队被一个人替代。这不是末日的开始，这是杠杆时代的开幕。`,
      `未来五年真正赚钱的逻辑会完全翻转：不靠信息差——AI 抹平了信息。靠的是"认知差"。同样的数据，你看到的是威胁，他看到的是机会。`,
    ],
    trending: [
      `热点会过去，但人性的漏洞永远在重复。每轮经济周期收割的，都是"好了伤疤忘了疼"的那批人。真正的财富自由，不是赚到多少钱，是你不再被"恐惧"和"贪婪"轮流驾驶。`,
    ],
  }
  const options = patterns[matrix] || patterns.cognition
  return options[Math.floor(Math.random() * options.length)]
}

// ═══════════════════════════
// CTA 选择
// ═══════════════════════════

function _selectCTA(matrix, tone) {
  const CTAS = {
    casino: [
      { id: 'cta_casino_1', text: '我做了一个AI诊断工具，3分钟测出你的"翻身概率"和"认知漏洞"。去小程序搜"珠澳小事哥"。', strength: 9 },
      { id: 'cta_casino_2', text: '想知道你在别人眼里是什么样的决策者吗？我做了个测试，很多人做完沉默了。小程序搜"珠澳小事哥"。', strength: 9 },
      { id: 'cta_casino_3', text: '去测一下你的"认知操作系统"版本号，结果可能会让你不舒服——但这是好事。', strength: 8 },
    ],
    cognition: [
      { id: 'cta_cog_1', text: '你的认知操作系统是什么版本？我做了个AI评估，3分钟出结果。去小程序搜"珠澳小事哥"。', strength: 9 },
      { id: 'cta_cog_2', text: '测一下你的"认知漏洞"——很多人测完第一反应是：原来我一直在这个坑里。', strength: 8 },
      { id: 'cta_cog_3', text: '我在小程序做了个"认知体检"，不看血常规看脑回路。测完你会重新认识自己。', strength: 7 },
    ],
    ai: [
      { id: 'cta_ai_1', text: '想知道AI时代你最大的竞争力是什么？不是技术，是你的认知结构。去小程序测一下。', strength: 8 },
      { id: 'cta_ai_2', text: '我做了个工具，可以看你的"认知操作系统"跟AI配不配。搜"珠澳小事哥"进小程序。', strength: 8 },
      { id: 'cta_ai_3', text: '测一下你在AI时代会不会被淘汰——不是看学历，是看你的认知可塑性。', strength: 9 },
    ],
    trending: [
      { id: 'cta_trend_1', text: '对这个世界感到迷惑？去小程序测一下你的"认知框架"，看看哪些偏见在替你思考。搜"珠澳小事哥"。', strength: 7 },
      { id: 'cta_trend_2', text: '我就做了个测试工具，帮你理清哪些认知在帮你在、哪些在拖你后腿。去测。', strength: 7 },
    ],
  }
  const options = CTAS[matrix] || CTAS.cognition
  return options[Math.floor(Math.random() * options.length)]
}

// ═══════════════════════════
// getFrequencyPlan — 发布频率
// ═══════════════════════════

function getFrequencyPlan() {
  return {
    douyin:    { frequency: '每日 2-3 条', bestTime: '12:00 / 18:00 / 21:00', matrix: ['casino', 'cognition', 'ai'] },
    shipinhao: { frequency: '每日 1-2 条', bestTime: '12:00 / 20:00',           matrix: ['casino', 'cognition'] },
    gongzhonghao: { frequency: '每周 2 篇', bestTime: '周二/周五 20:00',         matrix: ['cognition', 'trending'] },
    renzhiBaoji:  { frequency: '每日 1 条', bestTime: '08:00',                  matrix: ['cognition'] },
  }
}

module.exports = {
  MATRIX,
  generate,
  assembleScript,
  getMatrixDistribution,
  getFrequencyPlan,
}
