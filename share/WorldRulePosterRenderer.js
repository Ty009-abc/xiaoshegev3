/**
 * share/WorldRulePosterRenderer.js — 世界规则海报独立渲染器 v1.0
 *
 * 结构：品牌头 → 栏目说明 → 01-04 编号卡 → Footer CTA → Slogan
 * 主色：紫色 / 蓝紫 / 金色 / 绿色（区别于认知暴击的红橙黄绿）
 */

const P = require('./PosterPrimitives.js')

const W = 750
const SAFE = 40
const CARD_W = W - SAFE * 2
const HEADER_H = 200
const SUBHEADER_H = 52
const CTA_H = 150  // 与认知暴击一致的 drawQrCta
const GAP = 12

function log(step, msg) {
  console.log('[WorldRulePoster] ' + step + (msg ? ' ' + msg : ''))
}

/**
 * 构建卡片数据
 * @param {Object} rule   - normalizeWorldRule 后的数据
 * @param {Object} tempCtx
 */
function buildCards(rule, tempCtx) {
  const r = rule || {}

  const rawCards = [
    { icon: '📜', title: '世界规则', text: r.worldRule, color: '#8B5CF6', maxLines: 10, labelColor: '#8B5CF6', fallback: '世界规则数据加载中...' },
    { icon: '🔍', title: '底层逻辑', text: r.logic || r.underlyingLogic || r.fundamentalLogic || '', color: '#6366F1', maxLines: 8, labelColor: '#818CF8', fallback: '该规则基于客观世界的运行规律推导而来' },
    { icon: '↔', title: '反向推理', text: r.reverseInference || r.reverseLogic || r.boundary || '', color: '#F59E0B', maxLines: 9, labelColor: '#FBBF24', fallback: '如果从反方向来看，结论是否依然成立？' },
    { icon: '🎯', title: '行动建议', text: r.actionAdvice || r.action || r.todayAction || '', color: '#10B981', maxLines: 7, labelColor: '#34D399', fallback: '理解规则后，今天可以做点什么？' },
  ]

  return rawCards.map((c, i) => {
    const text = (c.text && c.text.trim() ? c.text : c.fallback) || ''
    const lines = P.wrapChineseText(tempCtx, text, CARD_W - 72, 26)
    const capped = P.truncateLines(lines, c.maxLines)
    const h = 66 + capped.length * 50 + 16
    return { ...c, _lines: capped, _height: h, _idx: String(i + 1).padStart(2, '0') }
  })
}

/**
 * 计算海报总高度
 */
function calcHeight(rule, tempCtx) {
  const cards = buildCards(rule, tempCtx)
  const cardsSum = cards.reduce((s, c) => s + c._height, 0)
  const cardsGap = GAP * (cards.length - 1)
  return HEADER_H + SUBHEADER_H + 8 + cardsSum + cardsGap + 24 + CTA_H + 48
}

/**
 * 绘制完整海报
 */
function draw(ctx, rule, qrPath, H) {
  const cards = buildCards(rule, ctx)
  const catLabel = rule.categoryDisplay || rule.category || ''

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
  const catW = ctx.measureText(catLabel).width + 40
  P.roundRect(ctx, SAFE + 4, 174, Math.max(catW, 100), 32, 8)
  ctx.setFillStyle('rgba(139,92,246,0.18)')
  ctx.fill()
  ctx.setStrokeStyle('rgba(139,92,246,0.35)')
  ctx.stroke()
  ctx.setTextAlign('center')
  ctx.setFontSize(20)
  ctx.setFillStyle('#C084FC')
  ctx.fillText(catLabel, SAFE + 4 + Math.max(catW, 100) / 2, 196)

  // 编号卡片
  let y = HEADER_H + 8
  cards.forEach(c => {
    P.drawNumberedCard(ctx, c, SAFE, y, CARD_W)
    y += c._height + GAP
  })

  // Footer CTA（与认知暴击统一 drawQrCta 母版）
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
