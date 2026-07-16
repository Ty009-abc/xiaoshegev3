/**
 * prompt-v4/aiOutputSchemaV4.js
 *
 * AI 输出 Schema — AI 只能输出可写字段，不允许返回完整 Contract。
 * 任何超范围的字段在 Parser 阶段会被拒绝。
 */

const AI_OUTPUT_SCHEMA = {
  headline: {
    title: { type: 'string', maxChars: 42, required: true },
    subtitle: { type: 'string', maxChars: 100, required: true },
  },
  fatalDiagnosis: {
    mainProblem: { type: 'string', maxChars: 100, required: true },
    reason: { type: 'string', maxChars: 200, required: true },
  },
  fatalRules: {
    type: 'array',
    maxItems: 3,
    each: {
      ruleId: { type: 'string', required: true, maxChars: 20 },
      title: { type: 'string', required: true, maxChars: 60 },
      description: { type: 'string', required: true, maxChars: 150 },
      why: { type: 'string', required: true, maxChars: 150 },
    },
  },
  advantageRules: {
    type: 'array',
    maxItems: 3,
    each: {
      ruleId: { type: 'string', required: true, maxChars: 20 },
      title: { type: 'string', required: true, maxChars: 60 },
      description: { type: 'string', required: true, maxChars: 150 },
      why: { type: 'string', required: true, maxChars: 150 },
    },
  },
  opportunityRules: {
    type: 'array',
    maxItems: 5,
    each: {
      area: { type: 'string', required: true, maxChars: 30 },
      description: { type: 'string', required: false, maxChars: 120 },
      why: { type: 'string', required: false, maxChars: 120 },
    },
  },
  wealthPathReasons: {
    type: 'object',
    properties: {
      working: { type: 'string', maxChars: 80 },
      sideBusiness: { type: 'string', maxChars: 80 },
      freelance: { type: 'string', maxChars: 80 },
      investment: { type: 'string', maxChars: 80 },
      content: { type: 'string', maxChars: 80 },
      ai: { type: 'string', maxChars: 80 },
      entrepreneur: { type: 'string', maxChars: 80 },
    },
  },
  actionPlan: {
    type: 'object',
    properties: {
      day1: { type: 'object', properties: { goal: { maxChars: 60 }, tasks: { type: 'array', maxItems: 5 }, checkpoint: { maxChars: 40 } } },
      day3: { type: 'object', properties: { goal: { maxChars: 60 }, tasks: { type: 'array', maxItems: 5 }, checkpoint: { maxChars: 40 } } },
      day7: { type: 'object', properties: { goal: { maxChars: 60 }, tasks: { type: 'array', maxItems: 5 }, checkpoint: { maxChars: 40 } } },
      day15: { type: 'object', properties: { goal: { maxChars: 60 }, tasks: { type: 'array', maxItems: 5 }, checkpoint: { maxChars: 40 } } },
      day30: { type: 'object', properties: { goal: { maxChars: 60 }, tasks: { type: 'array', maxItems: 5 }, checkpoint: { maxChars: 40 } } },
    },
  },
  stopDoingItems: {
    type: 'array',
    maxItems: 10,
    each: { type: 'string', maxChars: 40 },
  },
  identityUpgrade: {
    type: 'object',
    properties: {
      currentIdentity: { type: 'string', maxChars: 20 },
      targetIdentity: { type: 'string', maxChars: 20 },
      gap: { type: 'string', maxChars: 100 },
      upgradePath: { type: 'string', maxChars: 80 },
    },
  },
  finalStrike: {
    type: 'object',
    properties: {
      sentence: { type: 'string', maxChars: 50, required: true },
      shareTitle: { type: 'string', maxChars: 20, required: true },
    },
  },
}

/**
 * 返回 AI 输出允许的顶层字段名
 */
function getWritableTopLevelKeys() {
  return Object.keys(AI_OUTPUT_SCHEMA)
}

/**
 * 获取某个字段的 maxChars 限制
 */
function getMaxChars(path) {
  const parts = path.split('.')
  let node = AI_OUTPUT_SCHEMA
  for (const p of parts) {
    if (!node) return null
    if (node.each) node = node.each
    else if (node.properties) node = node.properties[p]
    else node = node[p]
  }
  return node?.maxChars ?? null
}

module.exports = { AI_OUTPUT_SCHEMA, getWritableTopLevelKeys, getMaxChars }
