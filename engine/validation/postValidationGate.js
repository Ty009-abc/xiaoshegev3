/**
 * RC8.2 Post-Validation Gate
 *
 * Blocks content that violates RC8 trustworthiness constraints.
 * Operates as a strict gate: repair once, then deterministic fallback.
 */

var VIOLATION_TYPES = {
  OVERCLAIMED_USER_PSYCHOLOGY: 'OVERCLAIMED_USER_PSYCHOLOGY',
  OVERCLAIMED_USER_BEHAVIOR: 'OVERCLAIMED_USER_BEHAVIOR',
  OVERCLAIMED_OUTCOME: 'OVERCLAIMED_OUTCOME',
  UNSUPPORTED_PERCENTAGE_CLAIM: 'UNSUPPORTED_PERCENTAGE_CLAIM',
  MULTI_THEME_CONTAMINATION: 'MULTI_THEME_CONTAMINATION',
  UNSAFE_EXTREME_METAPHOR: 'UNSAFE_EXTREME_METAPHOR',
  DUPLICATE_MEANING: 'DUPLICATE_MEANING'
}

// Patterns that indicate the LLM made up facts about the user
var OVERCLAIM_PSYCHOLOGY_PATTERNS = [
  /麻痹自己/,
  /躺平/,
  /不敢想/,
  /害怕成功/,
  /用学习逃避/,
  /假装努力/,
  /自我感动/,
  /回避现实/,
  /逃避现实/,
  /不敢面对/,
  /内心恐惧/,
  /缺乏勇气/,
  /自卑/,
  /不配得/,
  /受害者心态/,
  /抱怨命运/
]

var OVERCLAIM_BEHAVIOR_PATTERNS = [
  /一直刷教程/,
  /把\d+小时都浪费/,
  /没有真正行动/,
  /从未主动销售/,
  /一直拖延/,
  /永远不开始/,
  /不断换方向/,
  /三天打鱼/,
  /收藏从未看/,
  /买了一堆课程/
]

var OVERCLAIM_OUTCOME_PATTERNS = [
  /收入.*归零/,
  /一定.*失业/,
  /必然.*失败/,
  /永远.*月薪/,
  /绝无可能/,
  /注定/,
  /无可避免/,
  /所有.*取决于/,
  /全部.*来自/
]

var UNSAFE_METAPHOR_PATTERNS = [
  /残废/, /死亡/, /窒息/, /流血/, /断裂/, /崩溃/, /毁灭/, /崩塌/,
  /绝路/, /末日/, /深渊/, /地狱/, /自杀/, /谋杀/, /慢性自杀/
]

var PERCENTAGE_CLAIM_PATTERNS = [
  /比\d+%的人/,
  /超过了?\d+%/,
  /\%的人/,
  /\d+%都不具备/,
  /超过绝大多数/,
  /比99%/,
  /不到\d+%的人/,
  /只有\d+%/
]

var FORBIDDEN_MULTI_THEMES = [
  'AI副业', '泛自由职业', '多个方向', '多种渠道', '多个项目',
  '多方向并进', '投资', '同时开发多个产品', '多种收入来源',
  '多产品同时', '多个品牌方向'
]

var ALLOWED_IP_THEMES = [
  '定位', '内容输出', '获客', '产品化', '成交验证',
  '信任积累', '个人IP', '标准化', '服务化'
]

/**
 * Validate a single text block against all violation categories.
 *
 * @param {string} text
 * @param {Object} context — { strategyId, primaryArchetype, tagIds }
 * @returns {Object} { passed, violations: [{ type, category, match, suggestion }] }
 */
function validateText(text, context) {
  context = context || {}
  var violations = []

  if (!text || typeof text !== 'string') {
    return { passed: true, violations: [] }
  }

  // 1. Overclaimed psychology
  OVERCLAIM_PSYCHOLOGY_PATTERNS.forEach(function(pattern) {
    var m = text.match(pattern)
    if (m) {
      violations.push({
        type: VIOLATION_TYPES.OVERCLAIMED_USER_PSYCHOLOGY,
        pattern: String(pattern),
        match: m[0],
        suggestion: 'Replace with evidence-based statement. Only assert what the user explicitly shared.'
      })
    }
  })

  // 2. Overclaimed behavior
  OVERCLAIM_BEHAVIOR_PATTERNS.forEach(function(pattern) {
    var m = text.match(pattern)
    if (m) {
      violations.push({
        type: VIOLATION_TYPES.OVERCLAIMED_USER_BEHAVIOR,
        pattern: String(pattern),
        match: m[0],
        suggestion: 'Replace with structure-observation. Do not invent user behaviors.'
      })
    }
  })

  // 3. Overclaimed outcomes (catastrophizing)
  OVERCLAIM_OUTCOME_PATTERNS.forEach(function(pattern) {
    var m = text.match(pattern)
    if (m) {
      violations.push({
        type: VIOLATION_TYPES.OVERCLAIMED_OUTCOME,
        pattern: String(pattern),
        match: m[0],
        suggestion: 'Describe structural risk, not deterministic catastrophe. Use: "职业中断风险", "缺少第二支撑".'
      })
    }
  })

  // 4. Unsafe extreme metaphors
  UNSAFE_METAPHOR_PATTERNS.forEach(function(pattern) {
    var m = text.match(pattern)
    if (m) {
      violations.push({
        type: VIOLATION_TYPES.UNSAFE_EXTREME_METAPHOR,
        pattern: String(pattern),
        match: m[0],
        suggestion: 'Use neutral structural description. Avoid violence/death metaphors for financial topics.'
      })
    }
  })

  // 5. Unsupported percentage claims
  PERCENTAGE_CLAIM_PATTERNS.forEach(function(pattern) {
    var m = text.match(pattern)
    if (m) {
      violations.push({
        type: VIOLATION_TYPES.UNSUPPORTED_PERCENTAGE_CLAIM,
        pattern: String(pattern),
        match: m[0],
        suggestion: 'Remove unsupported statistic. Only cite actual data sources.'
      })
    }
  })

  // 6. Multi-theme contamination for BUILD_IP strategy
  if (context.strategyId === 'BUILD_IP') {
    FORBIDDEN_MULTI_THEMES.forEach(function(theme) {
      if (text.indexOf(theme) >= 0) {
        violations.push({
          type: VIOLATION_TYPES.MULTI_THEME_CONTAMINATION,
          pattern: theme,
          match: theme,
          suggestion: 'BUILD_IP strategy only allows: ' + ALLOWED_IP_THEMES.join(', ') + '. Remove: ' + theme + '.'
        })
      }
    })
  }

  return {
    passed: violations.length === 0,
    violations: violations
  }
}

/**
 * Gate multiple text blocks. Returns first-failure (fail-fast).
 *
 * @param {string[]} texts — array of text blocks to validate
 * @param {Object} context
 * @returns {Object} { passed, violations, blockedText, blockedIndex }
 */
function gateTexts(texts, context) {
  for (var i = 0; i < texts.length; i++) {
    var result = validateText(texts[i], context)
    if (!result.passed) {
      return {
        passed: false,
        violations: result.violations,
        blockedText: texts[i],
        blockedIndex: i
      }
    }
  }
  return { passed: true, violations: [], blockedText: '', blockedIndex: -1 }
}

/**
 * Validate the complete card set for BUILD_IP single-theme enforcement.
 *
 * @param {string[]} cardTexts — [card01, card02, card03, card04, card05, card06]
 * @param {Object} context
 * @returns {Object} { passed, cardViolations: [{ cardIndex, violations }] }
 */
function validateCards(cardTexts, context) {
  var cardViolations = []
  for (var i = 0; i < cardTexts.length; i++) {
    var result = validateText(cardTexts[i], context)
    if (!result.passed) {
      cardViolations.push({
        cardIndex: i + 1,
        violations: result.violations
      })
    }
  }
  return {
    passed: cardViolations.length === 0,
    cardViolations: cardViolations
  }
}

/**
 * Generate a deterministic fallback card text for the given strategy.
 */
function generateFallbackCard(strategyId, cardIndex) {
  var fallbacks = {
    BUILD_IP: [
      '你的突破需要系统化获客能力。',
      '当前核心矛盾：有技能但缺乏可重复的流量入口。',
      '唯一决策：建立个人品牌 → 内容输出 → 获客验证。',
      '第一步行动：今天发布一篇专业内容到公开平台。',
      '你的技能是可商品化的，但需要先解决谁为你付费的问题。',
      '定位 — 内容输出 — 获客入口 — 标准化产品 — 成交验证。'
    ],
    BUILD_CASHFLOW: [
      '你的现金流需要第二个稳定来源。',
      '单一收入来源在职业波动时缺少缓冲。',
      '建立一个不依赖时间的现金流管道。',
      '第一步：识别一个可以收费的技能或知识。',
      '现金流策略的核心是收入多样性而非收入最大化。',
      '第二收入来源 — 稳定现金流 — 解放时间 — 规模化。'
    ],
    SELL_FIRST: [
      '你的商业闭环缺少成交这个环节。',
      '有能力的代价是还没学会把能力放进市场定价。',
      '在打磨产品前，先验证有人愿意付费。',
      '第一步：向3个人提出你的服务报价。',
      '销售不是说服，是匹配需求。先小步验证再优化。',
      '报价 — 成交 — 记录 — 涨价 — 系统化。'
    ],
    BUILD_SYSTEM: [
      '你的增长瓶颈是手工操作无法规模化。',
      '你已经验证了能力，但系统的缺口在放大的过程中会被挤压。',
      '建立可复制的系统而非依赖个人的产出。',
      '第一步：写下你现在花时间最多的3个操作，设计自动化方案。',
      '系统建设的每一步都必须有文档和可追溯的流程。',
      '流程文档化 — 工具化 — 半自动化 — 全自动化。'
    ],
    BUILD_ACQUISITION_SYSTEM: [
      '你的获客体系还未形成可重复的闭环。',
      '当前增长受限于随机的、无法预测的流量来源。',
      '建立一条不依赖运气的获客管道。',
      '第一步：创建你的第一个免费获客内容并发布。',
      '获客不是流量数量的问题，是精准匹配和可重复流程的问题。',
      '免费钩子 — 内容获客 — 私域沉淀 — 裂变放大。'
    ],
    DISCIPLINE_FIRST: [
      '执行缺口会抵消你的其他所有优势。',
      '你的知识和意图远超你的行动产出。',
      '缩小知行差距，建立最小行动闭环。',
      '第一步：完成一个可验证的输出物并公开承诺。',
      '执行力不是天赋，是设计——创造外部问责和反馈循环。',
      '最小行动单元 — 每日输出 — 外部问责 — 反馈闭环。'
    ],
    BUILD_PRODUCT: [
      '你的知识需要被封装为一个可交易的产品。',
      '能力和产品之间有巨大的转化差距。',
      '把你的知识变成一个可重复销售的产品包。',
      '第一步：描述你的第一个付费产品的MVP版本。',
      '产品化就是把服务能力从时间工资里解放出来的第一步。',
      '知识产品化 — MVP验证 — 迭代 — 标准化。'
    ]
  }

  var cards = fallbacks[strategyId]
  if (!cards) {
    cards = fallbacks.BUILD_CASHFLOW // safe default
  }
  return cards[cardIndex % cards.length] || cards[0]
}

module.exports = {
  VIOLATION_TYPES: VIOLATION_TYPES,
  validateText: validateText,
  gateTexts: gateTexts,
  validateCards: validateCards,
  generateFallbackCard: generateFallbackCard,
  ALLOWED_IP_THEMES: ALLOWED_IP_THEMES,
  FORBIDDEN_MULTI_THEMES: FORBIDDEN_MULTI_THEMES
}
