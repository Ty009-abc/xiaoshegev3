/**
 * RC8.1 One Strategy Engine
 *
 * Generates the ONE strategy that drives the entire report.
 * All cards must revolve around this single strategic direction.
 *
 * Rule: ONE strategy only. No multi-directional advice.
 */

// ──────────────────────────────────────────────
// Strategy Definitions
// ──────────────────────────────────────────────

var STRATEGIES = {
  SELL_FIRST: {
    id: 'SELL_FIRST',
    label: '先成交',
    tagline: '停止学习，开始收钱',
    description: '未来180天，唯一目标：完成第一次成交。所有学习暂停，所有副业暂停，只做一件事：让一个人愿意为你付钱。',
    suitableBottlenecks: ['SELLING','CONFIDENCE','EXECUTION','PRICING'],
    suitableArchetypes: ['COLLECTOR','CREATOR','EMPLOYEE','OPERATOR'],
    milestones: [
      { day: 7,  goal: '找到3个潜在客户并完成第一次报价' },
      { day: 30, goal: '完成3次真实成交，建立信心证据链' },
      { day: 180, goal: '建立稳定的销售-成交-交付闭环系统，月收入达到目标30%' }
    ],
    day1Mission: '今天：找出你能卖给谁，列出3个名字，给他们发消息。'
  },

  BUILD_ACQUISITION_SYSTEM: {
    id: 'BUILD_ACQUISITION_SYSTEM',
    label: '建立获客系统',
    tagline: '没有流量，一切都是空谈',
    description: '未来180天，唯一目标：建立一个每天能稳定获取50+精准用户的获客系统。暂停所有变现尝试，先解决流量问题。',
    suitableBottlenecks: ['TRAFFIC','POSITIONING','LEVERAGE'],
    suitableArchetypes: ['CREATOR','BUILDER','OPERATOR'],
    milestones: [
      { day: 7,  goal: '确定唯一内容平台和垂直领域，发布首条内容' },
      { day: 30, goal: '每天稳定产出1条内容，积累首批100粉丝' },
      { day: 180, goal: '内容-引流-私域转化闭环跑通，日稳定新增50+' }
    ],
    day1Mission: '今天：选一个平台，写一篇你专业领域的内容，发布出去。'
  },

  BUILD_PRODUCT: {
    id: 'BUILD_PRODUCT',
    label: '打造产品',
    tagline: '必须先有一个能卖的东西',
    description: '未来180天，唯一目标：将你的知识、经验或技能打包成一个可销售的产品。不做流量，不做销售，先做出产品。',
    suitableBottlenecks: ['PRODUCT','LEVERAGE','SYSTEM'],
    suitableArchetypes: ['CREATOR','COLLECTOR','EMPLOYEE','OPERATOR'],
    milestones: [
      { day: 7,  goal: '完成产品MVP定义：谁需要，解决什么问题，怎么交付' },
      { day: 30, goal: '产品第一版上线，定价完成，页面发布' },
      { day: 180, goal: '产品完成10次迭代，用户反馈循环建立，开始稳定销售' }
    ],
    day1Mission: '今天：写出你的产品一句话描述。你的产品是什么？谁需要它？'
  },

  BUILD_IP: {
    id: 'BUILD_IP',
    label: '建立个人IP',
    tagline: '你没有产品，你就是产品',
    description: '未来180天，唯一目标：在垂直领域建立你的个人品牌和影响力。内容输出为核心，个人信用为资产。',
    suitableBottlenecks: ['TRAFFIC','POSITIONING','LEVERAGE','CONFIDENCE'],
    suitableArchetypes: ['CREATOR','BUILDER','SELLER'],
    milestones: [
      { day: 7,  goal: '确定IP定位（领域+人设+价值主张），发布宣言内容' },
      { day: 30, goal: '形成固定内容节奏，粉丝增长曲线开始上扬' },
      { day: 180, goal: '成为领域内可辨识的声音，开始有主动合作/变现机会' }
    ],
    day1Mission: '今天：用一句话写清楚你是谁、帮谁、解决什么问题。这就是你的IP定位。'
  },

  BUILD_SYSTEM: {
    id: 'BUILD_SYSTEM',
    label: '建立运营系统',
    tagline: '从手工到机器',
    description: '未来180天，唯一目标：将你当前的业务/工作流程标准化、系统化、可复制化。从一个人扛到系统运转。',
    suitableBottlenecks: ['SYSTEM','EXECUTION','DISCIPLINE'],
    suitableArchetypes: ['OPERATOR','BUILDER','SELLER'],
    milestones: [
      { day: 7,  goal: '画出当前业务核心流程图，标注每个节点的耗时和瓶颈' },
      { day: 30, goal: '完成TOP3瓶颈节点的流程优化和自动化' },
      { day: 180, goal: '核心业务链实现70%系统化，可离开你运行3天' }
    ],
    day1Mission: '今天：拿一张纸，画出你赚钱的完整流程图。'
  },

  BUILD_CASHFLOW: {
    id: 'BUILD_CASHFLOW',
    label: '建立现金流',
    tagline: '先活下来，再谈发展',
    description: '未来180天，唯一目标：建立一个稳定、可预测的月收入现金流。不追求快速增长，追求稳定可迭代。',
    suitableBottlenecks: ['LEVERAGE','PRICING','SELLING','EXECUTION'],
    suitableArchetypes: ['EMPLOYEE','OPERATOR','SELLER'],
    milestones: [
      { day: 7,  goal: '清点所有可能收入来源，选择最快能变现的一个' },
      { day: 30, goal: '完成第一笔独立收入（非工资），金额不重要' },
      { day: 180, goal: '月独立收入稳定达到目标水平50%，至少2个收入渠道' }
    ],
    day1Mission: '今天：列出你所有可能赚钱的方式，标出最快能收钱的那一个。'
  },

  DISCIPLINE_FIRST: {
    id: 'DISCIPLINE_FIRST',
    label: '先立纪律',
    tagline: '没有纪律，所有战略都是空话',
    description: '未来180天，唯一目标：建立严格的每日执行纪律。砍掉所有"学习"和"准备"，每天只做一件事：完成最小行动单元。',
    suitableBottlenecks: ['DISCIPLINE','EXECUTION','CONFIDENCE'],
    suitableArchetypes: ['COLLECTOR','GAMBLER','OPERATOR'],
    milestones: [
      { day: 7,  goal: '建立每日1个强制行动，连续7天不中断' },
      { day: 30, goal: '形成肌肉记忆，每日行动不需要靠意志力推进' },
      { day: 180, goal: '纪律成为习惯，至少产生一个可量化的业务成果' }
    ],
    day1Mission: '今天：确定你的每日最小行动（<30分钟），现在就做第一遍。'
  }
}

// ──────────────────────────────────────────────
// Core Engine
// ──────────────────────────────────────────────

/**
 * Select the ONE strategy based on bottleneck + archetype.
 *
 * @param {Object} bottleneck - { bottleneck, label, confidence, reason }
 * @param {Object} archetype - { primary, secondary, primaryTraits }
 * @param {Array} tags - behavior tags (for context enrichment)
 * @param {Object} [options] - { strategyModifiers: { boostedStrategies, suppressedStrategies } }
 * @returns {Object} { strategy, strategyDef, milestone, day1Mission, confidence, summary }
 */
function determineStrategy(bottleneck, archetype, tags, options) {
  options = options || {}
  var modifiers = options.strategyModifiers || { boostedStrategies: {}, suppressedStrategies: {} }
  var candidates = []

  Object.keys(STRATEGIES).forEach(function(stId) {
    var st = STRATEGIES[stId]
    var score = 0

    // Bottleneck match (primary)
    if (bottleneck && st.suitableBottlenecks.indexOf(bottleneck.bottleneck) !== -1) {
      score += 3.0
    }

    // Archetype match
    if (archetype && st.suitableArchetypes.indexOf(archetype.primary) !== -1) {
      score += 2.0
    }

    // Secondary archetype match (half weight)
    if (archetype && st.suitableArchetypes.indexOf(archetype.secondary) !== -1) {
      score += 0.5
    }

    // Bottleneck confidence boost
    if (bottleneck && bottleneck.confidence > 0.8 &&
        st.suitableBottlenecks.indexOf(bottleneck.bottleneck) !== -1) {
      score += 1.0
    }

    if (score > 0) {
      candidates.push({ id: stId, label: st.label, tagline: st.tagline, score: score })
    }
  })

  // Fallback: if no match, use DISCIPLINE_FIRST as universal baseline
  if (candidates.length === 0) {
    candidates.push({ id: 'DISCIPLINE_FIRST', label: '先立纪律',
                      tagline: STRATEGIES.DISCIPLINE_FIRST.tagline, score: 0.5 })
  }

  candidates.sort(function(a, b) { return b.score - a.score })

  // Apply strategy modifiers from primaryGoal to ALL candidates
  candidates.forEach(function(c) {
    var boosted = modifiers.boostedStrategies[c.id] || 0
    var suppressed = modifiers.suppressedStrategies[c.id] || 0
    c.score = c.score + boosted + suppressed
  })

  // Re-sort after modifiers
  candidates.sort(function(a, b) { return b.score - a.score })
  var selected = candidates[0]
  var stDef = STRATEGIES[selected.id]

  var confidence = Math.min(selected.score / 6.0, 1.0)

  return {
    strategy: selected.id,
    strategyLabel: stDef.label,
    strategyTagline: stDef.tagline,
    strategyDescription: stDef.description,
    duration: 180,
    milestones: stDef.milestones,
    day1Mission: stDef.day1Mission,
    confidence: Math.round(confidence * 100) / 100,
    score: selected.score,
    alternatives: candidates.slice(1, 3).map(function(c) { return c.label }),
    summary: '唯一战略: ' + stDef.label + ' — ' + stDef.tagline + '\n' +
             '描述: ' + stDef.description + '\n' +
             'Day1: ' + stDef.day1Mission + '\n' +
             '180天里程碑: ' + stDef.milestones.map(function(m) { return 'D' + m.day + ' ' + m.goal }).join(' | ')
  }
}

/**
 * Get strategy definition by id.
 */
function getStrategy(stId) {
  return STRATEGIES[stId] || null
}

module.exports = {
  STRATEGIES: STRATEGIES,
  determineStrategy: determineStrategy,
  getStrategy: getStrategy
}
