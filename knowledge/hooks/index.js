/**
 * knowledge/hooks/index.js — Hook 模板库
 *
 * 四册 Part 5：回答策略 · Hook Engine
 *
 * 小事哥的核心差异化：开头杀伤力
 */

const HOOKS = {
  // ═══ 反常识型 — "你以为……其实……" ═══
  counter_intuitive: [
    { template: '你以为{{topic}}是因为{{falseReason}}。\n其实{{trueReason}}。', vars: ['topic', 'falseReason', 'trueReason'], shock: 9 },
    { template: '多数人以为{{fallacy}}。\n这是{{realMechanism}}给你的错觉。', vars: ['fallacy', 'realMechanism'], shock: 8 },
    { template: '如果{{topic}}有说明书，第一条写的肯定不是你现在想的。', vars: ['topic'], shock: 7 },
    { template: '我赌你从来没这样想过{{topic}}。', vars: ['topic'], shock: 6 },
    { template: '关于{{topic}}，99%的人的第一反应都是错的。', vars: ['topic'], shock: 7 },
    { template: '{{topic}}这件事，你看到的只是水面上的1%。\n水面下的99%才是决定性的。', vars: ['topic'], shock: 8 },
    { template: '你以为{{behavior}}，其实你是在{{realBehavior}}。', vars: ['behavior', 'realBehavior'], shock: 9 },
  ],

  // ═══ 打脸型 — "多数人输在……" ═══
  face_slap: [
    { template: '你的问题不是{{apparentProblem}}。\n真正的问题是{{realProblem}}。', vars: ['apparentProblem', 'realProblem'], shock: 8 },
    { template: '说句难听的：{{hardTruth}}。', vars: ['hardTruth'], shock: 10 },
    { template: '你缺的不是{{thing}}，缺的是{{capacity}}。', vars: ['thing', 'capacity'], shock: 8 },
    { template: '这件事上，大多数人的努力方向本身就是错的。', shock: 7 },
    { template: '你花了{{time}}研究{{topic}}，但你从来没问过自己一个问题：{{question}}。', vars: ['time', 'topic', 'question'], shock: 9 },
    { template: '{{group}}不是没有机会，是{{reason}}。', vars: ['group', 'reason'], shock: 7 },
    { template: '你不是不够努力，你是努力在了错误的系统里。', shock: 8 },
  ],

  // ═══ 赌场型 — "这和赌场没有本质区别" ═══
  casino: [
    { template: '这和赌场没有本质区别——只是庄家换了一个名字。', shock: 10 },
    { template: '{{thing}}的设计逻辑，和老虎机的赔率机制一模一样。', vars: ['thing'], shock: 9 },
    { template: '你在{{situation}}里做的每个决定，跟赌徒在赌桌上做的决定，用的是同一套心理机制。', vars: ['situation'], shock: 9 },
    { template: '{{system}}的规则设计者，不需要你输。\n他只需要你一直玩下去。', vars: ['system'], shock: 10 },
    { template: '庄家的优势不在于运气，而在于规则永远站在他那一边。\n{{topic}}也一样。', vars: ['topic'], shock: 8 },
    { template: '你以为你在决策。\n其实系统已经帮你设计好了"最优选择"——只是那个最优选择从来不是对你最优。', shock: 9 },
  ],
}

/**
 * selectHook(topic, type = 'counter_intuitive', context = {})
 * 选择钩子模板
 *
 * @param {string} topic   - 用户问题主题
 * @param {string} type    - counter_intuitive | face_slap | casino
 * @param {object} context - optional vars to inject
 * @returns {{ hookText, template, shock }} 渲染后的钩子文本
 */
function selectHook(topic, type = 'counter_intuitive', context = {}) {
  const pool = HOOKS[type] || HOOKS.counter_intuitive

  // 随机选一个（后续可升级为语义匹配）
  const idx = Math.floor(Math.random() * pool.length)
  const tpl = pool[idx]

  // 注入变量
  let hookText = tpl.template
    .replace(/\{\{topic\}\}/g, context.topic || topic || '这个问题')
    .replace(/\{\{falseReason\}\}/g, context.falseReason || '不够努力')
    .replace(/\{\{trueReason\}\}/g, context.trueReason || '你没有进入正确的系统')
    .replace(/\{\{fallacy\}\}/g, context.fallacy || '努力就能成功')
    .replace(/\{\{realMechanism\}\}/g, context.realMechanism || '系统')
    .replace(/\{\{behavior\}\}/g, context.behavior || '在投资')
    .replace(/\{\{realBehavior\}\}/g, context.realBehavior || '在给情绪买单')
    .replace(/\{\{apparentProblem\}\}/g, context.apparentProblem || '赚不到钱')
    .replace(/\{\{realProblem\}\}/g, context.realProblem || '你一直在卖时间')
    .replace(/\{\{hardTruth\}\}/g, context.hardTruth || '你缺的不是机会，是承担机会成本的能力')
    .replace(/\{\{thing\}\}/g, context.thing || '这个系统')
    .replace(/\{\{capacity\}\}/g, context.capacity || '承担风险的能力')
    .replace(/\{\{time\}\}/g, context.time || '很长时间')
    .replace(/\{\{question\}\}/g, context.question || '这真的是我想做的吗')
    .replace(/\{\{group\}\}/g, context.group || '普通人')
    .replace(/\{\{reason\}\}/g, context.reason || '他们一直在用错误的世界模型做决策')
    .replace(/\{\{situation\}\}/g, context.situation || '当前处境')
    .replace(/\{\{system\}\}/g, context.system || '这个系统')

  return { hookText, templateId: type + '_' + idx, shock: tpl.shock || 7 }
}

/**
 * selectHookByStrategy(strategy, topic, context)
 * 根据回答策略自动选择合适的 Hook 类型
 */
function selectHookByStrategy(strategy, topic, context = {}) {
  const typeMap = {
    layered: 'counter_intuitive',
    cognitive_shock: 'face_slap',
    hard_truth: 'face_slap',
    direct: null, // direct 不需要 hook
    coaching: null, // coaching 不需要 hook
    strategic_planning: 'counter_intuitive',
  }

  const type = typeMap[strategy]
  if (!type) return null

  return selectHook(topic, type, context)
}

/**
 * listAllHooks() — 列出所有钩子
 */
function listAllHooks() {
  const result = {}
  for (const [type, pool] of Object.entries(HOOKS)) {
    result[type] = pool.map((h, i) => ({ id: `${type}_${i}`, template: h.template, shock: h.shock, vars: h.vars || [] }))
  }
  return result
}

module.exports = { HOOKS, selectHook, selectHookByStrategy, listAllHooks }
