/**
 * cloudfunctions/common/responsePlanner.js — 回答计划器
 *
 * 四册 Part 5：Response Strategy
 *
 * 职责：在 LLM 生成前先规划回答大纲 → 避免 LLM 乱说
 *
 * 输入：intent / strategy / complexity / topic / context
 * 输出：结构化大纲 { hook, sections[], ending }
 */

const { STRATEGY_STRUCTURE } = require('./responseStrategy.js')
const { selectHookByStrategy } = require('../../knowledge/hooks/index.js')

/**
 * planResponse(intent, strategy, topic, options)
 *
 * @param {string} strategy  - direct | layered | cognitive_shock | coaching | strategic_planning | hard_truth
 * @param {string} topic     - 用户问题主题
 * @param {object} options   - { complexity, membership, context, variables }
 * @returns {object} 大纲
 */
function planResponse(intent, strategy, topic, options = {}) {
  const { complexity = 3, membership = 'free', context = {}, variables = {} } = options

  const structure = STRATEGY_STRUCTURE[strategy] || STRATEGY_STRUCTURE.layered
  const isVip = membership !== 'free'

  // ── 生成 Hook ──
  let hook = null
  if (structure.hasHook) {
    const h = selectHookByStrategy(strategy, topic, context)
    if (h) hook = h
  }

  // ── 根据策略生成分段大纲 ──
  let sections = []

  switch (strategy) {
    case 'direct':
      sections = [
        { tag: '答案', guidance: '一句话直接回答用户的问题，不要绕' },
        { tag: '补充', guidance: '给出1-2条关键补充信息或例子' },
      ]
      break

    case 'layered':
      sections = [
        { tag: '现象层', guidance: `描述${topic}的可见表象。不要分析，只说"看起来是什么样"。` },
        { tag: '表象原因', guidance: '第一层原因——大多数人以为的原因是什么？为什么这是错的？' },
        { tag: '利益关系', guidance: '谁从这个局面中获益？利益结构如何影响结果？' },
        { tag: '系统结构', guidance: '底层系统/规则/结构是如何设计的？为什么这个结构必然导致这个结果？' },
        { tag: '底层逻辑', guidance: '最本质的规律/公式是什么？用一个核心规则概括整个现象。' },
      ]
      break

    case 'cognitive_shock':
      sections = [
        { tag: '反常识事实', guidance: '揭示一个与直觉相反的真相。用数据和逻辑支撑。' },
        { tag: '核心机制', guidance: '解释为什么这个反常识事实是真的——背后的机制或逻辑链。' },
        { tag: '冲击结论', guidance: `一句话总结，让用户产生"原来如此"的感觉。关联到${topic}。` },
      ]
      break

    case 'coaching':
      sections = [
        { tag: '重新定义', guidance: `不建议用户该怎么做，而是帮Ta重新理解${topic}到底是什么问题。` },
        { tag: '三个问题', guidance: `提出3个让用户反思的问题，每个问题指向一个认知盲区。` },
        { tag: '一个洞察', guidance: '基于这些问题，给出一个让用户自己找到答案的方向。' },
      ]
      break

    case 'strategic_planning':
      sections = [
        { tag: '目标校准', guidance: `帮用户把模糊的目标（${topic}）变成可衡量的具体目标。` },
        { tag: '风险地图', guidance: '列出这个方向上最重要的3-5个风险，以及每个风险的真实概率。' },
        { tag: '资源盘点', guidance: '用户已经拥有什么资源？还缺什么？缺的能不能补？' },
        { tag: '路径建议', guidance: '给出2-3条可行路径，每条路径标注成功概率和时间窗口。' },
        { tag: '第一步', guidance: '不要给宏大计划，只给明天就能做的第一步。' },
      ]
      break

    case 'hard_truth':
      sections = [
        { tag: '残忍真相', guidance: `直接说出${topic}最让人不舒服的真相。不要绕。不要安慰。` },
        { tag: '为什么这么难', guidance: '解释为什么这个真相这么难被接受——心理机制、系统惯性、利益格局。' },
        { tag: '系统揭露', guidance: '揭示背后的系统/结构/规则设计——为什么这个局面不是偶然的。' },
        { tag: '最后冲击', guidance: `用一个小事哥风格的暴击结尾，让用户记住这句话。` },
      ]
      break
  }

  // ── 长度约束 ──
  const lengthConstraints = {
    short: { maxSections: 2, maxCharsPerSection: 80 },
    medium: { maxSections: 5, maxCharsPerSection: 150 },
    deep: { maxSections: 5, maxCharsPerSection: 250 },
  }
  const length = isVip ? 'deep' : complexity <= 2 ? 'short' : complexity <= 6 ? 'medium' : 'medium'
  const constraint = lengthConstraints[length]

  // ── 构建最终大纲 ──
  const plan = {
    strategy,
    intent,
    topic: topic || '',
    complexity,
    hook: hook ? hook.hookText : null,
    shockLevel: hook ? hook.shock : 0,
    sections: sections.slice(0, constraint.maxSections),
    ending: structure.hasShockEnding
      ? `认知暴击：请用一句不超过30字的话总结核心规律。风格：犀利、不鸡汤、小事哥式。`
      : null,
    length,
    maxChars: sections.slice(0, constraint.maxSections).reduce((s, sec) => s + constraint.maxCharsPerSection, 0),
    instruction: _buildPlanInstruction(strategy, sections, constraint),
  }

  return plan
}

/**
 * _buildPlanInstruction — 生成给 LLM 的大纲指令
 */
function _buildPlanInstruction(strategy, sections, constraint) {
  const secInstructions = sections
    .slice(0, constraint.maxSections)
    .map((s, i) => `\n【${s.tag}】（${constraint.maxCharsPerSection}字内）\n${s.guidance}`)
    .join('\n')

  return `请严格按以下结构和字数限制生成回答：\n${secInstructions}`
}

/**
 * planWithLLM — 预留 LLM 辅助生成接口
 * 当本地 Planner 不够时，调用 LLM 生成大纲
 */
async function planWithLLM(intent, strategy, topic, options = {}) {
  // 先用规则引擎生成基础大纲
  const plan = planResponse(intent, strategy, topic, options)

  // 如果提供了 LLM call 函数，用 LLM 优化
  if (typeof options.callLLM === 'function' && options.complexity >= 7) {
    try {
      const llmPlan = await options.callLLM(plan.instruction, topic)
      if (llmPlan) Object.assign(plan, { llmEnhanced: true, ...llmPlan })
    } catch (_) {}
  }

  return plan
}

module.exports = {
  planResponse,
  planWithLLM,
}
