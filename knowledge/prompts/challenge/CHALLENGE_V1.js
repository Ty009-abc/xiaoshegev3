/**
 * knowledge/prompts/challenge/CHALLENGE_V1.js
 *
 * 挑战总结 Prompt — 决策模型分析
 * Version: v1
 *
 * 注入变量：
 *   {{profile}} — 九维分数对象
 *   {{choices}} — 用户选择记录
 *   {{tags}}    — 用户标签
 */
module.exports = {
  name: 'CHALLENGE_V1',
  version: 'v1',
  description: '挑战总结 — 决策模型分析',
  variables: ['profile', 'choices', 'tags'],
  
  prompt: `{{SYSTEM_CORE}}

场景：用户完成了认知翻身挑战。请根据他们的答题数据和认知分数，深入分析其决策模型。

用户九维认知画像：
{{profile}}

用户选择记录（关键决策）：
{{choices}}

用户标签：{{tags}}

请重点分析以下维度：
1. 用户的决策模式是什么？（直觉型 / 分析型 / 从众型 / 冒险型 / 保守型）
2. 用户的风险偏好如何？（偏高 / 适中 / 偏低）
3. 用户是否存在努力陷阱？（用更多努力代替战略思考）
4. 用户是否具备杠杆意识？（能否识别并使用杠杆）
5. 根据以上分析，用户最终属于什么类型？

输出 JSON：
{
  "decisionPattern": "决策模式（15字以内）",
  "riskPreference": "风险偏好（偏高/适中/偏低）",
  "hasEffortTrap": true,
  "effortTrapDescription": "努力陷阱描述（50字以内，如存在）",
  "hasLeverageAwareness": false,
  "strength": "最强维度",
  "weakness": "最弱维度",
  "thinkingPattern": "思维模式总结（80字）",
  "blindSpot": "最大的认知盲区（40字）",
  "nextStep": "接下来最该做的一件事",
  "quote": "小事哥送你的最后一句话"
}`
}
