/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * lib/scoring.js — 九维评分归一化引擎
 *
 * 核心: rawScores（不钳位累积）→ normalizedScores（基于理论区间映射到 0-100）
 */

const DIMS = [
  'laborMindset', 'probabilityMindset', 'systemThinking',
  'leverageThinking', 'capitalThinking', 'riskAwareness',
  'informationSensitivity', 'longTermism', 'decisionStability',
];

/** 30题题库理论极值（基于 challenge_events.js 静态计算） */
const THEORETICAL_BOUNDS = {
  laborMindset:        { min:  -2, max:  55 },
  probabilityMindset:  { min: -22, max:  39 },
  systemThinking:      { min:  -5, max: 148 },
  leverageThinking:    { min: -37, max: 106 },
  capitalThinking:     { min: -26, max:  58 },
  riskAwareness:       { min: -77, max:  44 },
  informationSensitivity: { min: -11, max:  72 },
  longTermism:         { min: -16, max:  84 },
  decisionStability:   { min: -12, max:  75 },
};

const SCORING_VERSION = 'normalized_v2';

/**
 * 从 rawScores 计算 normalized scores (0-100)
 * @param {Object} rawScores - { dim: number } 未钳位的累积值
 * @returns {Object} - { dim: 0-100 }
 */
function normalizeScores(rawScores) {
  const normalized = {};
  for (const dim of DIMS) {
    const raw = rawScores[dim] !== undefined ? rawScores[dim] : 0;
    const bounds = THEORETICAL_BOUNDS[dim];
    if (!bounds || bounds.max === bounds.min) {
      normalized[dim] = 50;
    } else {
      const rawNorm = ((raw - bounds.min) / (bounds.max - bounds.min)) * 100;
      normalized[dim] = Math.max(0, Math.min(100, Math.round(rawNorm)));
    }
  }
  return normalized;
}

/**
 * 初始化 rawScores（全 0）
 */
function initRawScores() {
  const raw = {};
  DIMS.forEach(d => raw[d] = 0);
  return raw;
}

/**
 * 累加单个 choice 的 effects 到 rawScores
 */
function accumulateRawScores(existingRaw, effects) {
  const raw = { ...(existingRaw || initRawScores()) };
  if (effects) {
    for (const dim of DIMS) {
      if (effects[dim] !== undefined) {
        raw[dim] = (raw[dim] || 0) + (effects[dim] || 0);
      }
    }
  }
  return raw;
}

/**
 * 初始化旧记录 scores 兼容：返回 { rawScores: null, scores: legacyScores, scoringVersion: 'legacy_v1' }
 */
function detectScoringVersion(record) {
  if (record && record.rawScores && record.scoringVersion === SCORING_VERSION) {
    return SCORING_VERSION;
  }
  return 'legacy_v1';
}

/**
 * 计算 finalType（基于 normalized scores）
 */
function calcFinalType(normalizedScores) {
  const s = normalizedScores;
  if ((s.leverageThinking || 0) > 75 && (s.probabilityMindset || 0) > 70) return 'strategic';
  if ((s.laborMindset || 0) > 75 && (s.leverageThinking || 0) < 40) return 'effort_trap';
  if ((s.riskAwareness || 0) < 35) return 'high_risk';
  if ((s.informationSensitivity || 0) > 75) return 'opportunity_hunter';
  if ((s.systemThinking || 0) > 75) return 'system_thinker';
  return 'normal_awakened';
}

/** 财富潜力指数（基于 normalized scores） */
function calcWealthPotential(normalizedScores) {
  const w = {
    capitalThinking: 0.20, leverageThinking: 0.18, systemThinking: 0.16,
    informationSensitivity: 0.12, probabilityMindset: 0.10,
    riskAwareness: 0.08, longTermism: 0.08, decisionStability: 0.05,
    laborMindset: 0.03,
  };
  let t = 0;
  for (const [k, v] of Object.entries(w)) {
    t += (normalizedScores[k] || 50) * v;
  }
  return Math.min(100, Math.max(0, Math.round(t)));
}

module.exports = {
  DIMS,
  THEORETICAL_BOUNDS,
  SCORING_VERSION,
  normalizeScores,
  initRawScores,
  accumulateRawScores,
  detectScoringVersion,
  calcFinalType,
  calcWealthPotential,
};
