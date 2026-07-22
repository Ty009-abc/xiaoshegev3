/**
 * core/turnaround-intelligence/builders/evidenceBuilder.js
 *
 * CP6-A EvidenceBuilder — 证据构建器
 *
 * 从标准化 answers 中提取结构化 Evidence。
 *
 * 这是 pipeline 的第二个处理步骤。
 * 后续所有 Engine 只能读取 Evidence，不允许直接读取 answers。
 *
 * EvidenceBuilder 是纯规则引擎：
 *   - 基于关键词匹配
 *   - 基于答案模式检测
 *   - 基于跨题模式的关联检测
 *   - 不调用任何 AI
 *
 * @version 6.0.0
 * @checkpoint CP6-A
 */

const {
  BEHAVIOR_TAGS, WEALTH_TAGS, PSYCHOLOGY_TAGS, PATTERN_TAGS,
} = require('../contracts/tags')
const { createEvidence, createEvidenceSet } = require('../contracts/evidence')
const { extractAnswerSummary } = require('./normalizer')

// ═══════════════════════════════════════
// 关键词 → 标签映射表
// ═══════════════════════════════════════

const KEYWORD_TAG_MAP = [
  // --- 行为 ---
  { keywords: ['拖延', '等一等', '等等', '明天', '以后再说', '以后', '过段时间', '再等等', '推迟'], tag: BEHAVIOR_TAGS.ACTION_DELAY, weight: 0.85 },
  { keywords: ['马上行动', '立即行动', '立刻行动', '立刻执行'], tag: BEHAVIOR_TAGS.ACTION_FAST, weight: 0.75 },
  { keywords: ['想太多', '纠结', '犹豫', '反复思考', '想想', '琢磨', '不知道怎么选'], tag: BEHAVIOR_TAGS.OVERTHINKING, weight: 0.80 },
  { keywords: ['学习', '看书', '课程', '教程', '上课', '读书', '学', '培训'], tag: BEHAVIOR_TAGS.LEARNING, weight: 0.70 },
  { keywords: ['坚持', '自律', '习惯', '每天', '规律', '打卡', '按时'], tag: BEHAVIOR_TAGS.DISCIPLINE, weight: 0.75 },
  { keywords: ['冲动', '情绪', '焦虑', '烦躁', '生气', '一时上头', '上头', '控制不住'], tag: BEHAVIOR_TAGS.EMOTION_DRIVEN, weight: 0.82 },
  { keywords: ['买', '消费', '花钱', '购物', '剁手', '想要', '忍不住买'], tag: BEHAVIOR_TAGS.CONSUMPTION_PATTERN, weight: 0.72 },
  { keywords: ['长期', '未来', '几年', '三年', '五年', '持续', '积累'], tag: BEHAVIOR_TAGS.LONG_TERM_ORIENTED, weight: 0.70 },
  { keywords: ['短期', '当下', '眼前', '先', '目前', '现在'], tag: BEHAVIOR_TAGS.SHORT_TERM_ORIENTED, weight: 0.68 },
  { keywords: ['三天打鱼', '坚持不下去', '断断续', '中断', '停', '放弃', '做不下去', '不想做', '换方向', '经常换', '坚持不了', '不到三个'], tag: BEHAVIOR_TAGS.INCONSISTENCY, weight: 0.83 },
  { keywords: ['执行力不足', '执行力弱', '行动力弱', '动手太慢', '做不下去'], tag: BEHAVIOR_TAGS.EXECUTION_WEAK, weight: 0.78, importance: 0.90, direction: 'negative' },
  { keywords: ['执行力强', '做得快', '效率高', '执行力高', '效率很高'], tag: BEHAVIOR_TAGS.EXECUTION_STRONG, weight: 0.78, importance: 0.90, direction: 'positive' },

  // --- 财富 ---
  { keywords: ['高薪', '高收入', '月入', '年薪', '工资高', '收入不错', '收入高'], tag: WEALTH_TAGS.HIGH_INCOME, weight: 0.78 },
  { keywords: ['没钱', '缺钱', '工资低', '收入低', '勉强', '仅够', '不够用'], tag: WEALTH_TAGS.LOW_INCOME, weight: 0.82 },
  { keywords: ['只有一份', '一份工作', '一个收入', '单一', '一个来源', '只有这', '只有一份', '没有副业', '没有第二'], tag: WEALTH_TAGS.SINGLE_INCOME, weight: 0.85 },
  { keywords: ['副业收入', '第二收入', '多个收入', '多个来源', '额外收入', '兼职收入'], tag: WEALTH_TAGS.MULTI_INCOME, weight: 0.78, direction: 'positive' },
  { keywords: ['没存款', '没有资产', '空手', '零', '月光', '无积蓄'], tag: WEALTH_TAGS.NO_ASSET, weight: 0.82 },
  { keywords: ['有存款', '有房', '有车', '资产', '积蓄', '储蓄', '投资'], tag: WEALTH_TAGS.HAS_ASSET, weight: 0.75 },
  { keywords: ['负债', '欠', '借', '贷款', '信用卡', '花呗', '还钱'], tag: WEALTH_TAGS.DEBT_PRESSURE, weight: 0.88 },
  { keywords: ['存款够', '有缓冲', '不慌', '够用', '安全垫'], tag: WEALTH_TAGS.FINANCIAL_BUFFER, weight: 0.72 },
  { keywords: ['收入不稳定', '收入波动', '时有时无', '收入不稳', '收入不稳定'], tag: WEALTH_TAGS.INCOME_UNSTABLE, weight: 0.82 },
  { keywords: ['收入稳定', '固定收入', '稳定收入', '铁饭碗', '稳定工作', '公务员'], tag: WEALTH_TAGS.INCOME_STABLE, weight: 0.78 },

  // --- 心理 ---
  { keywords: ['怕', '担心', '不敢', '害怕', '风险', '万一'], tag: PSYCHOLOGY_TAGS.RISK_AVOID, weight: 0.80 },
  { keywords: ['冒险', '赌', '博', '冲', '拼', '敢'], tag: PSYCHOLOGY_TAGS.RISK_SEEK, weight: 0.75 },
  { keywords: ['不行', '做不了', '不会', '我不行', '能力不够', '不够格', '配不上'], tag: PSYCHOLOGY_TAGS.SELF_DOUBT, weight: 0.85 },
  { keywords: ['有信心', '相信', '自信', '能行', '有能力', '可以'], tag: PSYCHOLOGY_TAGS.CONFIDENCE, weight: 0.78 },
  { keywords: ['稳定最重要', '安稳', '不想变', '保持现状', '不变'], tag: PSYCHOLOGY_TAGS.STABILITY_SEEKING, weight: 0.80 },
  { keywords: ['成长', '进步', '学到', '提高', '变得更好', '突破'], tag: PSYCHOLOGY_TAGS.GROWTH_MINDSET, weight: 0.78 },
  { keywords: ['没办法', '改不了', '就是这样', '天生的', '命'], tag: PSYCHOLOGY_TAGS.FIXED_MINDSET, weight: 0.82 },
  { keywords: ['焦虑', '压力', '睡不着', '紧张', '心慌'], tag: PSYCHOLOGY_TAGS.ANXIETY_HIGH, weight: 0.85 },
  { keywords: ['不焦虑', '淡定', '无所谓', '佛系'], tag: PSYCHOLOGY_TAGS.ANXIETY_LOW, weight: 0.72 },
  { keywords: ['环境', '市场', '公司', '老板', '运气', '大环境'], tag: PSYCHOLOGY_TAGS.EXTERNAL_LOCUS, weight: 0.80 },
  { keywords: ['我自己', '我的问题', '我可以改', '我的责任', '从我'], tag: PSYCHOLOGY_TAGS.INTERNAL_LOCUS, weight: 0.78 },
]

// ═══════════════════════════════════════
// 跨题模式检测规则
// ═══════════════════════════════════════

/**
 * 跨题模式: 同时命中特定标签组合 → 产生高级模式标签
 */
const CROSS_QUESTION_PATTERNS = [
  {
    name: PATTERN_TAGS.EMOTION_INTERRUPTS_COMPOUNDING,
    requiredTags: [BEHAVIOR_TAGS.EMOTION_DRIVEN, BEHAVIOR_TAGS.INCONSISTENCY],
    minOccurrence: 2,
    weight: 0.90,
    reason: '情绪驱动 + 行动不一致 → 情绪长期打断积累过程',
  },
  {
    name: PATTERN_TAGS.ANALYSIS_PARALYSIS,
    requiredTags: [BEHAVIOR_TAGS.OVERTHINKING, BEHAVIOR_TAGS.ACTION_DELAY],
    minOccurrence: 2,
    weight: 0.88,
    reason: '过度思考 + 行动拖延 → 分析导致决策瘫痪',
  },
  {
    name: PATTERN_TAGS.URGE_TO_ESCAPE,
    requiredTags: [BEHAVIOR_TAGS.EMOTION_DRIVEN, BEHAVIOR_TAGS.SHORT_TERM_ORIENTED],
    minOccurrence: 2,
    weight: 0.85,
    reason: '情绪驱动 + 短期导向 → 逃避当前困境',
  },
  {
    name: PATTERN_TAGS.OVERWHELM_AVOIDANCE,
    requiredTags: [PSYCHOLOGY_TAGS.ANXIETY_HIGH, BEHAVIOR_TAGS.ACTION_DELAY],
    minOccurrence: 2,
    weight: 0.86,
    reason: '高焦虑 + 行动拖延 → 因不知所措而回避',
  },
  {
    name: PATTERN_TAGS.SHINY_OBJECT_SYNDROME,
    requiredTags: [BEHAVIOR_TAGS.SHORT_TERM_ORIENTED, BEHAVIOR_TAGS.INCONSISTENCY],
    minOccurrence: 2,
    weight: 0.82,
    reason: '短期导向 + 不一致 → 追逐新事物但无法持续',
  },
  {
    name: PATTERN_TAGS.SURVIVAL_MODE,
    requiredTags: [WEALTH_TAGS.DEBT_PRESSURE, WEALTH_TAGS.LOW_INCOME],
    minOccurrence: 2,
    weight: 0.88,
    reason: '负债压力 + 低收入 → 生存模式限制所有决策',
  },
  {
    name: PATTERN_TAGS.PERFECTIONISM_BLOCK,
    requiredTags: [BEHAVIOR_TAGS.OVERTHINKING, PSYCHOLOGY_TAGS.SELF_DOUBT],
    minOccurrence: 2,
    weight: 0.84,
    reason: '过度思考 + 自我怀疑 → 完美主义导致行动阻塞',
  },
  {
    name: PATTERN_TAGS.ISOLATED_WORKER,
    requiredTags: [WEALTH_TAGS.SINGLE_INCOME, PSYCHOLOGY_TAGS.EXTERNAL_LOCUS],
    minOccurrence: 2,
    weight: 0.80,
    reason: '单一收入 + 外部归因 → 孤军奋战缺乏支持系统',
  },
  {
    name: PATTERN_TAGS.SKILL_WITHOUT_LEVERAGE,
    requiredTags: [BEHAVIOR_TAGS.LEARNING, WEALTH_TAGS.NO_ASSET],
    minOccurrence: 2,
    weight: 0.78,
    reason: '持续学习但无资产积累 → 有技能无杠杆放大',
  },
]

// ═══════════════════════════════════════
// buildEvidence — 从标准化答案构建证据集
// ═══════════════════════════════════════

/**
 * buildEvidence — 主入口
 *
 * @param {Object} normalized — normalize() 的输出 { answers, meta, warnings }
 * @returns {Object} EvidenceSet { evidences, meta }
 */
function buildEvidence(normalized) {
  const { answers } = normalized
  const summary = extractAnswerSummary(answers)
  const evidenceList = []

  let idCounter = 1
  const makeId = () => {
    const id = `E-${String(idCounter).padStart(3, '0')}`
    idCounter++
    return id
  }

  // 步骤 1: 逐题提取标签
  for (const questionId of summary.answeredQuestions) {
    const answer = answers[questionId]
    const matchedTags = matchTags(answer)

    for (const { tag, weight, importance, direction, reason, occurrences } of matchedTags) {
      evidenceList.push({
        id: makeId(),
        questionId,
        answer: truncate(answer, 120),
        weight: weight,
        importance: importance,
        direction: direction,
        tags: [tag],
        reason: `${questionId}: ${reason}`
          + (occurrences > 1 ? ` (关键词命中 ${occurrences} 次)` : ''),
      })
    }
  }

  // 步骤 2: 跨题模式检测
  const allTags = evidenceList.flatMap(e => e.tags)
  const patternEvidences = detectCrossQuestionPatterns(allTags, answers)
  for (const pe of patternEvidences) {
    // 去重：如果同一模式已存在，跳过
    const alreadyExist = evidenceList.some(
      e => e.tags.includes(pe.tag) && e.questionId === pe.questionId
    )
    if (!alreadyExist) {
      evidenceList.push({
        id: makeId(),
        questionId: pe.questionId,
        answer: pe.answer,
        weight: pe.weight,
        tags: [pe.tag],
        reason: pe.reason,
        metadata: { crossQuestion: true },
      })
    }
  }

  // 步骤 3: 合并同题同类证据（取最高权重）
  const merged = mergeEvidencesByQuestionTag(evidenceList)

  // 如果没有证据，返回最低限度 set（允许后续 Engine 降级）
  if (merged.length === 0) {
    return createEvidenceSetMinimal(answers)
  }

  return createEvidenceSet(merged)
}

// ═══════════════════════════════════════
// matchTags — 关键词匹配
// ═══════════════════════════════════════

function matchTags(text) {
  const results = []
  const lowerText = text.toLowerCase()

  for (const rule of KEYWORD_TAG_MAP) {
    let hitCount = 0
    for (const kw of rule.keywords) {
      if (lowerText.includes(kw)) {
        hitCount++
      }
    }
    if (hitCount > 0) {
      // 如果是 negative 规则（如"执行力不足"），需要确认文本中
      // 没有对应的正面词（如 "执行力强"）
      if (rule.negative) {
        const positiveCheck = lowerText.includes('强')
        if (positiveCheck && !lowerText.includes('不强') && !lowerText.includes('不足')) {
          continue // 跳过 — 这是正面表达
        }
      }

      results.push({
        tag: rule.tag,
        weight: rule.weight,
        importance: rule.importance || rule.weight,
        direction: rule.direction || undefined,
        reason: `命中标签：${rule.tag}（关键词出现 ${hitCount} 次）`,
        occurrences: hitCount,
      })
    }
  }

  // 去重：同一标签只保留最高权重的
  return deduplicateByTag(results)
}

// ═══════════════════════════════════════
// detectCrossQuestionPatterns — 跨题模式检测
// ═══════════════════════════════════════

function detectCrossQuestionPatterns(allTags, answers) {
  const results = []

  for (const pattern of CROSS_QUESTION_PATTERNS) {
    const hitCount = pattern.requiredTags.filter(tag => allTags.includes(tag)).length
    if (hitCount >= pattern.requiredTags.length) {
      // 检查出现频率
      const totalHits = pattern.requiredTags.reduce(
        (sum, tag) => sum + allTags.filter(t => t === tag).length, 0
      )
      if (totalHits >= pattern.minOccurrence) {
        // 找到任意一道有答案的题目作为关联
        const firstAnswered = Object.keys(answers).find(k => answers[k] && answers[k].length > 0) || 'Q1'
        results.push({
          tag: pattern.name,
          questionId: `PATTERN_${firstAnswered}`,
          answer: truncate(
            `跨题模式检测: ${pattern.requiredTags.join(' + ')}`,
            120
          ),
          weight: pattern.weight,
          reason: pattern.reason + ` (总计命中 ${totalHits} 次)`,
        })
      }
    }
  }

  return results
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function deduplicateByTag(results) {
  const seen = new Map()
  for (const r of results) {
    const existing = seen.get(r.tag)
    if (!existing || r.weight > existing.weight) {
      seen.set(r.tag, r)
    }
  }
  return [...seen.values()]
}

function mergeEvidencesByQuestionTag(evidences) {
  const groups = new Map()
  for (const ev of evidences) {
    const key = `${ev.questionId}|${ev.tags[0]}`
    const existing = groups.get(key)
    if (!existing || ev.weight > existing.weight) {
      groups.set(key, { ...ev })
    }
  }
  return [...groups.values()]
}

function truncate(text, maxLen) {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 3) + '...'
}

/**
 * createEvidenceSetMinimal — 当没有关键词命中时，从 answers 构建最低限度证据集
 */
function createEvidenceSetMinimal(answers) {
  const { createEvidence, createEvidenceSet } = require('../contracts/evidence')
  const list = []
  let counter = 1
  for (const [qid, answer] of Object.entries(answers)) {
    if (answer && answer.length > 0) {
      list.push({
        id: `E-${String(counter).padStart(3, '0')}`,
        questionId: qid,
        answer: truncate(answer, 80),
        weight: 0.30,
        tags: [],
        reason: `答案内容过短，无法提取强标签: ${truncate(answer, 40)}`,
      })
      counter++
    }
  }
  if (list.length === 0) {
    list.push({
      id: 'E-001', questionId: 'Q1', answer: '(答案过短)',
      weight: 0.10, tags: [],
      reason: '用户未提供足够信息',
    })
  }
  return createEvidenceSet(list)
}

module.exports = {
  buildEvidence,
  matchTags,
  detectCrossQuestionPatterns,
  KEYWORD_TAG_MAP,
  CROSS_QUESTION_PATTERNS,
}
