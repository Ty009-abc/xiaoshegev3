/**
 * core/turnaround-os/schemas/identityProfileV6.js
 *
 * V6 统一用户翻身身份画像
 * 所有评分统一 0—100，缺失数据必须有默认值
 * 不允许 undefined/null 进入最终 Contract
 *
 * @version 6.0.0
 */

const { SCORE_RANGE } = require('../constants')

/**
 * 创建默认身份画像
 * @returns {Object} 默认 identityProfileV6
 */
function createDefault() {
  return {
    version: '6.0',

    identity: {
      occupationType: 'other',
      occupationLabel: '',
      industry: '',
      ageStage: '',
      cityTier: '',
      familyStage: '',
    },

    reality: {
      monthlyIncome: 0,
      monthlyExpense: 0,
      savings: 0,
      debt: 0,
      availableHoursPerWeek: 0,
      incomeStability: 0,
      safetyMonths: 0,
    },

    capabilities: {
      execution: 0,
      learning: 0,
      communication: 0,
      sales: 0,
      content: 0,
      aiAdaptability: 0,
      systemThinking: 0,
      discipline: 0,
    },

    psychology: {
      riskTolerance: 0,
      anxiety: 0,
      desire: 0,
      patience: 0,
      selfAwareness: 0,
      externalAttribution: 0,
    },

    assets: {
      skills: [],
      experiences: [],
      resources: [],
      audience: [],
      credentials: [],
      reusableAssets: [],
    },

    constraints: {
      familyPressure: [],
      cashflowPressure: [],
      timePressure: [],
      healthPressure: [],
      geographicPressure: [],
      psychologicalPressure: [],
    },

    currentGame: {
      gameType: '',
      incomeModel: '',
      dependenceType: '',
      biggestTrap: '',
      wrongBelief: '',
      structuralProblem: '',
    },

    potential: {
      strongestAdvantage: '',
      mostUndervaluedAsset: '',
      bestLeverageType: '',
      primaryOpportunity: '',
      secondaryOpportunity: '',
    },

    evidence: {
      sourceAnswers: [],
      ruleHits: [],
      confidence: 0,
    },
  }
}

/**
 * 清洗并规范化 identity profile
 * - 清除 null/undefined 替换为默认值
 * - 保证所有数值在 [0, 100] 范围内
 * - 保证字符串数组不为 null
 *
 * @param {Object} raw - 原始输入
 * @returns {Object} 清洗后的 identityProfileV6
 */
function normalize(raw) {
  if (!raw || typeof raw !== 'object') {
    return createDefault()
  }

  const def = createDefault()
  const result = {}

  // identity
  result.identity = mergeSection(def.identity, raw.identity || {})

  // reality — 数值清洗
  result.reality = {}
  const rawReality = raw.reality || {}
  for (const key of Object.keys(def.reality)) {
    const val = rawReality[key]
    result.reality[key] = clampNumber(val, def.reality[key], SCORE_RANGE.MIN, SCORE_RANGE.MAX)
  }

  // capabilities — 0-100
  result.capabilities = {}
  const rawCaps = raw.capabilities || {}
  for (const key of Object.keys(def.capabilities)) {
    const val = rawCaps[key]
    result.capabilities[key] = clampNumber(val, def.capabilities[key], SCORE_RANGE.MIN, SCORE_RANGE.MAX)
  }

  // psychology — 0-100
  result.psychology = {}
  const rawPsych = raw.psychology || {}
  for (const key of Object.keys(def.psychology)) {
    const val = rawPsych[key]
    result.psychology[key] = clampNumber(val, def.psychology[key], SCORE_RANGE.MIN, SCORE_RANGE.MAX)
  }

  // assets — 字符串数组清洗
  const rawAssets = raw.assets || {}
  result.assets = {}
  for (const key of Object.keys(def.assets)) {
    result.assets[key] = normalizeStringArray(rawAssets[key], def.assets[key])
  }

  // constraints — 字符串数组清洗
  const rawConstraints = raw.constraints || {}
  result.constraints = {}
  for (const key of Object.keys(def.constraints)) {
    result.constraints[key] = normalizeStringArray(rawConstraints[key], def.constraints[key])
  }

  // currentGame
  result.currentGame = mergeSection(def.currentGame, raw.currentGame || {})

  // potential
  result.potential = mergeSection(def.potential, raw.potential || {})

  // evidence
  result.evidence = {
    sourceAnswers: normalizeStringArray(
      (raw.evidence && raw.evidence.sourceAnswers) || [],
      []
    ),
    ruleHits: normalizeStringArray(
      (raw.evidence && raw.evidence.ruleHits) || [],
      []
    ),
    confidence: clampNumber(
      (raw.evidence && raw.evidence.confidence) || 0,
      0,
      SCORE_RANGE.MIN,
      SCORE_RANGE.MAX
    ),
  }

  result.version = '6.0'
  return result
}

/**
 * 合并 section（字符串字段清洗）
 */
function mergeSection(defSection, rawSection) {
  const result = {}
  for (const key of Object.keys(defSection)) {
    const val = rawSection[key]
    if (val === undefined || val === null) {
      result[key] = defSection[key]
    } else if (typeof defSection[key] === 'string') {
      result[key] = String(val)
    } else if (typeof defSection[key] === 'number') {
      result[key] = clampNumber(val, defSection[key], SCORE_RANGE.MIN, SCORE_RANGE.MAX)
    } else {
      result[key] = val
    }
  }
  return result
}

/**
 * 数组清洗：null → []，过滤非字符串元素
 */
function normalizeStringArray(arr, defaultValue) {
  if (!Array.isArray(arr)) {
    return Array.isArray(defaultValue) ? [...defaultValue] : []
  }
  return arr
    .filter(item => item !== null && item !== undefined)
    .map(item => String(item))
}

/**
 * 数值清洗：NaN/null/undefined → defaultValue
 */
function clampNumber(val, defaultValue, min, max) {
  if (val === undefined || val === null || (typeof val === 'number' && isNaN(val))) {
    return defaultValue
  }
  const num = Number(val)
  if (isNaN(num)) return defaultValue
  return Math.max(min, Math.min(max, Math.round(num)))
}

module.exports = {
  createDefault,
  normalize,
}
