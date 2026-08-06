/**
 * RC8.1 Core Bottleneck Engine
 *
 * Identifies the ONE critical bottleneck from behavior tags + archetype.
 * Entire report revolves around this single bottleneck.
 * Only ONE bottleneck allowed.
 */

// ──────────────────────────────────────────────
// Bottleneck Definitions
// ──────────────────────────────────────────────

var BOTTLENECKS = {
  TRAFFIC: {
    id: 'TRAFFIC',
    label: '获客',
    description: '流量不足，无法触达目标用户',
    indicatorTags: ['NO_AUDIENCE','NO_DIRECTION','SCATTERED','WAITING','NO_VERIFICATION'],
    archetypeBias: { EMPLOYEE: 0.3, COLLECTOR: 0.25, CREATOR: 0.25, OPERATOR: 0.2 },
    solutionDirection: '建立稳定的获客渠道：内容获客 > 付费投放 > 私域转化'
  },
  SELLING: {
    id: 'SELLING',
    label: '销售成交',
    description: '有流量/有产品但不会成交变现',
    indicatorTags: ['NO_SELLING','HESITANT_PRICING','LOW_SELF_VALUE','NO_VERIFICATION','PROCRASTINATION'],
    archetypeBias: { COLLECTOR: 0.6, CREATOR: 0.45, EMPLOYEE: 0.3, OPERATOR: 0.2 },
    solutionDirection: '建立标准销售流程：报价 → 异议处理 → 成交 → 追销'
  },
  PRODUCT: {
    id: 'PRODUCT',
    label: '产品',
    description: '缺少可销售的产品或服务',
    indicatorTags: ['NO_PRODUCT','TIME_FOR_MONEY','SINGLE_INCOME','NO_SYSTEM'],
    archetypeBias: { COLLECTOR: 0.35, EMPLOYEE: 0.4, OPERATOR: 0.3 },
    solutionDirection: '将知识/经验产品化：课程化 > 服务化 > 标准化 > 可复制'
  },
  SYSTEM: {
    id: 'SYSTEM',
    label: '系统',
    description: '没有可复制、可规模化的运营系统',
    indicatorTags: ['NO_SYSTEM','LONELY_WOLF','SCATTERED','NO_PLAN','LOW_EXECUTION'],
    archetypeBias: { OPERATOR: 0.5, GAMBLER: 0.4, BUILDER: 0.15, SELLER: 0.3 },
    solutionDirection: '建立可复制系统：流程标准化 → 关键节点自动化 → 团队化'
  },
  DISCIPLINE: {
    id: 'DISCIPLINE',
    label: '纪律',
    description: '执行力不足，无法持续稳定推进',
    indicatorTags: ['PROCRASTINATION','LOW_EXECUTION','WAITING','SHORT_TERM_THINKING','OVER_THINKING'],
    archetypeBias: { COLLECTOR: 0.45, GAMBLER: 0.3, CREATOR: 0.2 },
    solutionDirection: '建立每日强制执行机制：最小行动单元 → 公开承诺 → 反馈闭环'
  },
  EXECUTION: {
    id: 'EXECUTION',
    label: '执行力',
    description: '有方向有资源但行动拖沓',
    indicatorTags: ['PROCRASTINATION','PERFECTIONISM','OVER_THINKING','WAITING','LEARNING_ADDICT'],
    archetypeBias: { COLLECTOR: 0.55, CREATOR: 0.4, EMPLOYEE: 0.2 },
    solutionDirection: '从最小行动开始：砍掉所有学习 → 只做一件事 → 每天输出'
  },
  LEVERAGE: {
    id: 'LEVERAGE',
    label: '杠杆',
    description: '纯靠时间换钱，没有利用任何杠杆',
    indicatorTags: ['TIME_FOR_MONEY','SINGLE_INCOME','NO_SYSTEM','NO_PRODUCT','LOW_INCOME'],
    archetypeBias: { EMPLOYEE: 0.5, OPERATOR: 0.35, COLLECTOR: 0.25 },
    solutionDirection: '建立杠杆：内容杠杆 → 代码杠杆 → 团队杠杆 → 资本杠杆'
  },
  POSITIONING: {
    id: 'POSITIONING',
    label: '定位',
    description: '方向不清晰，什么都想做',
    indicatorTags: ['NO_DIRECTION','SCATTERED','FOLLOW_CROWD','COPY_PASTE','NO_PLAN'],
    archetypeBias: { GAMBLER: 0.5, COLLECTOR: 0.3, OPERATOR: 0.25 },
    solutionDirection: '做减法：选择一个垂直领域深耕 → 建立差异化 → 成为唯一选择'
  },
  CONFIDENCE: {
    id: 'CONFIDENCE',
    label: '信心',
    description: '有能力但不敢行动，自我设限',
    indicatorTags: ['LOW_SELF_VALUE','HESITANT_PRICING','NO_SELLING','WAITING','PERFECTIONISM'],
    archetypeBias: { COLLECTOR: 0.4, CREATOR: 0.35, EMPLOYEE: 0.3 },
    solutionDirection: '建立信心证据链：最小成功 → 记录 → 阶梯式挑战 → 外部反馈'
  },
  PRICING: {
    id: 'PRICING',
    label: '定价',
    description: '不敢要价或定价不合理',
    indicatorTags: ['HESITANT_PRICING','LOW_SELF_VALUE','NO_SELLING','LOW_INCOME','TIME_FOR_MONEY'],
    archetypeBias: { EMPLOYEE: 0.35, CREATOR: 0.3, COLLECTOR: 0.3 },
    solutionDirection: '价值定价：成本法→竞品法→价值法 → 测试提价 → 心理定价'
  }
}

// ──────────────────────────────────────────────
// Core Engine
// ──────────────────────────────────────────────

/**
 * Identify the ONE core bottleneck.
 *
 * @param {Array} tags - behavior tags [{ id, weight, confidence, category }]
 * @param {Object} archetype - wealth archetype result { primary, secondary, ... }
 * @returns {Object} { bottleneck, reason, confidence, solution, candidates }
 */
function identifyBottleneck(tags, archetype) {
  if (!tags || tags.length === 0) {
    return {
      bottleneck: 'UNKNOWN',
      label: '未确定',
      reason: ['INSUFFICIENT_DATA'],
      confidence: 0,
      solution: '需要更多数据来定位核心瓶颈',
      candidates: []
    }
  }

  var tagWeightMap = {}
  tags.forEach(function(t) { tagWeightMap[t.id] = t.weight })

  var candidates = []

  Object.keys(BOTTLENECKS).forEach(function(bnId) {
    var bn = BOTTLENECKS[bnId]
    var score = 0
    var matchedTags = []

    // Score from indicator tags
    bn.indicatorTags.forEach(function(tagId) {
      if (tagWeightMap[tagId]) {
        score += tagWeightMap[tagId] * 1.5
        matchedTags.push(tagId)
      }
    })

    // Archetype bias boost
    if (archetype && archetype.primary && bn.archetypeBias[archetype.primary]) {
      score += bn.archetypeBias[archetype.primary] * 2.0
    }

    // Normalize
    // Normalize — use higher cap to differentiate strong matches
    score = Math.round(Math.min(score, 2.0) * 50) / 100  // cap at 2.0, convert to 0-1 range

    if (score > 0.05) {
      candidates.push({
        id: bnId,
        label: bn.label,
        score: Math.round(score * 100) / 100,
        matchedTags: matchedTags,
        solution: bn.solutionDirection
      })
    }
  })

  // Sort by score desc
  candidates.sort(function(a, b) { return b.score - a.score })

  if (candidates.length === 0) {
    return {
      bottleneck: 'SYSTEM',
      label: '系统',
      reason: ['DEFAULT_FALLBACK'],
      confidence: 0.3,
      solution: BOTTLENECKS.SYSTEM.solutionDirection,
      candidates: []
    }
  }

  var top = candidates[0]
  var bnDef = BOTTLENECKS[top.id]

  return {
    bottleneck: top.id,
    label: bnDef.label,
    description: bnDef.description,
    reason: top.matchedTags.slice(0, 5),
    confidence: top.score,
    solution: bnDef.solutionDirection,
    candidates: candidates.slice(0, 3),
    summary: '核心瓶颈: ' + bnDef.label + ' (' + top.score.toFixed(2) + ')\n' +
             '原因标签: ' + top.matchedTags.join(', ') + '\n' +
             '解决方向: ' + bnDef.solutionDirection
  }
}

/**
 * Get bottleneck definition by id.
 */
function getBottleneck(bnId) {
  return BOTTLENECKS[bnId] || null
}

module.exports = {
  BOTTLENECKS: BOTTLENECKS,
  identifyBottleneck: identifyBottleneck,
  getBottleneck: getBottleneck
}
