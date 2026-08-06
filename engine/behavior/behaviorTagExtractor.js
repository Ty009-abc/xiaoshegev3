/**
 * RC8.1 Behavior Tag Extractor
 *
 * Converts raw questionnaire answers into structured behavior tags.
 * NOT "what user said" — but "what user behavior this reveals."
 *
 * Target: 30-40 tags across 5 categories
 * Max: 50 tags
 */

// ──────────────────────────────────────────────
// Tag Taxonomy (v1.0)
// ──────────────────────────────────────────────

const TAG_TAXONOMY = {
  income: {
    label: '收入模式',
    tags: {
      TIME_FOR_MONEY:      { keywords: ['工资','上班','打工','时薪','月薪','年薪','工作收入','主业收入'] },
      SINGLE_INCOME:       { keywords: ['只有一份','单一','一个来源','工资是唯一'] },
      MULTIPLE_INCOME:     { keywords: ['副业','多个收入','兼职','多元化','第二个','另外还有'] },
      PASSIVE_INCOME:      { keywords: ['被动','租金','分红','利息','躺赚','自动化'] },
      NO_PRODUCT:          { keywords: ['没有产品','提供服务','卖时间','不会产品化'] },
      NO_SYSTEM:           { keywords: ['亲力亲为','自己干','离不开','没有系统'] },
      INCOME_CEILING:      { keywords: ['收入上限','瓶颈','涨不上去','到顶'] },
      LOW_INCOME:          { keywords: ['5000以下','勉强','不够用','月光','存不下'] },
    }
  },
  behavior: {
    label: '行为模式',
    tags: {
      ACTION_FIRST:        { keywords: ['先做','试了再说','直接行动','干就完了','做起来'] },
      LEARNING_ADDICT:     { keywords: ['每天学习','上很多课','囤课','囤了','买课','知识付费','看书学习','看书上课','学习囤积'] },
      PROCRASTINATION:     { keywords: ['拖延','等等','再想想','还没开始','计划中','准备'] },
      WAITING:             { keywords: ['等时机','等机会','观望','先看看','看别人'] },
      PERFECTIONISM:       { keywords: ['做到完美','不满意','反复改','追求极致','不够好'] },
      FOLLOW_CROWD:        { keywords: ['大家做','跟风','热门','看别人赚钱','模仿'] },
      LOW_EXECUTION:       { keywords: ['执行力差','坚持不住','三分钟热度','半途而废'] },
      SHORT_TERM_THINKING: { keywords: ['赚快钱','短期','马上见效','快速','急'] },
      OVER_THINKING:       { keywords: ['想太多','焦虑','纠结','反复权衡','拿不定主意'] },
      NO_FEEDBACK_LOOP:    { keywords: ['不知道对不对','没人告诉','没有数据','凭感觉'] },
    }
  },
  wealth: {
    label: '财富模式',
    tags: {
      SAFE_FIRST:          { keywords: ['稳定','安全','保障','五险一金','铁饭碗','不冒险'] },
      RISK_AVOIDANCE:      { keywords: ['怕亏','不敢投','万一失败','担心风险','保守'] },
      HIGH_RISK:           { keywords: ['敢投','加大杠杆','高回报','赌一把','重仓'] },
      LONG_TERM:           { keywords: ['长期持有','慢慢来','复利','耐心','积累'] },
      SYSTEM_THINKING:     { keywords: ['需要系统','自动化','流程','模式','可复制'] },
      RESOURCE_DRIVEN:     { keywords: ['有资源','有流量','有人脉','有渠道','借助'] },
      ASSET_AWARE:         { keywords: ['资产','投资','买房','股票','基金','数字资产'] },
      CASHFLOW_AWARE:      { keywords: ['现金流','回款','收款','变现','赚钱速度','收钱','变现能力','成交额','销售','推销','签单','成交'] },
      SALES_ORIENTED:      { keywords: ['销售出身','做销售','成交','客户','卖东西','销售能力强','会卖','变现能力强'] },
    }
  },
  growth: {
    label: '成长模式',
    tags: {
      SELF_INVESTMENT:     { keywords: ['投资自己','提升能力','学习技能','成长','变强'] },
      NO_SELLING:          { keywords: ['不好意思卖','不会卖','不敢卖','不知道怎么卖','不喜欢销售'] },
      NO_VERIFICATION:     { keywords: ['没验证','不确定','不知道值不值','没试过卖'] },
      NO_PRODUCT:          { keywords: ['没有产品','不知道卖什么','没有东西可以卖'] },
      LOW_SELF_VALUE:      { keywords: ['不值钱','不自信','不够好','配不上','不敢要价','不好意思','有底气','胆量','不敢' ] },
      HESITANT_PRICING:    { keywords: ['不知道怎么定价','怕贵了','怕便宜了','报价纠结'] },
      NO_AUDIENCE:         { keywords: ['没有流量','没人关注','不知道怎么获客','没有影响力'] },
      CONTENT_CREATOR:     { keywords: ['内容创作','做内容','写文章','拍视频','写公众号','小红书','短视频','自媒体','内容能力'] },
      BUILDING_IP:         { keywords: ['个人IP','个人品牌','建立IP','打造IP','做IP','知识IP','影响力变现'] },
    }
  },
  strategy: {
    label: '战略模式',
    tags: {
      NO_DIRECTION:        { keywords: ['迷茫','不知道方向','没目标','不知道做什么','没有方向'] },
      SCATTERED:           { keywords: ['什么都做','不够专注','东做西做','分散','同时做太多'] },
      NO_PLAN:             { keywords: ['没有计划','走一步看一步','随缘','看情况','没规划'] },
      SHORT_TERM_GAMBLE:   { keywords: ['想赚快钱','短线','快速变现','马上见到钱'] },
      COPY_PASTE:          { keywords: ['模仿别人','复制','照抄','看到别人赚钱就做'] },
      LONELY_WOLF:         { keywords: ['一个人扛','没人帮忙','不合作','自己摸索'] },
    }
  }
}

// ──────────────────────────────────────────────
// Core Extractor
// ──────────────────────────────────────────────

/**
 * Extract behavior tags from raw questionnaire answers.
 *
 * @param {Object} answers - { q1: "answer text", q2: "answer text", ... }
 * @param {Object} [options]
 * @param {number} [options.minWeight=0.3] - minimum weight to include a tag
 * @param {number} [options.maxTags=50] - maximum tags to return
 * @returns {Object} { tags: Tag[], stats: {...} }
 */
function extractTags(answers, options) {
  options = options || {}
  var minWeight = options.minWeight || 0.15
  var maxTags = options.maxTags || 50

  var tagMap = {}

  // Process each answer
  Object.keys(answers).forEach(function(qKey) {
    var text = (answers[qKey] || '').toLowerCase()
    if (!text) return

    // Scan all taxonomy categories
    Object.keys(TAG_TAXONOMY).forEach(function(catKey) {
      var category = TAG_TAXONOMY[catKey]
      Object.keys(category.tags).forEach(function(tagId) {
        var def = category.tags[tagId]
        var matchCount = 0
        var totalKeywords = def.keywords.length

        def.keywords.forEach(function(kw) {
          if (text.indexOf(kw.toLowerCase()) !== -1) matchCount++
        })

        if (matchCount > 0) {
          // Weight = keyword match ratio × category relevance
          var kwScore = Math.min(matchCount / Math.max(totalKeywords, 1), 1.0)
          var weight = Math.min(kwScore * 2.0, 1.0) // boost significantly for single-match detection

          if (tagMap[tagId]) {
            // Multi-question reinforcement
            tagMap[tagId].weight = Math.min(tagMap[tagId].weight + weight * 0.5, 1.0)
            tagMap[tagId].confidence = Math.min(tagMap[tagId].confidence + 0.15, 1.0)
            if (tagMap[tagId].sourceQuestions.indexOf(qKey) === -1) {
              tagMap[tagId].sourceQuestions.push(qKey)
            }
          } else {
            tagMap[tagId] = {
              id: tagId,
              category: catKey,
              weight: Math.min(weight, 1.0),
              confidence: 0.65 + weight * 0.25,
              sourceQuestions: [qKey]
            }
          }
        }
      })
    })
  })

  // Convert to array, sort by weight desc
  var tags = Object.keys(tagMap).map(function(k) { return tagMap[k] })
  tags.sort(function(a, b) { return b.weight - a.weight })

  // Filter by min weight, cap at maxTags
  tags = tags.filter(function(t) { return t.weight >= minWeight })
  // If too few tags, relax min weight
  if (tags.length < 5 && minWeight > 0.08) {
    tags = Object.keys(tagMap).map(function(k) { return tagMap[k] })
    tags.sort(function(a, b) { return b.weight - a.weight })
    tags = tags.filter(function(t) { return t.weight >= 0.08 })
  }
  if (tags.length > maxTags) tags = tags.slice(0, maxTags)

  // Stats
  var stats = {
    totalTags: tags.length,
    categoryBreakdown: {},
    topTag: tags.length > 0 ? tags[0].id : null,
    topTagWeight: tags.length > 0 ? tags[0].weight : 0
  }
  tags.forEach(function(t) {
    stats.categoryBreakdown[t.category] = (stats.categoryBreakdown[t.category] || 0) + 1
  })

  return { tags: tags, stats: stats }
}

/**
 * Generate tag summary text for prompt injection.
 * @param {Array} tags - extracted tags array
 * @returns {string} formatted summary
 */
function formatTagSummary(tags) {
  if (!tags || tags.length === 0) return '(no behavior tags)'

  var byCategory = {}
  tags.forEach(function(t) {
    if (!byCategory[t.category]) byCategory[t.category] = []
    byCategory[t.category].push(t)
  })

  var lines = []
  Object.keys(byCategory).forEach(function(cat) {
    var label = TAG_TAXONOMY[cat] ? TAG_TAXONOMY[cat].label : cat
    lines.push('【' + label + '】')
    byCategory[cat].forEach(function(t) {
      lines.push('  ' + t.id + ' (weight:' + t.weight.toFixed(2) + ' conf:' + t.confidence.toFixed(2) + ')')
    })
  })

  return lines.join('\n')
}

module.exports = {
  TAG_TAXONOMY: TAG_TAXONOMY,
  extractTags: extractTags,
  formatTagSummary: formatTagSummary
}
