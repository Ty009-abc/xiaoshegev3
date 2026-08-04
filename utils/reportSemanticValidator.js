/**
 * utils/reportSemanticValidator.js — v6.5.2
 *
 * Turnaround poster semantic quality validator.
 * Enforces G1-G8 quality gates on posterData.
 */

const FORBIDDEN_VERDICT_WORDS = [
  '值得关注', '财富盲区', '存在一定问题', '建议努力',
  '需要提升认知', '诊断完成', '你的财富系统已就绪',
]

const FORBIDDEN_DECISION_SLOGANS = [
  '拉开人与人差距', '建立系统是长期资产', '更努力', '更聪明',
  '认知改变行动', '今天的诊断', '财富系统体检', '财富系统诊断',
  '看看我的', '我的诊断', '我的财富', '你的人生才刚刚开始',
  '真正的翻身从今天开始', '你值得更好的未来', '最后一击',
]

const FORBIDDEN_STUBS = ['[object Object]', 'undefined', 'null', 'NaN']

/**
 * @param {Object} pd - posterData from mapDiagnosticV4ToPoster
 * @returns {{ ok: boolean, errors: string[], warnings: string[], scores: Object }}
 */
function validatePosterSemantics(pd) {
  const errors = []
  const warnings = []
  const scores = {}

  // ═══ G0: Verdict ≠ Decision (cross-card deduplication) ═══
  const verdictText = (pd.verdict || '').trim()
  const decisionTitle = ((pd.decision || {}).title || '').trim()
  const decisionReason = ((pd.decision || {}).reason || '').trim()
  if (verdictText && decisionTitle) {
    // 标准化后比较相似度
    const vLow = verdictText.replace(/[\s\u3000，。！？,.!?]/g, '')
    const dLow = (decisionTitle + decisionReason).replace(/[\s\u3000，。！？,.!?]/g, '')
    if (vLow === dLow || vLow.length > 10 && dLow.includes(vLow) || vLow.length > 10 && vLow.includes(dLow)) {
      errors.push('VERDICT_DECISION_DUPLICATE: verdict and decision contain identical content')
    }
  }

  // ═══ G1: Verdict ═══
  if (!pd.verdict || !pd.verdict.trim()) {
    errors.push('G1: verdict is empty')
  } else {
    const v = pd.verdict
    if (v.length > 40) warnings.push('G1: verdict exceeds 40 chars (' + v.length + ')')
    const hit = FORBIDDEN_VERDICT_WORDS.filter(w => v.includes(w))
    if (hit.length) warnings.push('G1: verdict contains forbidden word: ' + hit.join(','))
    scores.verdict = hit.length ? 0 : 1
  }

  // ═══ G2: Contradiction ═══
  const cc = pd.contradiction || {}
  if (!cc.title && !cc.description) {
    errors.push('G2: contradiction is empty')
  } else {
    const hasConflict = (cc.leftSide && cc.rightSide) ||
      (cc.title && cc.title.includes('×')) ||
      /但|然而|却|虽|强.*弱|高.*低/.test(cc.description || '')
    if (!hasConflict) warnings.push('G2: contradiction missing left/right conflict marker')
    scores.contradiction = hasConflict ? 1 : 0
  }

  // ═══ G3: Potential (score + level + advantages + constraints + recoveryDays) ═══
  const pt = pd.potential || {}
  if (typeof pt.score !== 'number' || pt.score < 0 || pt.score > 100) {
    errors.push('POTENTIAL_SCORE_REQUIRED: potential.score must be 0-100')
  } else {
    let g3pass = true
    // G3.1: level must be recognized
    if (!pt.level || pt.level === 'unknown') {
      errors.push('POTENTIAL_LEVEL_UNKNOWN_FORBIDDEN: potential.level cannot be unknown')
      g3pass = false
    }
    // G3.2: at least 1 advantage
    if (!pt.advantages || pt.advantages.length === 0) {
      errors.push('POTENTIAL_ADVANTAGE_REQUIRED: potential.advantages must have >= 1 item')
      g3pass = false
    }
    // G3.3: at least 1 constraint
    if (!pt.constraints || pt.constraints.length === 0) {
      errors.push('POTENTIAL_CONSTRAINT_REQUIRED: potential.constraints must have >= 1 item')
      g3pass = false
    }
    // G3.4: recovery days > 0
    if (!pt.estimatedRecoveryDays || pt.estimatedRecoveryDays <= 0) {
      errors.push('POTENTIAL_RECOVERY_DAYS_REQUIRED: potential.estimatedRecoveryDays must be > 0')
      g3pass = false
    }
    scores.potential = g3pass ? 1 : 0
  }

  // ═══ G4: Decision (must be actionable, not slogan) ═══
  const dc = pd.decision || {}
  // v6.5.3: COLLECT_MORE_EVIDENCE / provisional decisions are valid
  const isProvisional = dc.provisional === true || dc.code === 'COLLECT_MORE_EVIDENCE'
  if (!dc.code && !dc.title) {
    if (isProvisional) {
      // provisional decisions without code/title are still invalid
      errors.push('G4: provisional decision missing code and title')
    } else {
      warnings.push('G4: decision is empty (no structured decision available)')
    }
    scores.decision = isProvisional ? 1 : 0
  } else {
    const slogHit = FORBIDDEN_DECISION_SLOGANS.filter(w => (dc.title + dc.reason).includes(w))
    if (slogHit.length) {
      errors.push('G4: decision is a slogan, not actionable: ' + slogHit[0])
      scores.decision = 0
    } else {
      scores.decision = 1
    }
  }

  // ═══ G5: Action (must have time + standard) ═══
  const pa = pd.primaryAction || {}
  if (!pa.title) {
    errors.push('G5: primaryAction.title is empty')
  } else {
    let g5pass = true
    if (!pa.checkpoint) { warnings.push('G5: action missing checkpoint'); g5pass = false }
    if (!pa.successCriteria || pa.successCriteria.length === 0) { warnings.push('G5: action missing successCriteria'); g5pass = false }
    scores.action = g5pass ? 1 : 0
  }

  // ═══ G8: No template stubs ═══
  const allText = JSON.stringify(pd)
  const stubsHit = FORBIDDEN_STUBS.filter(t => allText.includes(t))
  if (stubsHit.length) errors.push('G8: template stubs found: ' + stubsHit.join(','))

  // ═══ Scores ═══
  scores.total = (scores.verdict || 0) + (scores.contradiction || 0) + (scores.potential || 0) + (scores.decision || 0) + (scores.action || 0)

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    scores,
  }
}

/**
 * Check similarity between two posterData objects
 * @returns {number} 0-1 similarity
 */
function posterSimilarity(pd1, pd2) {
  const text1 = (pd1.verdict || '') + ((pd1.contradiction || {}).description || '') + (pd1.emotionClosing || '')
  const text2 = (pd2.verdict || '') + ((pd2.contradiction || {}).description || '') + (pd2.emotionClosing || '')

  function jaccardSim(a, b) {
    const sa = new Set(a.replace(/\s/g, ''))
    const sb = new Set(b.replace(/\s/g, ''))
    const inter = new Set([...sa].filter(x => sb.has(x)))
    return inter.size / Math.max(sa.size, sb.size)
  }
  return jaccardSim(text1, text2)
}

/**
 * Check diversity across an array of posterData objects
 * @returns {{ ok: boolean, pairs: Array<{a:string,b:string,sim:number}> }}
 */
function checkDiversity(posters) {
  const pairs = []
  let fail = false
  for (let i = 0; i < posters.length; i++) {
    for (let j = i + 1; j < posters.length; j++) {
      const sim = posterSimilarity(posters[i], posters[j])
      if (sim > 0.75) fail = true
      if (sim > 0.5) {
        pairs.push({ a: posters[i].label || 'P' + i, b: posters[j].label || 'P' + j, sim })
      }
    }
  }
  return { ok: !fail, pairs }
}

module.exports = {
  validatePosterSemantics,
  posterSimilarity,
  checkDiversity,
  FORBIDDEN_VERDICT_WORDS,
  FORBIDDEN_DECISION_SLOGANS,
}
