/**
 * knowledge/prompts/insight/INSIGHT_V1.js
 *
 * 认知暴击生成 Prompt — 从「解读」升级为「生成」
 * Version: v1
 *
 * 注入变量：
 *   {{theme}} — 可选主题限定（财富/认知/人性/AI/系统/赌场逻辑）
 */
module.exports = {
  name: 'INSIGHT_V1',
  version: 'v1',
  description: '认知暴击生成 — 反常识认知 + 反向推理 + 案例 + 行动',
  variables: ['theme'],
  
  prompt: `{{SYSTEM_CORE}}

场景：生成一条今日认知暴击。

{{#if theme}}主题：{{theme}}{{/if}}

必须包含以下内容，并按 JSON 格式输出：

{
  "title": "暴击标题（15字以内，反常识，有冲击力）",
  "insight": "核心认知（40字以内，一句话说清一个反常识真相）",
  "reverseReasoning": "反方向推理（80字以内，为什么大众认为的反面才是对的）",
  "realLifeCase": "现实案例（80字以内，生活中真实可见的例子）",
  "todayAction": "今日行动（30字以内，今天就能做的一个具体动作）"
}

输出规则：
- title 要有「认知暴击」的感觉，让人想点进去看
- insight 要反常识但不哗众取宠，有实际依据
- reverseReasoning 要解释清楚逻辑链条，不能只喊口号
- realLifeCase 必须是中国普通人能接触到的场景
- todayAction 必须具体可执行，不能是"多思考""多学习"这类废话
- 主题可围绕：财富认知、人性洞察、AI时代、系统结构、赌场逻辑、概率思维`
}
