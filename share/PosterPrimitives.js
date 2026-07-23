/**
 * share/PosterPrimitives.js — 共享海报基础绘图库 v1.0
 *
 * 仅提供无状态的纯绘图函数。
 * 不包含任何业务数据、Canvas 绑定、导出逻辑。
 */

/**
 * 圆角矩形路径
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/**
 * 径向辉光
 */
function drawGlow(ctx, x, y, r, color, alpha) {
  const g = ctx.createCircularGradient(x, y, r)
  g.addColorStop(0, color)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.setGlobalAlpha(alpha)
  ctx.setFillStyle(g)
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
  ctx.setGlobalAlpha(1)
}

/**
 * 中文逐行排版（按像素宽度断行）
 */
function wrapChineseText(ctx, text, maxWidth, fontSize) {
  ctx.setFontSize(fontSize)
  const raw = String(text || '').trim()
  if (!raw) return ['']
  const lines = []
  const chars = raw.split('')
  let line = ''
  chars.forEach(ch => {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = ch
    } else {
      line = test
    }
  })
  if (line) lines.push(line)
  return lines
}

/**
 * 绘制多行文本
 */
function drawLines(ctx, lines, x, y, lineHeight, color, fontSize) {
  ctx.setTextAlign('left')
  ctx.setFontSize(fontSize)
  ctx.setFillStyle(color)
  lines.forEach((l, i) => {
    ctx.fillText(l, x, y + i * lineHeight)
  })
}

/**
 * 截断行数 + 末尾省略号
 */
function truncateLines(lines, maxLines) {
  if (lines.length <= maxLines) return lines
  const truncated = lines.slice(0, maxLines)
  const last = truncated[truncated.length - 1]
  truncated[truncated.length - 1] = last.replace(/.{1,3}$/, '……')
  return truncated
}

/**
 * 绘制品牌 Header
 */
function drawHeader(ctx, W, title, subtitle, titleColor, subtitleColor, accentColor) {
  ctx.setTextAlign('center')
  ctx.setFontSize(32)
  ctx.setFillStyle('#ffffff')
  ctx.fillText('珠澳小事哥 · 认知操作系统', W / 2, 58)

  ctx.setFontSize(44)
  ctx.setFillStyle(titleColor)
  ctx.fillText(title, W / 2, 118)

  ctx.setFontSize(24)
  ctx.setFillStyle(subtitleColor || titleColor)
  ctx.fillText(subtitle, W / 2, 152)

  // 分隔线
  ctx.setStrokeStyle(accentColor)
  ctx.setLineWidth(1)
  ctx.beginPath()
  ctx.moveTo(72, 172)
  ctx.lineTo(W - 72, 172)
  ctx.stroke()
}

/**
 * 绘制编号卡片
 * @param {Object} card - { _idx, _lines, _height, color, labelColor, icon, title }
 */
function drawNumberedCard(ctx, card, x, y, w) {
  const h = card._height
  const color = card.color
  const labelColor = card.labelColor || color

  roundRect(ctx, x, y, w, h, 16)
  ctx.setFillStyle('rgba(8,14,32,0.93)')
  ctx.fill()
  ctx.setStrokeStyle(color)
  ctx.setLineWidth(1.6)
  ctx.stroke()

  // 标题行
  ctx.setTextAlign('left')
  ctx.setFontSize(26)
  ctx.setFillStyle(labelColor)
  ctx.fillText(card.icon + ' ' + card.title, x + 32, y + 36)

  // 编号
  ctx.setTextAlign('center')
  ctx.setFontSize(22)
  ctx.setFillStyle(labelColor)
  ctx.fillText(card._idx, x + w - 44, y + 36)

  // 正文
  drawLines(ctx, card._lines, x + 28, y + 72, 50, '#eaf0ff', 26)
}

/**
 * 绘制二维码 CTA 卡片
 * @param ctx
 * @param qrPath      - 二维码临时路径（可为空）
 * @param x, y, w, h  - 卡片位置
 * @param color       - 边框色
 * @param ctaTitle    - 主标题
 * @param ctaSub      - 副标题
 * @param tags        - 标签数组
 */
function drawQrCta(ctx, qrPath, x, y, w, h, color, ctaTitle, ctaSub, tags) {
  const qrSize = 110
  const qrX = x + 18
  const qrY = y + 20
  const textColX = x + qrSize + 60

  roundRect(ctx, x, y, w, h, 24)
  ctx.setFillStyle('rgba(10,12,40,0.96)')
  ctx.fill()
  ctx.setStrokeStyle(color)
  ctx.setLineWidth(2)
  ctx.stroke()

  // 二维码背景
  roundRect(ctx, qrX, qrY, qrSize, qrSize, 18)
  ctx.setFillStyle('#ffffff')
  ctx.fill()
  if (qrPath) {
    try { ctx.drawImage(qrPath, qrX + 9, qrY + 9, 92, 92) } catch (_) {}
  } else {
    ctx.setTextAlign('center')
    ctx.setFontSize(18)
    ctx.setFillStyle('#999')
    ctx.fillText('长按识别', qrX + qrSize / 2, qrY + qrSize / 2 - 4)
    ctx.fillText('进入小程序', qrX + qrSize / 2, qrY + qrSize / 2 + 16)
  }

  // 文字区
  ctx.setTextAlign('left')
  ctx.setFontSize(30)
  ctx.setFillStyle(color)
  ctx.fillText(ctaTitle, textColX, qrY + 38)

  ctx.setFontSize(24)
  ctx.setFillStyle('#ffffff')
  ctx.fillText(ctaSub, textColX, qrY + 74)

  // 标签
  if (tags && tags.length) {
    tags.forEach((tag, i) => {
      const tx = textColX + i * 148
      const ty = qrY + 94
      roundRect(ctx, tx, ty, 128, 26, 13)
      ctx.setFillStyle('rgba(255,45,85,0.18)')
      ctx.fill()
      ctx.setStrokeStyle('rgba(255,100,130,0.75)')
      ctx.setLineWidth(1)
      ctx.stroke()
      ctx.setTextAlign('center')
      ctx.setFontSize(17)
      ctx.setFillStyle('#ffdce5')
      ctx.fillText(tag, tx + 64, ty + 19)
    })
  }
}

/**
 * 绘制轻量 Footer（世界规则用）
 */
function drawLightFooter(ctx, qrPath, x, y, w, h, color) {
  const qrSize = 100
  const qrX = x + w - qrSize - 6
  const qrCY = y + h / 2
  const qrY = qrCY - qrSize / 2

  if (qrPath) {
    roundRect(ctx, qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 16)
    ctx.setFillStyle('#FFFFFF')
    ctx.fill()
    ctx.setShadow(0, 3, 12, 'rgba(0,0,0,0.35)')
    ctx.setStrokeStyle('rgba(139,92,246,0.25)')
    ctx.setLineWidth(0.5)
    ctx.stroke()
    ctx.setShadow(0, 0, 0, 'rgba(0,0,0,0)')
    try { ctx.drawImage(qrPath, qrX, qrY, qrSize, qrSize) } catch (_) {}
  }

  ctx.setTextAlign('left')
  ctx.setFontSize(28)
  ctx.setFillStyle('#FFFFFF')
  ctx.fillText('更多世界规则', x, qrCY - 10)

  ctx.setFontSize(22)
  ctx.setFillStyle('rgba(255,255,255,0.45)')
  ctx.fillText('280+ 持续更新', x, qrCY + 22)
}

module.exports = {
  roundRect,
  drawGlow,
  wrapChineseText,
  drawLines,
  truncateLines,
  drawHeader,
  drawNumberedCard,
  drawQrCta,
  drawLightFooter,
}
