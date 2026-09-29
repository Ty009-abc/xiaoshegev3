/**
 * utils/worldModelPosterRenderer.js
 *
 * PAYMENT_STAGE5A_R10_WORLD_MODEL_REPORT_PAGE_PRODUCTIZATION
 *
 * 世界模型报告海报渲染器（纯绘制函数，无网络 / 无 AI / 无 DB）。
 * 使用 legacy Canvas API（wx.createCanvasContext）兼容的 ctx 接口，
 * 与仓库既有海报方案一致，真机稳定。
 *
 * 设计参考：图3 风格 —— 深色导航蓝底 + 霓虹描边 + 高对比排版 +
 * 章节盒子 + 红/橙/绿章节编码 + 强品牌感。
 *
 * CANVAS：1080 × 1920（竖版）。调用方负责 ctx.draw() 与落盘。
 *
 * @version world_model_poster_renderer_v1
 */

const W = 1080
const H = 1920

const PALETTE = Object.freeze({
  bg0: '#070B14',
  bg1: '#0B1020',
  panel: 'rgba(17,24,39,0.86)',
  border: 'rgba(124,92,255,0.55)',
  neon: '#7C5CFF',
  pink: '#D64BFF',
  blue: '#5B8CFF',
  gold: '#E9C46A',
  white: '#FFFFFF',
  body: '#E6EAF5',
  muted: '#94A3B8',
})

function roundRect (ctx, x, y, w, h, r) {
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

// 按像素宽度折行（含中英混排），并可按 maxLines 截断（追加省略号）。
function wrapText (ctx, text, maxWidth, fontSize, maxLines) {
  ctx.setFontSize(fontSize)
  const src = String(text == null ? '' : text).replace(/\r/g, '')
  const paras = src.split('\n')
  const lines = []
  for (const para of paras) {
    if (para === '') { lines.push(''); continue }
    let line = ''
    for (const ch of para) {
      const test = line + ch
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line); line = ch
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
  }
  if (maxLines && lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = kept[maxLines - 1].replace(/.{1}$/, '') + '…'
    return kept
  }
  return lines
}

function drawGlow (ctx, x, y, r, color, alpha) {
  try {
    const g = ctx.createCircularGradient(x, y, r)
    g.addColorStop(0, color)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.setGlobalAlpha(alpha)
    ctx.setFillStyle(g)
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
    ctx.setGlobalAlpha(1)
  } catch (e) { /* gradient unsupported → skip glow */ }
}

/**
 * 绘制整张海报。
 * @param {object} ctx   legacy canvas context
 * @param {object} content  来自 utils/worldModelPosterContent.buildPosterContent
 * @param {object} [opts]   { qrPath?:string }
 * @returns {{width:number,height:number,sections:number,hasQR:boolean}}
 */
function drawPoster (ctx, content, opts) {
  const c = content || {}
  const o = opts || {}
  const padX = 72
  const innerW = W - padX * 2

  // ── 背景 ──
  ctx.setFillStyle(PALETTE.bg0)
  ctx.fillRect(0, 0, W, H)
  drawGlow(ctx, 220, 240, 420, PALETTE.neon, 0.22)
  drawGlow(ctx, W - 200, 180, 380, PALETTE.pink, 0.14)
  drawGlow(ctx, W / 2, H - 320, 460, '#2D6BFF', 0.14)

  // ── 顶部品牌 ──
  ctx.setTextAlign('center')
  ctx.setFontSize(30)
  ctx.setFillStyle(PALETTE.gold)
  ctx.fillText(c.brandTitle || '', W / 2, 96)

  ctx.setFontSize(72)
  ctx.setFillStyle(PALETTE.white)
  ctx.fillText(c.mainTitle || '世界模型报告', W / 2, 196)

  // 霓虹分隔线
  ctx.setStrokeStyle(PALETTE.border)
  ctx.setLineWidth(2)
  ctx.beginPath()
  ctx.moveTo(padX, 232)
  ctx.lineTo(W - padX, 232)
  ctx.stroke()

  // 副标题（致命一句话）
  let y = 300
  if (c.subtitle) {
    const subLines = wrapText(ctx, c.subtitle, innerW, 34, 2)
    ctx.setTextAlign('center')
    ctx.setFillStyle(PALETTE.pink)
    subLines.forEach((l, i) => { ctx.fillText(l, W / 2, y + i * 46) })
    y += subLines.length * 46 + 40
  } else {
    y += 20
  }

  // ── 章节盒子 ──
  const blocks = Array.isArray(c.blocks) ? c.blocks : []
  const blockGap = 26
  ctx.setTextAlign('left')
  for (const b of blocks) {
    const bodySize = 30
    const lineH = 44
    const headerH = 76
    // 行动建议：按条渲染
    let bodyLines = []
    if (b.key === 'actions' && Array.isArray(b.items) && b.items.length) {
      b.items.forEach((it) => {
        const ls = wrapText(ctx, it, innerW - 96, bodySize, c.limits && c.limits.block04MaxLinesPerItem)
        bodyLines.push({ bullet: true, lines: ls })
      })
    } else {
      bodyLines = wrapText(ctx, b.text || '暂无数据', innerW - 72, bodySize, b.maxLines).map((l) => ({ bullet: false, lines: [l] }))
    }
    const bodyH = bodyLines.reduce((s, g) => s + g.lines.length * lineH, 0) + (bodyLines.length - 1) * 8
    const boxH = headerH + Math.max(60, bodyH) + 40

    roundRect(ctx, padX, y, innerW, boxH, 28)
    ctx.setFillStyle(PALETTE.panel)
    ctx.fill()
    ctx.setStrokeStyle(b.color || PALETTE.border)
    ctx.setLineWidth(2)
    ctx.stroke()

    // 编号 badge
    roundRect(ctx, padX + 28, y + 22, 84, 40, 12)
    ctx.setFillStyle(b.color || PALETTE.neon)
    ctx.fill()
    ctx.setFontSize(26)
    ctx.setFillStyle('#0B1020')
    ctx.setTextAlign('center')
    ctx.fillText(String(b.index || '').padStart(2, '0'), padX + 70, y + 50)

    // 标题
    ctx.setTextAlign('left')
    ctx.setFontSize(38)
    ctx.setFillStyle(b.color || PALETTE.white)
    ctx.fillText(b.title || '', padX + 132, y + 52)

    // 正文
    let by = y + headerH + 26
    ctx.setFontSize(bodySize)
    ctx.setFillStyle(PALETTE.body)
    for (const g of bodyLines) {
      if (g.bullet) {
        ctx.setFillStyle(b.color || PALETTE.gold)
        ctx.fillText('•', padX + 40, by)
        ctx.setFillStyle(PALETTE.body)
        g.lines.forEach((l, i) => ctx.fillText(l, padX + 72, by + i * lineH))
      } else {
        g.lines.forEach((l, i) => ctx.fillText(l, padX + 40, by + i * lineH))
      }
      by += g.lines.length * lineH + 8
    }

    y += boxH + blockGap
  }

  // ── 底部 QR + 文案 ──
  const footY = Math.min(H - 300, y + 24)
  roundRect(ctx, padX, footY, innerW, 240, 28)
  ctx.setFillStyle('rgba(10,12,40,0.94)')
  ctx.fill()
  ctx.setStrokeStyle(PALETTE.neon)
  ctx.setLineWidth(2)
  ctx.stroke()

  let hasQR = false
  const qrPath = o.qrPath || '/images/qrcode.png'
  roundRect(ctx, padX + 26, footY + 30, 180, 180, 18)
  ctx.setFillStyle(PALETTE.white)
  ctx.fill()
  if (qrPath) {
    try { ctx.drawImage(qrPath, padX + 38, footY + 42, 156, 156); hasQR = true } catch (e) { hasQR = false }
  }

  ctx.setTextAlign('left')
  ctx.setFontSize(34)
  ctx.setFillStyle(PALETTE.pink)
  ctx.fillText((c.footerText && c.footerText[0]) || '', padX + 240, footY + 78)
  ctx.setFontSize(28)
  ctx.setFillStyle(PALETTE.white)
  ctx.fillText((c.footerText && c.footerText[1]) || '', padX + 240, footY + 126)

  // 标签
  const tags = (c.footerTags || []).slice(0, 3)
  let tx = padX + 240
  tags.forEach((tag) => {
    const tw = ctx.measureText ? 0 : 0
    roundRect(ctx, tx, footY + 156, 176, 46, 23)
    ctx.setFillStyle('rgba(124,92,255,0.16)')
    ctx.fill()
    ctx.setStrokeStyle(PALETTE.border)
    ctx.setLineWidth(1)
    ctx.stroke()
    ctx.setFontSize(24)
    ctx.setFillStyle('#D9D6FF')
    ctx.setTextAlign('center')
    ctx.fillText(tag, tx + 88, footY + 187)
    ctx.setTextAlign('left')
    tx += 190
    void tw
  })

  return { width: W, height: H, sections: blocks.length, hasQR }
}

module.exports = { W, H, PALETTE, drawPoster, wrapText, roundRect }
