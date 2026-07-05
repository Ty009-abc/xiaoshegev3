/**
 * knowledge/prompts/report/REPORT_V1.js
 *
 * AI 深度翻身报告 Prompt — 支持变量注入
 * Version: v1
 *
 * 注入变量：
 *   {{laborMindset}} / {{probabilityMindset}} / {{systemThinking}}
 *   {{leverageThinking}} / {{capitalThinking}} / {{riskAwareness}}
 *   {{informationSensitivity}} / {{longTermism}} / {{decisionStability}}
 *   {{tags}}
 */
module.exports = {
  name: 'REPORT_V1',
  version: 'v1',
  description: 'AI 深度翻身报告 — 世界模型诊断',
  variables: [
    'laborMindset', 'probabilityMindset', 'systemThinking',
    'leverageThinking', 'capitalThinking', 'riskAwareness',
    'informationSensitivity', 'longTermism', 'decisionStability',
    'tags'
  ],
  
  prompt: `{{SYSTEM_CORE}}

场景：生成《世界模型诊断报告》

用户的认知维度数据：
- 劳动思维：{{laborMindset}}
- 概率思维：{{probabilityMindset}}
- 系统思维：{{systemThinking}}
- 杠杆思维：{{leverageThinking}}
- 资本思维：{{capitalThinking}}
- 风险认知：{{riskAwareness}}
- 信息敏感度：{{informationSensitivity}}
- 长期主义：{{longTermism}}
- 决策稳定性：{{decisionStability}}

用户标签：{{tags}}

请严格输出以下 JSON 结构（不要输出 markdown 代码块标记）：

{
  "summary": "一句话诊断（20字以内）",
  "type": "世界模型类型（如：战略型翻身者、努力陷阱型、高风险冲动型、机会捕手型、系统思维型、普通觉醒型）",
  "whyNotRich": "为什么还没有翻身（80字以内，犀利但不羞辱）",
  "biggestCognitiveGap": "最大认知漏洞（50字以内）",
  "turnaroundProbability": 35,
  "threeYearRisk": "未来3年最大风险（60字以内）",
  "bestPath": "最适合你的翻身路径（80字以内）",
  "thirtyDayActions": ["行动1","行动2","行动3","行动4","行动5"],
  "finalStrike": "最后一击认知暴击（30字以内，让人想截图保存的那种）"
}

输出规则：
- turnaroundProbability 必须是整数 0-100
- thirtyDayActions 必须是 5 条具体的、本周就能做的事
- finalStrike 要有冲击力，让人想截图保存的那种
- 所有字段必须返回，不能留空`
}
