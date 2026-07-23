/**
 * share/CognitiveStrikePosterRenderer.js — 今日认知暴击海报独立渲染器 v1.0
 *
 * 完全独立于世界规则海报。
 * 不共享业务数据、高度缓存、Canvas 状态。
 */

const P = require('./PosterPrimitives.js')

const W = 750
const SAFE = 40
const CARD_W = W - SAFE * 2
const HEADER_H = 180
const CTA_H = 150
const GAP = 12

function log(step, msg) {
  console.log('[StrikePoster] ' + step + (msg ? ' ' + msg : ''))
}

/**
 * 计算海报总高度
 * @param {Object} data - { core_strike, logic_dissection, reverse_inference, action_advice }
 * @param {Object} ctx  - 临时 Canvas context（仅用于 measureText）
 * @returns {number} H
 */
function calcHeight(data, tempCtx) {
  const cards = buildCards(data, tempCtx)
  const cardsSum = cards.reduce((s, c) => s + c._height, 0)
  const cardsGap = GAP * (cards.length - 1)
  return HEADER_H + cardsSum + cardsGap + 24 + CTA_H + 48
}

/**
 * 构建卡片数据（包含排版后的 _lines 和 _height）
 */
function buildCards(data, tempCtx) {
  const st = data || {}
  const rawCards = [
    { icon: '💥', title: '今日认知暴击', text: st.core_strike, color: '#ff3b3b', maxLines: 10, labelColor: '#ff3b3b' },
    { icon: '🔍', title: '底层逻辑拆解', text: st.logic_dissection, color: '#ff6b3d', maxLines: 9, labelColor: '#ff6b3d' },
    { icon: '↔', title: '反方向推理', text: st.reverse_inference, color: '#ff9f1a', maxLines: 9, labelColor: '#ff9f1a' },
    { icon: '🎯', title: '翻身行动建议', text: st.action_advice, color: '#39d353', maxLines: 7, labelColor: '#39d353' },
  ]
  return rawCards.map((c, i) => {
    const lines = P.wrapChineseText(tempCtx, c.text, CARD_W - 72, 26)
    const capped = P.truncateLines(lines, c.maxLines)
    const h = 66 + capped.length * 50 + 16
    return { ...c, _lines: capped, _height: h, _idx: String(i + 1).padStart(2, '0') }
  })
}

/**
 * 绘制完整海报到 ctx
 * @param {Object} ctx     - 真实 Canvas 2D context
 * @param {Object} data    - 业务数据
 * @param {string} qrPath  - 二维码临时路径
 * @param {number} H       - 预计算的高度
 */
function draw(ctx, data, qrPath, H) {
  const cards = buildCards(data, ctx)  // 用真实 ctx 重新 measure

  log('draw', 'start cards=' + cards.length + ' H=' + H)

  // 背景
  ctx.setFillStyle('#070614')
  ctx.fillRect(0, 0, W, H)
  P.drawGlow(ctx, 200, 120, 250, '#ff2d55', 0.22)
  P.drawGlow(ctx, 580, 100, 250, '#ff6b3d', 0.16)
  P.drawGlow(ctx, 375, H - 200, 300, '#8b3cff', 0.14)

  // Header
  P.drawHeader(ctx, W, '💥 今日认知暴击', '一句话，击穿一个认知盲区', '#ff2d55', '#ff5ca8', 'rgba(255,45,85,0.4)')

  // 编号卡片
  let y = HEADER_H
  cards.forEach(c => {
    P.drawNumberedCard(ctx, c, SAFE, y, CARD_W)
    y += c._height + GAP
  })

  // CTA
  const ctaY = y + 24
  P.drawQrCta(
    ctx, qrPath,
    SAFE, ctaY, CARD_W, CTA_H,
    '#ff2d55',
    '💥 每日认知暴击',
    '看见自己的认知盲区',
    ['🧠 认知升级', '⚡ 底层逻辑', '🎯 翻身建议']
  )

  log('draw', 'complete')
}

module.exports = { calcHeight, draw }
