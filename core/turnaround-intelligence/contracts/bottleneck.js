/**
 * core/turnaround-intelligence/contracts/bottleneck.js
 *
 * CP6-D Bottleneck Contract — 预测最可能失败点
 *
 * 基于当前行为模式推断，不是确定性预测。
 *
 * @version 6.2.0
 * @checkpoint CP6-D
 */

// ═══════════════════════════════════════
// 瓶颈枚举 — 8 种固定失败模式
// ═══════════════════════════════════════

const BOTTLENECK_CATALOG = Object.freeze({

  EXECUTION_CONTINUITY: {
    code: 'EXECUTION_CONTINUITY',
    title: '执行连续性断裂',
    description: '最可能在连续执行4周左右出现中断',
    typicalWeek: 4,
    preventionDefault: ['每日执行打卡', '固定执行时间窗', '设置最低完成标准'],
  },

  MOTIVATION_DECAY: {
    code: 'MOTIVATION_DECAY',
    title: '动机衰减',
    description: '初始热情消退后行动力下降',
    typicalWeek: 6,
    preventionDefault: ['每周回顾最初动机', '设置阶段性小奖赏', '找到执行伙伴'],
  },

  DIRECTION_FATIGUE: {
    code: 'DIRECTION_FATIGUE',
    title: '方向疲劳',
    description: '看不到短期结果后开始怀疑方向，可能换方向',
    typicalWeek: 8,
    preventionDefault: ['设定最小反馈周期', '不因短期无反馈而转向', '记录每日微小进展'],
  },

  RESOURCE_DEPLETION: {
    code: 'RESOURCE_DEPLETION',
    title: '资源耗尽',
    description: '时间或金钱投入超出预期，被迫中断',
    typicalWeek: 12,
    preventionDefault: ['严格控制投入上限', '每月资源核算', '预设退出条件'],
  },

  COGNITIVE_OVERLOAD: {
    code: 'COGNITIVE_OVERLOAD',
    title: '认知过载',
    description: '想太多导致无法聚焦，效率崩溃',
    typicalWeek: 3,
    preventionDefault: ['限制每日决策数≤3', '关闭信息噪声', '单任务模式'],
  },

  SOCIAL_PRESSURE: {
    code: 'SOCIAL_PRESSURE',
    title: '外部压力干扰',
    description: '来自家庭或社交圈的压力使你偏离计划',
    typicalWeek: 6,
    preventionDefault: ['明确沟通边界', '保护执行时间', '减少无效社交'],
  },

  PERFECTION_PARALYSIS: {
    code: 'PERFECTION_PARALYSIS',
    title: '完美主义瘫痪',
    description: '追求完美导致迟迟不开始或不交付',
    typicalWeek: 2,
    preventionDefault: ['MVP原则—先完成再完美', '设置硬截止时间', '接受80分就交付'],
  },

  SHORT_TERM_DISTRACTION: {
    code: 'SHORT_TERM_DISTRACTION',
    title: '短期诱惑干扰',
    description: '被短期机会或娱乐分心，放弃长期路线',
    typicalWeek: 5,
    preventionDefault: ['任何新机会冷却72小时', '娱乐时间预算', '可视化长期目标'],
  },
})

// ═══════════════════════════════════════
// Pattern → 最可能瓶颈映射
// ═══════════════════════════════════════

const PATTERN_TO_BOTTLENECK = Object.freeze({
  ACTION_FRAGMENTATION:       'EXECUTION_CONTINUITY',
  HIGH_INPUT_LOW_OUTPUT:      'PERFECTION_PARALYSIS',
  SHORT_TERM_REWARD:          'SHORT_TERM_DISTRACTION',
  EMOTIONAL_DECISION:         'MOTIVATION_DECAY',
  RISK_OVERCONFIDENCE:        'RESOURCE_DEPLETION',
  GOAL_INSTABILITY:           'DIRECTION_FATIGUE',
  LEARNING_WITHOUT_PRACTICE:  'PERFECTION_PARALYSIS',
  PASSIVE_EXPECTATION:        'MOTIVATION_DECAY',
})

// ═══════════════════════════════════════
// createBottleneckOutput
// ═══════════════════════════════════════

function createBottleneckOutput({ version, code, probability, expectedWeek, reason, prevention }) {
  if (!version) throw new Error('Bottleneck: version required')
  if (!code) throw new Error('Bottleneck: code required')
  if (!BOTTLENECK_CATALOG[code]) throw new Error(`Unknown bottleneck: "${code}"`)
  if (typeof probability !== 'number' || probability < 0 || probability > 1) {
    throw new Error('Bottleneck: probability out of range')
  }
  if (typeof expectedWeek !== 'number' || expectedWeek <= 0 || expectedWeek > 52) {
    throw new Error('Bottleneck: expectedWeek out of range')
  }
  if (!reason) throw new Error('Bottleneck: reason required')
  if (!Array.isArray(prevention) || prevention.length === 0) {
    throw new Error('Bottleneck: prevention required')
  }

  return Object.freeze({
    version,
    code,
    title: BOTTLENECK_CATALOG[code].title,
    description: BOTTLENECK_CATALOG[code].description,
    probability: clamp(Math.round(probability * 100) / 100, 0, 1),
    expectedWeek,
    reason,
    prevention: Object.freeze([...prevention]),
  })
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }
module.exports = { BOTTLENECK_CATALOG, PATTERN_TO_BOTTLENECK, createBottleneckOutput }
