/**
 * core/turnaround-os/schemas/futureProjectionV6.js
 *
 * V6 未来双路径模拟器数据契约
 * 仅模拟两条路径：当前路径 vs 翻身路径
 *
 * @version 6.0.0
 */

const TRAJECTORY_LEVELS = ['下降', '停滞', '缓慢改善', '明显改善', '结构性改善']

/**
 * 创建默认未来模拟
 * @returns {Object}
 */
function createDefault() {
  return {
    version: '6.0',

    currentPath: {
      day90: createSnapshot(),
      day365: createSnapshot(),
      year3: createSnapshot(),
      mainRisk: '',
    },

    turnaroundPath: {
      day90: createSnapshot(),
      day365: createSnapshot(),
      year3: createSnapshot(),
      mainRisk: '',
    },

    keyDifference: '',
    assumptions: [],
    disclaimer: '本模拟基于规则引擎推演，反映结构性变化趋势，不包含具体金额预测，不作为财务建议。',
  }
}

/**
 * 单时间点快照
 */
function createSnapshot() {
  return {
    incomeStructure: '停滞',
    cashflowSafety: '停滞',
    reusableAssets: '停滞',
    audienceOrClients: '停滞',
    executionSystem: '停滞',
    timeControl: '停滞',
    psychologicalPressure: '停滞',
    overallTrajectory: '停滞',
  }
}

/**
 * 清洗 projection
 */
function normalize(raw) {
  if (!raw || typeof raw !== 'object') return createDefault()
  const def = createDefault()

  function cleanSnapshot(rawSnap) {
    const snap = createSnapshot()
    if (!rawSnap || typeof rawSnap !== 'object') return snap
    for (const key of Object.keys(snap)) {
      const val = rawSnap[key]
      snap[key] = TRAJECTORY_LEVELS.includes(val) ? val : '停滞'
    }
    return snap
  }

  return {
    version: '6.0',
    currentPath: {
      day90: cleanSnapshot(raw.currentPath && raw.currentPath.day90),
      day365: cleanSnapshot(raw.currentPath && raw.currentPath.day365),
      year3: cleanSnapshot(raw.currentPath && raw.currentPath.year3),
      mainRisk: String((raw.currentPath && raw.currentPath.mainRisk) || ''),
    },
    turnaroundPath: {
      day90: cleanSnapshot(raw.turnaroundPath && raw.turnaroundPath.day90),
      day365: cleanSnapshot(raw.turnaroundPath && raw.turnaroundPath.day365),
      year3: cleanSnapshot(raw.turnaroundPath && raw.turnaroundPath.year3),
      mainRisk: String((raw.turnaroundPath && raw.turnaroundPath.mainRisk) || ''),
    },
    keyDifference: String(raw.keyDifference || ''),
    assumptions: Array.isArray(raw.assumptions) ? raw.assumptions.map(String) : [],
    disclaimer: String(raw.disclaimer || def.disclaimer),
  }
}

module.exports = {
  createDefault,
  normalize,
  TRAJECTORY_LEVELS,
  createSnapshot,
}
