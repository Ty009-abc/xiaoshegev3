/**
 * utils/worldModelPosterContent.js
 *
 * PAYMENT_STAGE5A_R10_WORLD_MODEL_REPORT_PAGE_PRODUCTIZATION
 *
 * 纯内容映射（无 canvas / 无网络 / 无 AI / 无 DB）。
 * 只把「当前世界模型报告」的既有字段映射成海报结构。
 *
 * 数据纪律：
 *   SOURCE_ONLY_FROM_CURRENT_REPORT = true
 *   AI_REGEN_FORBIDDEN            = true
 *   绝不新增 AI 生成、绝不重新计算报告结论。
 *
 * @version world_model_poster_content_v1
 */

const BRAND_TITLE = '珠澳小事哥·认知操作系统'
const POSTER_MAIN_TITLE = '世界模型报告'
const FOOTER_TEXT = ['扫码查看你的世界模型报告', '看见自己的认知盲区']
const FOOTER_TAGS = ['认知升级', '底层逻辑', '翻身建议']

// 文本上限（配合渲染器的行级截断）
const BLOCK_01_MAX_LINES = 3
const BLOCK_02_MAX_LINES = 7
const BLOCK_03_MAX_LINES = 7
const BLOCK_04_MAX_ITEMS = 4
const BLOCK_04_MAX_LINES_PER_ITEM = 3

function str (v) {
  return (v === undefined || v === null) ? '' : String(v).trim()
}
function firstNonEmpty () {
  for (let i = 0; i < arguments.length; i++) {
    const v = str(arguments[i])
    if (v) return v
  }
  return ''
}
// 把行动建议拆成最多 max 条（按换行 / ；/ 。拆分）
function splitActionItems (text, max) {
  const cap = max || BLOCK_04_MAX_ITEMS
  return str(text)
    .split(/\n|；|。/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, cap)
}

/**
 * 构建海报内容。
 * @param {object} rd   页面 reportData（basicInsight/mechanism/reverseReasoning/biasCorrection/actionPlan）
 * @param {object} [meta] { mainType }
 * @returns {object} poster content model
 */
function buildPosterContent (rd, meta) {
  const r = rd || {}
  const m = meta || {}

  const fatalLine = firstNonEmpty(r.basicInsight, r.fatalLine, r.headline)
  const coreProblem = firstNonEmpty(r.mechanism, r.coreProblem)
  const systemTrap = firstNonEmpty(r.reverseReasoning, r.systemTrap)
  const actions = firstNonEmpty(r.actionPlan, r.actions)

  return {
    brandTitle: BRAND_TITLE,
    mainTitle: POSTER_MAIN_TITLE,
    subtitle: firstNonEmpty(fatalLine, m.mainType, '你的世界模型报告'),
    blocks: [
      { index: 1, key: 'fatalLine', title: '今日认知暴击', text: fatalLine, maxLines: BLOCK_01_MAX_LINES, color: '#FF4D4F' },
      { index: 2, key: 'coreProblem', title: '底层逻辑拆解', text: coreProblem, maxLines: BLOCK_02_MAX_LINES, color: '#5B8CFF' },
      { index: 3, key: 'systemTrap', title: '系统困局', text: systemTrap, maxLines: BLOCK_03_MAX_LINES, color: '#FF9F1A' },
      { index: 4, key: 'actions', title: '翻身行动建议', text: actions, maxLines: BLOCK_04_MAX_ITEMS, color: '#2FE08A', items: splitActionItems(actions, BLOCK_04_MAX_ITEMS) },
    ],
    footerText: FOOTER_TEXT.slice(),
    footerTags: FOOTER_TAGS.slice(),
    limits: {
      block01MaxLines: BLOCK_01_MAX_LINES,
      block02MaxLines: BLOCK_02_MAX_LINES,
      block03MaxLines: BLOCK_03_MAX_LINES,
      block04MaxItems: BLOCK_04_MAX_ITEMS,
      block04MaxLinesPerItem: BLOCK_04_MAX_LINES_PER_ITEM,
    },
  }
}

module.exports = {
  BRAND_TITLE,
  POSTER_MAIN_TITLE,
  FOOTER_TEXT,
  FOOTER_TAGS,
  BLOCK_01_MAX_LINES,
  BLOCK_02_MAX_LINES,
  BLOCK_03_MAX_LINES,
  BLOCK_04_MAX_ITEMS,
  BLOCK_04_MAX_LINES_PER_ITEM,
  splitActionItems,
  buildPosterContent,
}
