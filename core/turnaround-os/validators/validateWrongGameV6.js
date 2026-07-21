/**
 * core/turnaround-os/validators/validateWrongGameV6.js
 *
 * V6 错误游戏结果校验器
 */

const { WRONG_GAMES } = require('../constants')

function validateWrongGameV6(result) {
  const errors = []
  const warnings = []

  if (!result || typeof result !== 'object') {
    errors.push('结果为空')
    return { valid: false, errors, warnings }
  }

  // primaryWrongGame
  if (!result.primaryWrongGame) {
    errors.push('缺少 primaryWrongGame')
    return { valid: false, errors, warnings }
  }

  const primary = result.primaryWrongGame

  // 必须字段
  if (!primary.gameType) errors.push('primaryWrongGame.gameType 为空')
  if (!primary.gameLabel) errors.push('primaryWrongGame.gameLabel 为空')

  // gameType 有效或 UNKNOWN_GAME
  if (primary.gameType !== 'UNKNOWN_GAME' && !Object.values(WRONG_GAMES).includes(primary.gameType)) {
    errors.push(`primaryWrongGame.gameType 无效: ${primary.gameType}`)
  }

  // UNKNOWN_GAME 时不需要 evidence
  if (primary.gameType !== 'UNKNOWN_GAME') {
    if (!primary.evidence || !Array.isArray(primary.evidence) || primary.evidence.length < 2) {
      errors.push(`primaryWrongGame 证据不足(${primary.evidence && primary.evidence.length || 0})，至少需要2条`)
    } else {
      for (const ev of primary.evidence) {
        if (!ev.ruleId) errors.push('evidence 缺少 ruleId')
        if (!ev.sourceField) errors.push('evidence 缺少 sourceField')
        if (ev.scoreContribution === undefined) errors.push('evidence 缺少 scoreContribution')
      }
    }

    if (!primary.hiddenCost) warnings.push('primaryWrongGame.hiddenCost 为空')
    if (!primary.threeYearConsequence) warnings.push('primaryWrongGame.threeYearConsequence 为空')
    if (!primary.exitCondition) warnings.push('primaryWrongGame.exitCondition 为空')
  }

  // score 范围
  if (primary.score !== undefined && (primary.score < 0 || primary.score > 100)) {
    errors.push(`primaryWrongGame.score 越界: ${primary.score}`)
  }

  // secondary 检查
  if (result.secondaryWrongGames) {
    if (!Array.isArray(result.secondaryWrongGames)) {
      errors.push('secondaryWrongGames 不是数组')
    } else if (result.secondaryWrongGames.length > 2) {
      warnings.push(`secondaryWrongGames 超过2个: ${result.secondaryWrongGames.length}`)
    }
  }

  // undefined
  if (JSON.stringify(result).includes('undefined')) {
    errors.push('输出包含 undefined')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

module.exports = { validateWrongGameV6 }
