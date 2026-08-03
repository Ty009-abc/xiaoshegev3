/**
 * share/WorldRulePosterRenderer.js — 世界规则海报独立渲染器 v1.1
 *
 * 结构：品牌头 → 栏目说明 → 01-04 编号卡 → Footer CTA
 * 主色：紫色系（区别于认知暴击的红橙黄绿）
 *
 * 数据契约（来自 normalizeWorldRule）：
 *   data.worldRule       → 01 世界规则卡片
 *   data.underlyingLogic → 02 底层逻辑卡片（可为空）
 *   data.reverseLogic    → 03 反向推理卡片
 *   data.actionAdvice    → 04 行动建议卡片
 *   data.categoryDisplay → 分类标签
 */

const P = require('./PosterPrimitives.js')

const W = 750
const SAFE = 40
const CARD_W = W - SAFE * 2
const HEADER_H = 200
const SUBHEADER_H = 52
const CTA_H = 150
const GAP = 12

function log(step, msg) {
  console.log('[WorldRulePoster] ' + step + (msg ? ' ' + msg : ''))
}

/**
 * 清理文本（去首尾空白 + 中文标点）
 */
function cleanText(text) {
  if (!text || typeof text !== 'string') return ''
  return text.trim()
}

/**
 * 构建卡片数据
 * @param {Object} data - normalizeWorldRule 后的规范数据
 * @param {Object} tempCtx
 */
function buildCards(data, tempCtx) {
  const d = data || {}

  // 全部字段读取规范字段（不 fallback，不填占位句）
  const wRule = cleanText(d.worldRule)
  const uLogic = cleanText(d.underlyingLogic)
  const rLogic = cleanText(d.reverseLogic)
  const aAdvice = cleanText(d.actionAdvice)

  // 防串线：01和02内容不得相同
  if (wRule && uLogic && wRule === uLogic) {
    console.warn('[WorldRulePoster] DUPLICATE_SECTION_CONTENT 01==02 ruleId=' + (d.id || 'unknown'))
  }

  const rawCards = [
    {
      icon: '📜', title: '世界规则',
      text: wRule,
      color: '#8B5CF6', maxLines: 10, labelColor: '#8B5CF6',
    },
    {
      icon: '🔍', title: '底层逻辑',
      text: uLogic,
      color: '#6366F1', maxLines: 8, labelColor: '#818CF8',
      _badge: d.underlyingLogicStatus === 'TEMPORARY' ? '机制分析·待完善' : null,
    },
    {
      icon: '↔', title: '反向推理',
      text: rLogic,
      color: '#F59E0B', maxLines: 9, labelColor: '#FBBF24',
    },
    {
      icon: '🎯', title: '行动建议',
      text: aAdvice,
      color: '#10B981', maxLines: 7, labelColor: '#34D399',
    },
  ]

  return rawCards.map((c, i) => {
    const displayText = c.text || ''
    const lines = P.wrapChineseText(tempCtx, displayText, CARD_W - 72, 26)
    const capped = P.truncateLines(lines, c.maxLines)
    const h = 66 + capped.length * 50 + 16
    return { ...c, _lines: capped, _height: h, _idx: String(i + 1).padStart(2, '0') }
  })
}

/**
 * 计算海报总高度
 */
function calcHeight(data, tempCtx) {
  const cards = buildCards(data, tempCtx)
  const cardsSum = cards.reduce((s, c) => s + c._height, 0)
  const cardsGap = GAP * (cards.length - 1)
  return HEADER_H + SUBHEADER_H + 8 + cardsSum + cardsGap + 24 + CTA_H + 48
}

/**
 * 绘制完整海报
 */
function draw(ctx, data, qrPath, H) {
  const cards = buildCards(data, ctx)
  const catLabel = data.categoryDisplay || data.category || ''

  log('draw', 'start cards=' + cards.length + ' H=' + H)

  // 背景
  ctx.setFillStyle('#070614')
  ctx.fillRect(0, 0, W, H)
  P.drawGlow(ctx, 160, 160, 280, '#7b3cff', 0.22)
  P.drawGlow(ctx, 620, 160, 240, '#ff2d75', 0.14)
  P.drawGlow(ctx, 375, H - 240, 320, '#2d6bff', 0.15)

  // 品牌 Header
  P.drawHeader(ctx, W, '🌐 世界规则', '看懂规则，才能翻身', '#C084FC', '#A78BFA', 'rgba(192,132,252,0.35)')

  // 分类标签
  const catW = catLabel ? ctx.measureText(catLabel).width + 40 : 100
  P.roundRect(ctx, SAFE + 4, 174, Math.max(catW, 100), 32, 8)
  ctx.setFillStyle('rgba(139,92,246,0.18)')
  ctx.fill()
  ctx.setStrokeStyle('rgba(139,92,246,0.35)')
  ctx.stroke()
  if (catLabel) {
    ctx.setTextAlign('center')
    ctx.setFontSize(20)
    ctx.setFillStyle('#C084FC')
    ctx.fillText(catLabel, SAFE + 4 + Math.max(catW, 100) / 2, 196)
  }

  // 编号卡片
  let y = HEADER_H + 8
  cards.forEach(c => {
    P.drawNumberedCard(ctx, c, SAFE, y, CARD_W)

    // TEMPORARY 标记：在卡片右上角绘制 "内容补充中" 标签
    if (c._badge) {
      const badgeText = c._badge
      const badgeW = ctx.measureText(badgeText).width + 24
      const badgeH = 26
      const badgeX = SAFE + CARD_W - badgeW - 12
      const badgeY = y + 10
      P.roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 6)
      ctx.setFillStyle('rgba(245,158,11,0.18)')
      ctx.fill()
      ctx.setStrokeStyle('rgba(245,158,11,0.5)')
      ctx.setLineWidth(1)
      ctx.stroke()
      ctx.setTextAlign('center')
      ctx.setFontSize(18)
      ctx.setFillStyle('#FBBF24')
      ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + 19)
    }

    y += c._height + GAP
  })

  // Footer CTA（统一 drawQrCta 结构）
  const ctaY = y + 24
  P.drawQrCta(
    ctx, qrPath,
    SAFE, ctaY, CARD_W, CTA_H,
    '#8B5CF6',
    '🌐 世界规则',
    '看懂规则，才能翻身',
    ['🧠 认知升级', '🔍 底层逻辑', '🎯 行动建议']
  )

  log('draw', 'complete')
}

module.exports = { calcHeight, draw }
