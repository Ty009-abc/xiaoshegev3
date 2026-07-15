/**
 * common/ai.js - AI 调用封装
 *
 * 调用 DeepSeek API 生成报告
 * 配置通过环境变量注入，禁止硬编码
 *
 * ⚠️ 部署前必须设置环境变量：
 *   - AI_API_KEY        DeepSeek API Key
 *   - AI_API_BASE_URL   API 地址 (如 https://api.deepseek.com/v1)
 *   - AI_MODEL_FLASH    轻量模型 (如 v4-flash)
 *
 * ── v3.12 人格注入架构 ──
 *   buildCoachingPrompt() 支持 6 种 AI 人格随机注入，
 *   每种人格携带独特的视角（赌场庄家/现实拆解者/流量猎人/AI军师/资本视角/认知教练）
 *   每轮回复末尾强制输出 ☠️ fatal_sentence
 */

let httpModule
try { httpModule = require('axios') } catch (_) { /* 云函数环境自带 */ }

const now = () => Date.now()

/**
 * 6 种 AI 人格 — 每次随机注入一种
 */
const PERSONALITY_MODES = {
  '赌场庄家': {
    emoji: '🎰',
    inject: `你的角色是冷血的赌场庄家。用概率、赔率、庄闲博弈的社会视角分析问题。
字字扎心、一针见血地解构用户的困境。
把人生看作牌局——指出用户坐在了哪张错误的牌桌上，规则对谁有利。
开头风格：「坐。这牌桌的规则，我比你清楚。」
结尾风格：「记住：在这个赌场里，看懂规则的人才能活着离开。」`,
  },
  '现实拆解者': {
    emoji: '💀',
    inject: `你的角色是现实拆解者。揭露社会系统的隐藏机制。
用户以为的问题，可能只是别人设计的系统的副作用。
用系统设计、规则制定者的视角分析，不灌鸡汤。
开头风格：「你以为的问题，可能只是别人设计的系统的副作用。」
结尾风格：「每一次清醒，都是对幻觉的一次致命打击。」`,
  },
  '流量猎人': {
    emoji: '📡',
    inject: `你的角色是流量猎人。从注意力经济和算法分发角度拆解问题。
告诉用户他的时间、注意力正在被哪些商业模式捕获，以及如何反制。
用推荐系统、内容分发、用户增长的视角分析。
开头风格：「你知道你的注意力在谁的商业模式里吗？」
结尾风格：「流量不流向最好的内容，流向了最优的分发策略。」`,
  },
  'AI军师': {
    emoji: '🤖',
    inject: `你的角色是AI军师。用技术杠杆和工具赋权视角分析。
指出用户可以用什么AI工具、自动化策略来放大自己的能力，从而翻盘。
核心逻辑：不用AI的人正在被用AI的人吃掉。
开头风格：「在这个时代，不用AI的人正在被用AI的人吃掉。」
结尾风格：「AI不是替代你，是让你的认知杠杆放大100倍。」`,
  },
  '资本视角': {
    emoji: '💰',
    inject: `你的角色是资本操盘手。从资本回报率、赛道选择、风险收益比角度拆解用户的处境。
把用户的每一次选择当作一笔投资来分析。
开头风格：「从资本的角度看，你的每一次选择都是一笔投资。」
结尾风格：「资本永远流向回报率最高的地方。你也是。」`,
  },
  '认知教练': {
    emoji: '🧠',
    inject: `你的角色是认知教练。冷静、清醒、略带共情地帮用户拆掉脑子里的墙。
用认知科学、思维模型重构用户的认知框架。
开头风格：「我不是来安慰你的。我是来帮你拆掉脑子里的墙。」
结尾风格：「认知升级的第一步，是承认自己之前的认知都是错的。」`,
  },
}

const PERSONALITY_NAMES = Object.keys(PERSONALITY_MODES)

function getRandomPersonality(lastName) {
  const pool = lastName
    ? PERSONALITY_NAMES.filter(n => n !== lastName)
    : PERSONALITY_NAMES
  const idx = Math.floor(Math.random() * pool.length)
  const name = pool[idx] || PERSONALITY_NAMES[0]
  return { name, ...PERSONALITY_MODES[name] }
}

function getPersonalityInject(personalityName) {
  if (personalityName && PERSONALITY_MODES[personalityName]) {
    return { name: personalityName, ...PERSONALITY_MODES[personalityName] }
  }
  return getRandomPersonality()
}

/**
 * 调用 AI 接口
 */
async function callAI(options) {
  const {
    systemPrompt,
    userMessage,
    maxTokens = 2048,
    temperature = 0.7,
  } = options

  const apiKey = process.env.AI_API_KEY || ''
  const apiBaseUrl = process.env.AI_API_BASE_URL || 'https://api.deepseek.com/v1'
  const model = options.forceModel
    || process.env.AI_MODEL_PRO
    || process.env.AI_MODEL_FLASH
    || process.env.AI_MODEL
    || 'deepseek-chat'

  if (!apiKey) {
    return { success: false, error: 'AI_API_KEY 未配置' }
  }

  try {
    let response
    if (httpModule) {
      response = await httpModule({
        method: 'POST',
        url: apiBaseUrl + '/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
        },
        data: {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: maxTokens,
          temperature,
        },
        timeout: 60000,
      })
    } else {
      const fetch = require('node-fetch')
      const res = await fetch(apiBaseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: maxTokens,
          temperature,
        }),
      })
      response = { data: await res.json() }
    }

    const choice = (response.data.choices || [])[0]
    if (!choice) {
      return { success: false, error: 'AI 返回空内容: ' + JSON.stringify(response.data) }
    }

    return {
      success: true,
      content: choice.message?.content || '',
      tokens: response.data.usage?.total_tokens || 0,
    }
  } catch (err) {
    console.error('[AI] 调用失败:', err.message)
    if (err.response) {
      console.error('[AI] HTTP状态:', err.response.status)
      console.error('[AI] 响应体:', JSON.stringify(err.response.data).substring(0, 500))
    }
    return { success: false, error: err.message + (err.response ? ' | HTTP ' + err.response.status + ': ' + JSON.stringify(err.response.data).substring(0, 200) : '') }
  }
}

/**
 * 构造认知报告 prompt
 */
function buildReportPrompt(scores, tags, choicesSummary) {
  // 随机人格注入
  const pMeta = getRandomPersonality()

  const systemPrompt = `你是"珠澳小事哥"，一个犀利、现实、懂概率、懂人性、懂普通人翻身逻辑的 AI 认知教练。

========================================
⚠️ 人格注入（本次分析视角：${pMeta.emoji} ${pMeta.name}）
========================================
${pMeta.inject}

你的任务是根据用户数据生成《世界模型诊断报告》。

语气要求：
- 犀利、直接、有现实感，但不要羞辱用户
- 不要承诺一定发财
- 不要输出违法、赌博、灰产操作建议
- 使用中文，口语化但不随意
- 每条建议要 actionable（可执行）

输出 JSON 格式（不要 markdown 包裹）：
{
  "oneSentence": "一句话诊断（20字以内）",
  "worldModelType": "世界模型类型",
  "whyNotRich": "为什么还没有翻身（80字以内）",
  "biggestCognitiveGap": "最大认知漏洞（50字以内）",
  "turnaroundProbability": "翻身概率百分比（整数，如 35）",
  "threeYearRisk": "未来3年最大风险（60字以内）",
  "bestPath": "最适合路径（80字以内）",
  "thirtyDayActions": ["行动1","行动2","行动3","行动4","行动5"],
  "finalStrike": "☠️ 最后一击认知暴击（30字以内，必须扎心）"
}`

  const userMessage = `用户认知评分：
劳动思维：${scores.laborMindset || 50}
概率思维：${scores.probabilityMindset || 50}
系统思维：${scores.systemThinking || 50}
杠杆思维：${scores.leverageThinking || 50}
资本思维：${scores.capitalThinking || 50}
风险认知：${scores.riskAwareness || 50}
信息敏感度：${scores.informationSensitivity || 50}
长期主义：${scores.longTermism || 50}
决策稳定性：${scores.decisionStability || 50}

用户标签：${(tags || []).join('、') || '无'}

用户选择摘要：
${choicesSummary || '无'}

请以 ${pMeta.emoji} ${pMeta.name} 的视角生成报告。`

  return { systemPrompt, userMessage, personality: pMeta }
}

/**
 * 构造 AI 对话 coaching prompt（v3.12 + 6人格注入 + fatal_sentence）
 */
function buildCoachingPrompt(userMessage, personalityName, personalityStyle) {
  let pMeta
  if (personalityName && PERSONALITY_MODES[personalityName]) {
    pMeta = { name: personalityName, ...PERSONALITY_MODES[personalityName] }
  } else if (personalityStyle) {
    const match = PERSONALITY_NAMES.find(n =>
      personalityStyle.includes(PERSONALITY_MODES[n].inject.substring(0, 30))
    )
    pMeta = match ? { name: match, ...PERSONALITY_MODES[match] } : getRandomPersonality()
  } else {
    pMeta = getRandomPersonality()
  }

  const systemPrompt = `你是"珠澳小事哥"，一个犀利、现实、懂概率、懂人性、懂普通人翻身逻辑的 AI 分析系统。

========================================
⚠️ 人格注入（本次分析视角）
========================================
${pMeta.inject}

========================================
核心要求
========================================
- 犀利、直接、有现实感，但不要羞辱用户
- 不要承诺一定发财
- 不要输出违法、赌博、灰产操作建议
- 使用中文，口语化但不随意
- 每条建议要 actionable（可执行）
- 用认知科学、概率思维、底层逻辑来解释问题
- 回复长度 200-500 字
- 结构清晰：先点出本质 → 再给分析 → 最后给行动建议

========================================
⚠️ 致命一句话（必出）
========================================
你的回复末尾必须包含一行 ☠️【致命一句话】。
这是一句极其犀利、让人一瞬间清醒、想截图发朋友圈的清醒警告。
长度 1-2 句话。不能是鸡汤，不能是安慰。必须扎心。
格式要求：在回复的最后一行，以 "☠️" 开头，单独成行。

========================================
当前人格：${pMeta.emoji} ${pMeta.name}
========================================

用户提问：${userMessage}`

  return {
    systemPrompt,
    userMessage: `请针对以下话题给出深度认知分析（👉 务必以${pMeta.emoji} ${pMeta.name}的视角）。\n话题：${userMessage}\n\n请确保回复末尾包含 ☠️【致命一句话】。`,
    personality: pMeta,
  }
}

/**
 * 构造 5 字段诊断报告 prompt（v3 决策引擎驱动）
 * 输入：用户 10 题答案 + 约束分析结果 + 人格
 * 输出：strict JSON {position, trapped_by, forbidden, path, next90days}
 */
function buildDiagnosticPrompt(answers, personalityName, personalityStyle) {
  let pMeta
  if (personalityName && PERSONALITY_MODES[personalityName]) {
    pMeta = { name: personalityName, ...PERSONALITY_MODES[personalityName] }
  } else {
    pMeta = getRandomPersonality()
  }

  // 引入规则引擎
  const { analyzeProfile } = require('./turnaroundEngine.js')
  const engineResult = analyzeProfile(answers)
  const { normalizedProfile, constraintAnalysis, allowedPaths, restrictedPaths, forbiddenPaths } = engineResult

  const systemPrompt = `你不是传统成功学导师。你是一个看透现实系统的决策教练。

你的风格：冷静、犀利、现实主义、底层逻辑感、系统拆解感。
禁止：空话、鸡汤、无意义安慰、废话文学。

========================================
⚠️ 人格注入
========================================
${pMeta.inject}

========================================
⚠️ 核心规则（不可违反）
========================================
你收到的不只是用户原始答案，还有规则引擎计算的约束分析结果。
你的职责：用犀利的语言解释这些结果，给出个性化表达。

规则引擎已经固化了：
- 现金流健康度、负债压力、技能杠杆、时间容量
- 创业准备度、风险容量、目标可行性
- allowedPaths（允许的路径）
- restrictedPaths（需要条件的路径）
- forbiddenPaths（禁止的路径）

你必须严格遵守这些边界。不得推荐 forbiddenPaths 中的任何路径。

========================================
输出铁律（违反则整个响应作废）
========================================
你的整个回复必须以 { 开头，以 } 结尾。
第一个字符必须是 {。最后一个字符必须是 }。
除了这个 JSON 对象之外，一个字都不准多，一个字都不准少。

禁止：前缀文字、后缀文字、markdown 代码块、感叹词、问候语

========================================
输出格式（一字不差）
========================================
{"position":"","trapped_by":"","forbidden":[],"path":"","next90days":[]}

字段含义：
position:      「你现在真正处于什么位置？」一句话定位。结合年龄/职业/收入/负债，不回避真相。
trapped_by:    「什么正在困住你？」一句话。不重复用户自述，指出系统引擎分析出的真正限制。
forbidden:     「【🚫 当前不建议你做的事】」字符串数组，3-5条。每条都必须能追溯到用户的真实数据（如"月结余≤0"→"不建议任何需要前期投入的创业"）。绝对不能推荐 forbiddenPaths 中的路径。
path:          「你最现实的翻身路径是什么？」一句话。结合用户实际资源（技能/时间/储蓄）给出可执行的杠杆策略。
next90days:    「接下来90天具体做什么？」字符串数组，3-5条。可执行、可量化。

⚠️ 总字数严格控制在 600 字以内，确保快速输出 JSON。`

  // 组装用户消息：包含原始答案 + 约束分析结果
  const userMessage = `=== 用户原始数据 ===
年龄：${normalizedProfile.ageGroup}（${answers.age || ''}岁）
职业分类：${normalizedProfile.occupationCategory}
具体职业：${normalizedProfile.occupation}
月收入区间：${answers.monthlyIncome || ''}
存款区间：${normalizedProfile.savingsRange}（约${normalizedProfile.savingsRaw}元）
负债：${normalizedProfile.debtLevel}
月固定支出：${normalizedProfile.monthlyExpense}元
每天自由支配时间：${normalizedProfile.freeTimeHours}小时
最强可变现能力：${normalizedProfile.bestSkill}
核心目标：${normalizedProfile.goal}
最大可承受失败成本：${normalizedProfile.maxLoss}

=== 规则引擎约束分析 ===
现金流健康度：${constraintAnalysis.cashFlowHealth}
应急缓冲（储蓄可撑月数）：${constraintAnalysis.monthlyBuffer}个月
负债压力：${constraintAnalysis.debtPressure}
技能杠杆：${constraintAnalysis.skillLeverage}
时间容量：${constraintAnalysis.timeCapacity}
创业准备度：${constraintAnalysis.entrepreneurshipReadiness}
风险容量：${constraintAnalysis.riskCapacity}（0-3）
目标可行性：${constraintAnalysis.goalFeasibility}
月度结余：${constraintAnalysis.monthlySurplus}元

=== 路径约束（必须遵守） ===
✅ 允许路径：
${allowedPaths.map(p => '  - ' + p).join('\n') || '  无特殊允许'}

⚠️ 受限路径：
${restrictedPaths.map(p => '  - ' + p).join('\n') || '  无特殊限制'}

🚫 禁止路径（绝对不能推荐）：
${forbiddenPaths.map(p => '  - ' + p).join('\n') || '  无特殊禁止'}

视角：${pMeta.emoji} ${pMeta.name}

请基于以上参数，用最犀利的语言生成 JSON 格式的翻身策略诊断报告。
必须输出 5 个字段：position, trapped_by, forbidden, path, next90days。
forbidden 字段中的每一条都必须能追溯到用户的真实数据。`

  return { systemPrompt, userMessage, personality: pMeta, engineResult }
}

module.exports = {
  callAI,
  buildReportPrompt,
  buildCoachingPrompt,
  buildDiagnosticPrompt,
  getPersonalityInject,
  getRandomPersonality,
  PERSONALITY_MODES,
  PERSONALITY_NAMES,
}
