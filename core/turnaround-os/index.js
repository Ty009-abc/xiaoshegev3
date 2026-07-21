/**
 * core/turnaround-os/index.js — Turnaround OS V6 Core Entry
 *
 * 翻身操作系统 核心模块
 * 本阶段纯规则引擎，不接AI、不接数据库、不接支付
 *
 * @version 6.0.0
 * @phase 1 - 核心底座工程
 */

const constants = require('./constants')

// Schemas
const identityProfileV6 = require('./schemas/identityProfileV6')
const strategyContractV6 = require('./schemas/strategyContractV6')
const futureProjectionV6 = require('./schemas/futureProjectionV6')
const missionContractV6 = require('./schemas/missionContractV6')

// Contracts
const destinyProjectionContractV6 = require('./contracts/destinyProjectionContractV6')
const missionPlanContractV6 = require('./contracts/missionPlanContractV6')

// Engines
const { buildIdentity } = require('./engines/identityEngineV6')
const { detectWrongGame } = require('./engines/wrongGameEngineV6')
const { determineLeverage } = require('./engines/leverageEngineV6')
const { generateStrategy } = require('./engines/turnaroundEngineV6')
const { explain, explainTrend, explainBatch, explainComparison, explainDecisionNode } = require('./engines/whyEngineV6')
const { projectDestiny } = require('./engines/destinyProjectionEngineV6')

// Simulators
const { simulateWorldA } = require('./simulators/worldASimulator')
const { simulateWorldB } = require('./simulators/worldBSimulator')

// Validators
const { validateIdentityV6 } = require('./validators/validateIdentityV6')
const { validateWrongGameV6 } = require('./validators/validateWrongGameV6')
const { validateLeverageV6 } = require('./validators/validateLeverageV6')
const { validateStrategyV6 } = require('./validators/validateStrategyV6')
const { validateProjectionV6 } = require('./validators/validateProjectionV6')
const { validateMissionContractV6, validateMissionPlanContractV6 } = require('./validators/validateMissionPlanV6')

// Utils
const score = require('./utils/score')
const normalize = require('./utils/normalize')
const deterministic = require('./utils/deterministic')

module.exports = {
  constants,
  schemas: {
    identityProfileV6,
    strategyContractV6,
    futureProjectionV6,
    missionContractV6,
  },
  contracts: {
    destinyProjectionContractV6,
    missionPlanContractV6,
  },
  engines: {
    buildIdentity,
    detectWrongGame,
    determineLeverage,
    generateStrategy,
    projectDestiny,
    why: { explain, explainTrend, explainBatch, explainComparison, explainDecisionNode },
  },
  simulators: {
    simulateWorldA,
    simulateWorldB,
  },
  validators: {
    validateIdentityV6,
    validateWrongGameV6,
    validateLeverageV6,
    validateStrategyV6,
    validateProjectionV6,
    validateMissionContractV6,
    validateMissionPlanContractV6,
  },
  utils: {
    score,
    normalize,
    deterministic,
  },
}
