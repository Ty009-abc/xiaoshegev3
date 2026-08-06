/**
 * RC8.1 Wealth Archetype Engine
 *
 * Maps behavior tags to personality archetypes.
 * Returns ONE primary + ONE secondary archetype.
 * NOT MBTI — wealth-specific personality patterns.
 */

// ──────────────────────────────────────────────
// Archetype Definitions
// ──────────────────────────────────────────────

var ARCHETYPES = {
  BUILDER: {
    id: 'BUILDER',
    title: '建设者',
    tagline: '建立系统，长期复利',
    trait: {
      strengths: ['长期思维','系统思维','耐心','重视积累','稳定输出'],
      weaknesses: ['启动慢','保守','可能错过短期机会','对变化敏感'],
      coreNeed: '需要可复制的增长系统'
    },
    positiveTags: ['LONG_TERM','SYSTEM_THINKING','ASSET_AWARE','CASHFLOW_AWARE','SELF_INVESTMENT','ACTION_FIRST'],
    negativeTags: ['SHORT_TERM_THINKING','SHORT_TERM_GAMBLE','SCATTERED','HIGH_RISK']
  },

  OPERATOR: {
    id: 'OPERATOR',
    title: '执行者',
    tagline: '执行力强，但缺战略',
    trait: {
      strengths: ['执行力极强','行动力','不拖延','实战导向'],
      weaknesses: ['系统弱','可能低效重复','缺乏长远规划','容易陷入事务','需要方向引导'],
      coreNeed: '需要一个明确的战略方向'
    },
    positiveTags: ['ACTION_FIRST','LOW_EXECUTION','RESOURCE_DRIVEN','MULTIPLE_INCOME'],
    negativeTags: ['NO_PLAN','SYSTEM_THINKING','LONG_TERM','NO_DIRECTION']
  },

  SELLER: {
    id: 'SELLER',
    title: '销售者',
    tagline: '会卖，会成交，变现能力强',
    trait: {
      strengths: ['销售能力','成交力','变现意识','敢要价','行动快'],
      weaknesses: ['可能缺乏产品深度','可能过度追求变现','长远布局弱','需要好产品支撑'],
      coreNeed: '需要一个好产品作为支撑'
    },
    positiveTags: ['MULTIPLE_INCOME','CASHFLOW_AWARE','ACTION_FIRST','RESOURCE_DRIVEN','HESITANT_PRICING'],
    negativeTags: ['NO_SELLING','NO_PRODUCT','LOW_SELF_VALUE','LEARNING_ADDICT']
  },

  CREATOR: {
    id: 'CREATOR',
    title: '创作者',
    tagline: '内容为王，产品驱动',
    trait: {
      strengths: ['产品思维','内容能力','IP潜力','创造力','专注深度'],
      weaknesses: ['可能不会卖','可能不善于商业变现','执行力可能是短板','容易陷入完美主义'],
      coreNeed: '需要商业变现能力'
    },
    positiveTags: ['SELF_INVESTMENT','LONG_TERM','NO_PRODUCT','PERFECTIONISM','SYSTEM_THINKING'],
    negativeTags: ['NO_SELLING','NO_VERIFICATION','LOW_EXECUTION','HIGH_RISK']
  },

  EMPLOYEE: {
    id: 'EMPLOYEE',
    title: '雇员型',
    tagline: '安全第一，依赖工资',
    trait: {
      strengths: ['稳定可靠','执行力好','规则意识','服从体系'],
      weaknesses: ['风险厌恶','缺乏自主性','依赖外部安全感','创新不足','不敢跳脱'],
      coreNeed: '需要突破安全区，建立独立收入来源'
    },
    positiveTags: ['TIME_FOR_MONEY','SINGLE_INCOME','SAFE_FIRST','RISK_AVOIDANCE','LOW_INCOME'],
    negativeTags: ['PASSIVE_INCOME','MULTIPLE_INCOME','ACTION_FIRST','HIGH_RISK']
  },

  COLLECTOR: {
    id: 'COLLECTOR',
    title: '收藏者',
    tagline: '囤积知识，从不行动',
    trait: {
      strengths: ['学习能力强','信息量大','知识面广','追求完善'],
      weaknesses: ['行动为零','囤课不学学不做','完美主义拖延','知识消化不良','变现为零'],
      coreNeed: '需要从学到做的飞跃'
    },
    positiveTags: ['LEARNING_ADDICT','PERFECTIONISM','PROCRASTINATION','NO_VERIFICATION','OVER_THINKING'],
    negativeTags: ['ACTION_FIRST','LOW_EXECUTION','NO_SELLING','NO_FEEDBACK_LOOP']
  },

  GAMBLER: {
    id: 'GAMBLER',
    title: '赌徒型',
    tagline: '追热点，高风险，短期主义',
    trait: {
      strengths: ['敢于行动','高风险偏好','看到机会就扑','灵活快速'],
      weaknesses: ['缺乏系统','没有长期规划','容易追涨杀跌','缺少复利思维','风险管控弱'],
      coreNeed: '需要建立稳健的长期系统'
    },
    positiveTags: ['HIGH_RISK','SHORT_TERM_THINKING','FOLLOW_CROWD','SHORT_TERM_GAMBLE','COPY_PASTE'],
    negativeTags: ['LONG_TERM','SYSTEM_THINKING','SAFE_FIRST','RISK_AVOIDANCE']
  }
}

// ──────────────────────────────────────────────
// Core Engine
// ──────────────────────────────────────────────

/**
 * Identify primary and secondary wealth archetype from behavior tags.
 *
 * @param {Array} tags - extracted behavior tags [{ id, weight, confidence, ... }]
 * @returns {Object} { primary, secondary, confidence, scores, reasoning }
 */
function identifyArchetype(tags) {
  if (!tags || tags.length === 0) {
    return {
      primary: 'UNDETERMINED',
      secondary: 'UNDETERMINED',
      confidence: 0,
      scores: {},
      reasoning: 'Insufficient behavior data for archetype identification'
    }
  }

  // Score each archetype
  var scores = {}
  var tagWeightMap = {}
  tags.forEach(function(t) { tagWeightMap[t.id] = t.weight })

  Object.keys(ARCHETYPES).forEach(function(archId) {
    var arch = ARCHETYPES[archId]
    var score = 0

    // Positive tags INCREASE score for this archetype
    arch.positiveTags.forEach(function(tagId) {
      if (tagWeightMap[tagId]) score += tagWeightMap[tagId] * 2.0
    })

    // Negative tags that are PRESENT decrease score (paradoxical overlap)
    arch.negativeTags.forEach(function(tagId) {
      if (tagWeightMap[tagId]) score -= tagWeightMap[tagId] * 0.5
    })

    // Normalize
    scores[archId] = Math.max(0, Math.min(score / (arch.positiveTags.length * 0.5 + 1), 1.0))
  })

  // Rank
  var ranked = Object.keys(scores).map(function(k) { return { id: k, score: scores[k] } })
  ranked.sort(function(a, b) { return b.score - a.score })

  var primary = ranked[0]
  var secondary = ranked[1] || ranked[0]

  // If top score is very low, mark as undetermined
  if (primary.score < 0.1) {
    return {
      primary: 'UNDETERMINED',
      secondary: 'UNDETERMINED',
      confidence: 0,
      scores: scores,
      reasoning: 'No clear archetype pattern detected — need more data'
    }
  }

  // Reasoning chain
  var primaryArch = ARCHETYPES[primary.id]
  var reasoningTags = tags.filter(function(t) {
    return primaryArch.positiveTags.indexOf(t.id) !== -1
  }).slice(0, 3).map(function(t) { return t.id })

  return {
    primary: primary.id,
    primaryTitle: primaryArch.title,
    primaryTagline: primaryArch.tagline,
    primaryTraits: primaryArch.trait,
    secondary: secondary.id,
    secondaryTitle: ARCHETYPES[secondary.id] ? ARCHETYPES[secondary.id].title : 'N/A',
    confidence: Math.round(primary.score * 100) / 100,
    scores: scores,
    reasoning: 'Primary match via tags: ' + reasoningTags.join(', ') + '. ' +
               'Score: ' + primary.score.toFixed(2) + ' / Secondary: ' + secondary.score.toFixed(2),
    // For prompt injection
    summary: '主人格: ' + primaryArch.title + ' (' + primaryArch.tagline + ')\n' +
             '副人格: ' + (ARCHETYPES[secondary.id] ? ARCHETYPES[secondary.id].title : 'N/A') + '\n' +
             '核心需求: ' + primaryArch.trait.coreNeed
  }
}

/**
 * Get archetype definition by id.
 * @param {string} archId
 * @returns {Object|null}
 */
function getArchetype(archId) {
  return ARCHETYPES[archId] || null
}

module.exports = {
  ARCHETYPES: ARCHETYPES,
  identifyArchetype: identifyArchetype,
  getArchetype: getArchetype
}
