/**
 * cloudfunctions/common/responseStrategy.js — 回答策略引擎
 *
 * 四册 Part 5：Response Strategy
 *
 * 职责：
 *   1. Intent 分类（6 种 intent）
 *   2. Complexity 评分（1-10）
 *   3. Strategy 选择（intent + complexity + membership）
 *   4. Length 控制（free=medium, VIP=deep）
 */

// ═══════════════════════════
// 1. INTENT 定义
// ═══════════════════════════
const INTENTS = {
  FACT: 'fact',           // 事实问题：澳门赌场为什么赚钱
  ADVICE: 'advice',       // 寻求建议：我该不该辞职
  ANALYSIS: 'analysis',   // 深度分析：为什么普通人难翻身
  COACHING: 'coaching',   // 教练模式：我想改变但不知道怎么开始
  EMOTIONAL: 'emotional', // 情绪倾诉：我最近很焦虑
  STRATEGIC: 'strategic', // 战略规划：我的未来方向
}

/**
 * analyzeIntent(text, context)
 * 基于关键词 + 模式匹配快速分类
 *
 * @param {string} text     - 用户输入
 * @param {object} context  - 对话上下文 { recentMessages?, cognitionProfile? }
 * @returns {{ intent, confidence }}
 */
function analyzeIntent(text, context = {}) {
  if (!text || typeof text !== 'string') return { intent: 'analysis', confidence: 0.3 }

  const t = text.trim()
  let scores = { fact: 0, advice: 0, analysis: 0, coaching: 0, emotional: 0, strategic: 0 }

  // ── fact 事实类 ──
  if (/^(什么是|什么是|定义|解释|介绍|概念|公式|原理|规则|为什么.*赚钱|为什么.*存在)/.test(t)) scores.fact += 3
  if (/^[你知道]*(凯利|赔率|胜率|期望值|负期望|大数|贝叶斯|赌场|百家乐|轮盘|老虎机|21点)/.test(t)) scores.fact += 2
  if (t.length < 30 && !/[?？吗呢]/.test(t) && /^[^我你]+$/.test(t)) scores.fact += 1

  // ── advice 建议类 ──
  if (/(该不该|要不要|应不应该|好不好|合适不|怎么办|怎么做|如何|怎么选|选哪个|推荐|建议|你觉得)/.test(t)) scores.advice += 3
  if (/(辞职|创业|投资|买房|换工作|转型|副业|搞钱)/.test(t)) scores.advice += 2

  // ── analysis 分析类 ──
  if (/(为什么|原因|根源|本质|底层|逻辑|怎么回事|机制|结构|系统)/.test(t)) scores.analysis += 3
  if (/(阶层|财富|收入|穷人|富人|翻身|跨越|上升|衰退|趋势|变化|时代)/.test(t)) scores.analysis += 2
  if (t.length > 40 && /为什么/.test(t)) scores.analysis += 1

  // ── coaching 教练类 ──
  if (/(不知道.*(开始|做|选|方向|目标|路|方法|出路|前途)|迷茫|困惑|瓶颈|走不出来|卡住|停滞)/.test(t)) scores.coaching += 3
  if (/(改变|突破|成长|升级|蜕变|进化|突破|成长)/.test(t) && /(但|可是|然而|不过)/.test(t)) scores.coaching += 2
  if (/(我想|我要|我打算).*[但可].*(不知道|不确定|迷茫|犹豫)/.test(t)) scores.coaching += 2

  // ── emotional 情绪类 ──
  if (/(焦虑|害怕|担心|恐慌|绝望|崩溃|失眠|抑郁|压力|撑不住|受不了|难受|痛苦)/.test(t)) scores.emotional += 4
  if (/(越来越|最近|总是|一直|老是).*(焦虑|睡不着|心烦|累|辛苦|疲惫|茫然)/.test(t)) scores.emotional += 2
  if (/^.{1,15}[了]$/.test(t) && /(累|烦|困|慌|怕)/.test(t)) scores.emotional += 1

  // ── strategic 战略类 ──
  if (/(未来|规划|方向|目标|愿景|长期|策略|布局|下一步|五年|十年|生涯|人生|职业|事业)/.test(t)) scores.strategic += 3
  if (t.length > 60 && /(我想|我打算|我准备|我的目标是).*(未来|长期|以后)/.test(t)) scores.strategic += 2

  // ── 上下文增强 ──
  if (context.recentMessages) {
    const recent = context.recentMessages.slice(-3).map(m => m.content || '').join(' ')
    if (recent.includes('焦虑') && scores.emotional < 3) scores.emotional += 1
    if (/分析|拆解|底层/.test(recent) && scores.analysis < 3) scores.analysis += 1
  }

  // ── 取最高分 intent ──
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const [intent, score] = entries[0]

  // 置信度：最高分 / 总分
  const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1
  const confidence = score / total

  // 低分兜底
  if (score < 2) return { intent: 'analysis', confidence: 0.4 }

  return { intent, confidence: Math.min(confidence, 1) }
}

// ═══════════════════════════
// 2. COMPLEXITY SCORING
// ═══════════════════════════

/**
 * scoreComplexity(text, intent, context)
 * 问题复杂度 1-10
 */
function scoreComplexity(text, intent, context = {}) {
  if (!text) return 3

  let score = 0

  // 长度因子
  if (text.length < 10) score += 1
  else if (text.length < 30) score += 2
  else if (text.length < 80) score += 3
  else score += 4

  // 深层关键词（权重高）
  const deepKeywords = [
    '为什么', '本质', '根源', '底层逻辑', '系统',
    '阶层', '结构', '体制', '规则', '权力',
    '博弈', '策略', '长期', '基因', '惯性'
  ]
  for (const kw of deepKeywords) {
    if (text.includes(kw)) score += 1
  }

  // 多层问题检测（多个 ? 或 多个主题）
  const questions = (text.match(/[?？]/g) || []).length
  if (questions >= 3) score += 2
  else if (questions >= 1) score += 1

  // 多主题检测
  const topicMarkers = ['还', '同时', '另外', '以及', '而且', '再加上']
  for (const mk of topicMarkers) {
    if (text.includes(mk)) score += 0.5
  }

  // intent 因子
  const intentComplexity = {
    fact: -1, advice: 0, analysis: 2, coaching: 1, emotional: -1, strategic: 3,
  }
  score += intentComplexity[intent] || 0

  // 上下文因子
  if (context.deepDiscussion) score += 2
  if (context.followUpCount > 3) score += 1

  // 钳位 1-10
  return Math.max(1, Math.min(10, Math.round(score)))
}

// ═══════════════════════════
// 3. RESPONSE STRATEGIES
// ═══════════════════════════

const STRATEGIES = {
  DIRECT: 'direct',               // 事实直接答
  LAYERED: 'layered',             // 五层拆解（默认）
  COGNITIVE_SHOCK: 'cognitive_shock', // 认知暴击
  COACHING: 'coaching',           // 反问引导
  STRATEGIC_PLANNING: 'strategic_planning', // 战略规划
  HARD_TRUTH: 'hard_truth',       // 真相暴击（VIP）
}

/**
 * selectStrategy(intent, complexity, membership)
 *
 * 策略路由表：
 */
function selectStrategy(intent, complexity, membership = 'free') {
  const isVip = membership !== 'free'

  // fact → direct
  if (intent === 'fact') {
    if (complexity >= 7) return STRATEGIES.LAYERED // 复杂事实也用分层
    return STRATEGIES.DIRECT
  }

  // emotional → cognitive_shock
  if (intent === 'emotional') {
    return STRATEGIES.COGNITIVE_SHOCK
  }

  // coaching → coaching（反问模式）
  if (intent === 'coaching') {
    if (complexity >= 8 && isVip) return STRATEGIES.HARD_TRUTH
    return STRATEGIES.COACHING
  }

  // strategic → strategic_planning
  if (intent === 'strategic') {
    if (complexity >= 8 && isVip) return STRATEGIES.HARD_TRUTH
    return STRATEGIES.STRATEGIC_PLANNING
  }

  // analysis / advice → layered（默认策略）
  if (complexity >= 8 && isVip) return STRATEGIES.HARD_TRUTH
  if (complexity <= 2) return STRATEGIES.DIRECT
  return STRATEGIES.LAYERED
}

// ═══════════════════════════
// 4. LENGTH CONTROL
// ═══════════════════════════

const LENGTHS = {
  SHORT: 'short',     // ~100字
  MEDIUM: 'medium',   // ~300字
  DEEP: 'deep',       // ~600字
}

/**
 * selectLength(complexity, membership, preference)
 */
function selectLength(complexity, membership = 'free', preference = null) {
  const isVip = membership !== 'free'

  // 用户指定长度（VIP 可指定 deep）
  if (preference === 'deep' && isVip) return LENGTHS.DEEP
  if (preference === 'short') return LENGTHS.SHORT
  if (preference === 'medium' && isVip) return LENGTHS.MEDIUM

  // 自动根据复杂度决定
  if (complexity <= 2) return LENGTHS.SHORT
  if (complexity <= 6) return LENGTHS.MEDIUM
  if (isVip) return LENGTHS.DEEP
  return LENGTHS.MEDIUM // 免费用户最多 medium
}

// ═══════════════════════════
// 5. 策略结构定义
// ═══════════════════════════

/**
 * 每种策略的输出结构模板
 */
const STRATEGY_STRUCTURE = {
  direct: {
    sections: ['answer', 'supplement'],
    hasHook: false,
    hasShockEnding: false,
    defaultLength: 'short',
  },
  layered: {
    sections: ['hook', 'phenomenon', 'surface_cause', 'interests', 'system_structure', 'root_logic'],
    hasHook: true,
    hasShockEnding: true,
    defaultLength: 'medium',
  },
  cognitive_shock: {
    sections: ['counter_hook', 'core_logic', 'conclusion'],
    hasHook: true,
    hasShockEnding: true,
    defaultLength: 'medium',
  },
  coaching: {
    sections: ['reframe', 'questions', 'insight'],
    hasHook: false,
    hasShockEnding: false,
    defaultLength: 'medium',
  },
  strategic_planning: {
    sections: ['goal_clarify', 'risk_map', 'resources', 'path', 'recommendation'],
    hasHook: false,
    hasShockEnding: true,
    defaultLength: 'deep',
  },
  hard_truth: {
    sections: ['brutal_hook', 'uncomfortable_truth', 'system_reveal', 'final_impact'],
    hasHook: true,
    hasShockEnding: true,
    defaultLength: 'deep',
  },
}

// ═══════════════════════════
// 导出
// ═══════════════════════════

module.exports = {
  INTENTS,
  STRATEGIES,
  LENGTHS,
  STRATEGY_STRUCTURE,
  analyzeIntent,
  scoreComplexity,
  selectStrategy,
  selectLength,
}
