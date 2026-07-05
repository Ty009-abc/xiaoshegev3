/**
 * hookGenerator.js — Hook 生成与选择引擎（第六册 Part 2）
 *
 * 能力：
 *   1. 按矩阵选择最佳 Hook（主选 + 备选）
 *   2. Hook 变体生成（核心句 + 扩展句）
 *   3. Hook 评分（开局冲击力 + 停留欲望 + 转发动机）
 *   4. A/B Hook 生成
 */
const now = () => Date.now()

// ── 加载 Hook 库（lazy）──
let HOOK_DATA = null
let MATRIX_MAP = null

function _loadHooks() {
  if (!HOOK_DATA) {
    try {
      const mod = require('../content/hooks/index.js')
      HOOK_DATA = mod.HOOKS
      MATRIX_MAP = mod.MATRIX_HOOK_MAP
    } catch (_) {
      try {
        const mod = require('../../content/hooks/index.js')
        HOOK_DATA = mod.HOOKS
        MATRIX_MAP = mod.MATRIX_HOOK_MAP
      } catch (_) {
        HOOK_DATA = {}
        MATRIX_MAP = {}
      }
    }
  }
  return { HOOK_DATA, MATRIX_MAP }
}

// ═══════════════════════════
// selectHook — 按矩阵选择 Hook
// ═══════════════════════════

async function selectHook(matrix, options = {}) {
  const { count = 1, tone = 'xiaoshige', excludeIds = [] } = options
  const { HOOK_DATA, MATRIX_MAP } = _loadHooks()

  // 找到矩阵对应的 Hook 类别
  const hookCategories = MATRIX_MAP[matrix] || ['cognition']
  let pool = []
  hookCategories.forEach(cat => {
    if (HOOK_DATA[cat]) pool = pool.concat(HOOK_DATA[cat])
  })

  if (excludeIds.length > 0) {
    pool = pool.filter(h => !excludeIds.includes(h))
  }

  if (pool.length === 0) {
    pool = ['这个世界运行的底层逻辑，你从未想过']
  }

  // 选择 primary + alternatives
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const primary = shuffled[0]
  const alternatives = shuffled.slice(1, count + 1)

  return {
    primary: typeof primary === 'string'
      ? { id: `hook_${primary.slice(0, 10).replace(/\s/g, '')}`, text: primary, category: hookCategories[0] }
      : primary,
    alternatives: alternatives.map((h, i) =>
      typeof h === 'string'
        ? { id: `hook_alt_${i}`, text: h, category: hookCategories[0] }
        : h
    ),
    category: hookCategories.join('+'),
    matrix,
  }
}

// ═══════════════════════════
// generateHookVariants — 生成 Hook 变体
// ═══════════════════════════

async function generateHookVariants(baseHook, options = {}) {
  const { count = 3, tone = 'xiaoshige' } = options
  const text = typeof baseHook === 'string' ? baseHook : baseHook.text || ''

  const variants = []

  // 变体策略
  const strategies = [
    (t) => `没想到吧——${t.replace(/^为什么|^你以为|^你/,'')}`,
    (t) => `${t}（很多人测完沉默了）`,
    (t) => `有人说"${t.slice(0, 15)}…"但真相更残酷`,
    (t) => `我问了100个人这个问题，只有3个人答对了：${t.slice(0, 20)}`,
    (t) => t.includes('？') || t.includes('?') ? t : `${t}——这不是鸡汤`,
  ]

  for (let i = 0; i < count; i++) {
    const fn = strategies[i % strategies.length]
    variants.push({
      id: `variant_${i}_${Date.now()}`,
      text: fn(text),
      strategy: `variant_${i}`,
    })
  }

  return { base: text, variants }
}

// ═══════════════════════════
// scoreHook — Hook 评分
// ═══════════════════════════

async function scoreHook(hookText) {
  const text = typeof hookText === 'string' ? hookText : hookText.text || ''

  let score = 0

  // 1. 开局冲击力（前3秒能否让人停下来）
  const openingPower = _scoreOpeningPower(text)       // 0-40
  score += openingPower

  // 2. 停留欲望（读完第一句是否想继续）
  const stayDesire = _scoreStayDesire(text)           // 0-30
  score += stayDesire

  // 3. 转发动机（读者是否想发给别人看）
  const shareMotivation = _scoreShareMotivation(text)  // 0-30
  score += shareMotivation

  return {
    total: score,
    breakdown: {
      openingPower,
      stayDesire,
      shareMotivation,
    },
    approved: score >= 75,
    quality: score >= 85 ? 'excellent' : score >= 75 ? 'good' : score >= 60 ? 'ok' : 'weak',
    suggestion: score < 75 ? 'Hook冲击力不够，建议增加反常识或危机感元素' : null,
  }
}

// ═══════════════════════════
// generateABHooks — A/B Hook 生成
// ═══════════════════════════

async function generateABHooks(matrix, topic) {
  const { HOOK_DATA, MATRIX_MAP } = _loadHooks()
  const hookCategories = MATRIX_MAP[matrix] || ['cognition']

  // 从不同类别取 Hook
  const hookA = HOOK_DATA[hookCategories[0]]
    ? HOOK_DATA[hookCategories[0]][Math.floor(Math.random() * HOOK_DATA[hookCategories[0]].length)]
    : '测试'

  const catB = hookCategories.length > 1 ? hookCategories[1] : hookCategories[0]
  const hookB = HOOK_DATA[catB]
    ? HOOK_DATA[catB][Math.floor(Math.random() * HOOK_DATA[catB].length)]
    : '测试'

  const [scoreA, scoreB] = await Promise.all([scoreHook(hookA), scoreHook(hookB)])

  return {
    variants: [
      { id: 'ab_a', text: typeof hookA === 'string' ? hookA : hookA.text, category: hookCategories[0], score: scoreA },
      { id: 'ab_b', text: typeof hookB === 'string' ? hookB : hookB.text, category: catB, score: scoreB },
    ],
    winner: scoreA.total >= scoreB.total ? 'A' : 'B',
    winnerText: scoreA.total >= scoreB.total
      ? (typeof hookA === 'string' ? hookA : hookA.text)
      : (typeof hookB === 'string' ? hookB : hookB.text),
  }
}

// ═══════════════════════════
// Hook 评分子函数
// ═══════════════════════════

function _scoreOpeningPower(text) {
  let score = 10 // base
  // 反常识开头 +15
  if (/为什么|你以为|99%|大多数|都说|从来没/.test(text)) score += 15
  // 数字开头 +10
  if (/\d+[年岁个次]/.test(text)) score += 10
  // 矛盾/对立 +10
  if (/不是|但是|却|真相|秘密|背后/.test(text)) score += 10
  // 你/我 代入 +5
  if (/你|我/.test(text)) score += 5
  return Math.min(40, score)
}

function _scoreStayDesire(text) {
  let score = 5
  // 悬念感
  if (/真相|秘密|逻辑|底层|公式|法则|原理|系统/.test(text)) score += 10
  // 利益相关
  if (/赚钱|发财|收入|资产|翻身|逆袭|自由/.test(text)) score += 10
  // 损失厌恶
  if (/淘汰|取代|消失|被.*代|危险|风险|陷阱/.test(text)) score += 10
  // 长度适中（15-40字最佳）
  if (text.length >= 15 && text.length <= 40) score += 5
  if (text.length > 60) score -= 3 // 太长
  return Math.min(30, Math.max(0, score))
}

function _scoreShareMotivation(text) {
  let score = 5
  // 社交货币 — 发出去显得自己"懂得多"
  if (/认知|逻辑|系统|底层|框架|模式/.test(text)) score += 10
  // 争议性 — 发出去会有人讨论
  if (/为什么|到底|谁|真正/ .test(text)) score += 8
  // 利他性 — 发出去"帮"朋友
  if (/你.*吗|测一|看看|不知道|不知道/.test(text)) score += 8
  // 面子 — 发出去显得自己"清醒"
  if (/90%|99%|大多数人|绝大多数|第一种|第二种/.test(text)) score += 7
  return Math.min(30, score)
}

module.exports = {
  selectHook,
  generateHookVariants,
  scoreHook,
  generateABHooks,
}
