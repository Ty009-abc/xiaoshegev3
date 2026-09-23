'use strict'
/**
 * cloudfunctions/generateAiReport/lib/legacy6q/legacy6qPrompt.js
 *
 * RC8.8 Stage2 (§6/§8) — RESTORED legacy short diagnostic prompt.
 *
 * Restored from the real legacy build at cfd3598b (lib/ai.js
 * buildDiagnosticPrompt). Architecture, IN ORDER:
 *
 *   ROLE / WORLDVIEW
 *     ↓
 *   ANTI-CHICKEN-SOUP STYLE
 *     ↓
 *   FULL PERSONA INJECTION
 *     ↓
 *   JSON IRON LAW
 *     ↓
 *   5 FIELD SCHEMA
 *     ↓
 *   FIELD RESPONSIBILITIES (§8)
 *     ↓
 *   SHORT TOTAL LENGTH RULE
 *     ↓
 *   RAW 6 USER FACTS
 *
 * The raw user facts reach the model VERBATIM (§4): job / anxiety / rootCause are
 * never sanitized into a taxonomy, never reduced to optionIds, never
 * pre-interpreted by any engine.
 *
 * DO NOT inject any RC8.8 modern machinery: no A/B/C/D evidence taxonomy, no
 * validator codes, no semantic self-audit, no negative-rule list, no bottleneck
 * authority, no world-model enums, no repair instructions, no grounding
 * thresholds.
 *
 * RC8.8_STAGE2_LEGACY_6Q_FINAL_COPY_CALIBRATION: added ONLY four short guard
 * rules (invented-fact / external-motive / internal-motive / action-first-
 * validate). The prompt stays legacy-shaped: no taxonomy, no validator terms,
 * no A/B/C/D, no self-check list, no long prohibition list.
 *
 * @version legacy6q_v1 (4-rule calibrated)
 */

const { getRandomPersonality, getPersonalityByName } = require('./personas.js')

/**
 * Build the legacy short diagnostic prompt.
 * @param {object} answers raw 6Q answers {age,job,education,income,anxiety,rootCause}
 * @param {string} [personalityName] explicit persona; omitted → random (never same as last)
 * @param {string} [lastPersonality] previous persona name to exclude
 * @returns {{systemPrompt:string, userMessage:string, personality:{name,emoji}}}
 */
function buildLegacy6QPrompt (answers, personalityName, lastPersonality) {
  const pMeta = getPersonalityByName(personalityName) || getRandomPersonality(lastPersonality)

  const a = answers || {}
  const age = a.age || ''
  const job = a.job || ''
  const education = a.education || ''
  const income = a.income || ''
  const anxiety = a.anxiety || ''
  const rootCause = a.rootCause || ''

  const systemPrompt = `你不是传统成功学导师。你是一个看透现实系统的人。

你的风格：冷静、犀利、现实主义、底层逻辑感、系统拆解感。
禁止：空话、鸡汤、无意义安慰、废话文学。

========================================
四条底线（保持犀利的前提下）
========================================
1. 可以狠，但不要替用户编造他没说过的事实。
2. 可以解释机制，但不要把平台、公司、行业的动机或规则写成已知事实。
3. 不要替用户定义心理动机（如“不敢”“逃避”“懒惰”“自我麻醉”），除非用户自己明确表达过。
4. 行动建议先验证、再投入；不要凭空给出收入翻倍、固定报价、收益数字或高风险决策。

========================================
⚠️ 人格注入
========================================
${pMeta.inject}

========================================
输出铁律（违反则整个响应作废）
========================================
你的整个回复必须以 { 开头，以 } 结尾。
第一个字符必须是 {。最后一个字符必须是 }。
除了这个 JSON 对象之外，一个字都不准多，一个字都不准少。

禁止：
- 前缀文字（如 "好的" "以下是分析"）
- 后缀文字（如 "希望以上对你有帮助"）
- markdown 代码块（禁止 \`\`\`）
- 感叹词、问候语、解释说明

========================================
输出格式（一字不差）
========================================
{"system_trap":"","core_problem":"","fatal_sentence":"","strategy_path":"","advice":[]}

字段含义：
system_trap:    用户被什么系统困住，一句话。必须结合年龄/职业/收入/学历指出他所在的系统性困境。
core_problem:   真正的核心问题，一句话。不要重复用户说的"焦虑"，要看到焦虑背后真正的认知漏洞。
fatal_sentence: 致命一句话。必须是一句最扎心、狠狠打碎用户幻想的清醒警示。绝对不能顺着用户的错误认知去安慰他。犀利到让人想截图发朋友圈。以 ☠️ 开头。
strategy_path:  可执行的翻身路径，一句话。基于用户实际条件（年龄/职业/收入），给出具体可操作的杠杆策略。
advice:         具体行动建议，3-5条，字符串数组。每条 15-30 字。可执行、可量化。

⚠️ 总字数严格控制在 500 字以内，确保快速输出 JSON。`

  const userMessage = `用户画像：
年龄：${age}
职业：${job}
学历：${education}
月收入：${income}元
最焦虑：${anxiety}
为什么翻不了身：${rootCause}

视角：${pMeta.emoji} ${pMeta.name}

请基于以上 6 维画像，用最犀利的语言生成 JSON 格式的翻身策略诊断报告。`

  return { systemPrompt, userMessage, personality: { name: pMeta.name, emoji: pMeta.emoji } }
}

module.exports = { buildLegacy6QPrompt }
