/**
 * share/posters/index.js — 认知暴击海报引擎
 * 不覆盖 PageConfig.generatePoster，只注入 _neonShockPoster
 * 页面通过 this._neonShockPoster.call(this) 调用
 */

function installPoster(PageConfig) {

  /* ═══════════════════════════════════════════════
   * _neonShockPoster — 今日认知暴击海报
   * 复用 Canvas / saveToAlbum / 权限链路
   * 页面通过 this._neonShockPoster.call(this) 调用
   * ═══════════════════════════════════════════ */
  PageConfig._neonShockPoster = function () {
    const page = this
    if (!page || !page.data) {
      wx.showToast({ title: '海报调用异常', icon: 'none' })
      return
    }
    if (page.data.posterGenerating) {
      console.log('[ShockPoster] BLOCKED — already generating')
      return
    }

    console.log('[ShockPoster] 1. start')
    page.setData({ posterGenerating: true })
    wx.showLoading({ title: '正在生成认知海报...', mask: true })

    const st = page.data.strikeData || {}
    console.log('[ShockPoster] 2. data ready, core_strike:', (st.core_strike || '').substring(0, 30))

    const qrPath = page.data.qrPath || page.data.qrcodePath || ''
    console.log('[ShockPoster] 3. qrcode ready, path:', qrPath || '(none)')

    const W = 750
    const safeX = 40
    const cardW = 670
    const gap = 12

    console.log('[ShockPoster] 4. canvas ready — creating context')

    const tempCtx = wx.createCanvasContext('posterCanvas', page)

    function splitLines(ctx, text, maxWidth, fontSize) {
      ctx.setFontSize(fontSize)
      const raw = String(text || '').trim()
      if (!raw) return ['']
      const lines = []
      const chars = raw.split('')
      let line = ''
      chars.forEach(ch => {
        const test = line + ch
        if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = ch }
        else line = test
      })
      if (line) lines.push(line)
      return lines
    }

    function truncateLines(lines, maxLines) {
      if (lines.length <= maxLines) return lines
      const truncated = lines.slice(0, maxLines)
      const last = truncated[truncated.length - 1]
      truncated[truncated.length - 1] = last.replace(/.{1,3}$/, '……')
      return truncated
    }

    // 卡片数据
    const cards = [
      { icon: '💥', title: '今日认知暴击', text: st.core_strike, color: '#ff3b3b', maxLines: 10, labelColor: '#ff3b3b' },
      { icon: '🔍', title: '底层逻辑拆解', text: st.logic_dissection, color: '#ff6b3d', maxLines: 9, labelColor: '#ff6b3d' },
      { icon: '↔', title: '反方向推理', text: st.reverse_inference, color: '#ff9f1a', maxLines: 9, labelColor: '#ff9f1a' },
      { icon: '🎯', title: '翻身行动建议', text: st.action_advice, color: '#39d353', maxLines: 7, labelColor: '#39d353' },
    ]

    // 计算每个卡片
    const cardLayouts = cards.map((c, i) => {
      const lines = splitLines(tempCtx, c.text, cardW - 72, 26)
      const capped = truncateLines(lines, c.maxLines)
      const h = 66 + capped.length * 50 + 16
      return { ...c, _lines: capped, _height: h, _idx: String(i + 1).padStart(2, '0') }
    })

    const headerH = 180
    const cardsSum = cardLayouts.reduce((s, c) => s + c._height, 0)
    const cardsGap = gap * (cardLayouts.length - 1)
    const ctaH = 150
    const H = headerH + cardsSum + cardsGap + 24 + ctaH + 48

    page.setData({ posterHeight: H }, function () {
      wx.nextTick(function () { _drawShockPoster.call(page, H) })
    })

    function _drawShockPoster(H) {
      const ctx = wx.createCanvasContext('posterCanvas', this)

      function roundRect(x, y, w, h, r) {
        ctx.beginPath()
        ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
        ctx.quadraticCurveTo(x + w, y, x + w, y + r)
        ctx.lineTo(x + w, y + h - r)
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
        ctx.lineTo(x + r, y + h)
        ctx.quadraticCurveTo(x, y + h, x, y + h - r)
        ctx.lineTo(x, y + r)
        ctx.quadraticCurveTo(x, y, x + r, y)
        ctx.closePath()
      }

      function drawGlow(x, y, r, color, alpha) {
        const g = ctx.createCircularGradient(x, y, r)
        g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.setGlobalAlpha(alpha); ctx.setFillStyle(g)
        ctx.fillRect(x - r, y - r, r * 2, r * 2)
        ctx.setGlobalAlpha(1)
      }

      function drawLines(lines, x, y, lineHeight, color, fontSize) {
        ctx.setTextAlign('left'); ctx.setFontSize(fontSize); ctx.setFillStyle(color)
        lines.forEach((l, i) => { ctx.fillText(l, x, y + i * lineHeight) })
      }

      // 背景
      ctx.setFillStyle('#070614'); ctx.fillRect(0, 0, W, H)
      drawGlow(200, 120, 250, '#ff2d55', 0.22)
      drawGlow(580, 100, 250, '#ff6b3d', 0.16)
      drawGlow(375, H - 200, 300, '#8b3cff', 0.14)

      // Header
      ctx.setTextAlign('center')
      ctx.setFontSize(32); ctx.setFillStyle('#ffffff')
      ctx.fillText('珠澳小事哥 · 认知操作系统', W / 2, 58)
      ctx.setFontSize(44); ctx.setFillStyle('#ff2d55')
      ctx.fillText('💥 今日认知暴击', W / 2, 118)
      ctx.setFontSize(24); ctx.setFillStyle('#ff5ca8')
      ctx.fillText('一句话，击穿一个认知盲区', W / 2, 152)
      ctx.setStrokeStyle('rgba(255,45,85,0.4)'); ctx.setLineWidth(1)
      ctx.beginPath(); ctx.moveTo(72, 172); ctx.lineTo(678, 172); ctx.stroke()

      // Cards
      let y = headerH
      cardLayouts.forEach(c => {
        const h = c._height
        roundRect(safeX, y, cardW, h, 16)
        ctx.setFillStyle('rgba(8,14,32,0.93)'); ctx.fill()
        ctx.setStrokeStyle(c.color); ctx.setLineWidth(1.6); ctx.stroke()

        ctx.setTextAlign('left')
        ctx.setFontSize(26); ctx.setFillStyle(c.labelColor)
        ctx.fillText(c.icon + ' ' + c.title, safeX + 32, y + 36)
        ctx.setTextAlign('center')
        ctx.setFontSize(22); ctx.setFillStyle(c.labelColor)
        ctx.fillText(c._idx, safeX + cardW - 44, y + 36)
        ctx.setTextAlign('left')
        drawLines(c._lines, safeX + 28, y + 72, 50, '#eaf0ff', 26)

        y += h + gap
      })

      // CTA
      const ctaY = y + 24
      const qrSize = 110
      const qrX = safeX + 18
      const qrY = ctaY + 20
      const textColX = safeX + qrSize + 60

      roundRect(safeX, ctaY, cardW, ctaH, 24)
      ctx.setFillStyle('rgba(10,12,40,0.96)'); ctx.fill()
      ctx.setStrokeStyle('#ff2d55'); ctx.setLineWidth(2); ctx.stroke()

      roundRect(qrX, qrY, qrSize, qrSize, 18)
      ctx.setFillStyle('#ffffff'); ctx.fill()
      if (qrPath) {
        try { ctx.drawImage(qrPath, qrX + 9, qrY + 9, 92, 92) } catch (e) {}
      } else {
        ctx.setTextAlign('center'); ctx.setFontSize(18); ctx.setFillStyle('#999')
        ctx.fillText('长按识别', qrX + qrSize / 2, qrY + qrSize / 2 - 4)
        ctx.fillText('进入小程序', qrX + qrSize / 2, qrY + qrSize / 2 + 16)
      }

      ctx.setTextAlign('left')
      ctx.setFontSize(30); ctx.setFillStyle('#ff45c8')
      ctx.fillText('💥 每日认知暴击', textColX, qrY + 38)
      ctx.setFontSize(24); ctx.setFillStyle('#ffffff')
      ctx.fillText('看见自己的认知盲区', textColX, qrY + 74)

      const tags = ['🧠 认知升级', '⚡ 底层逻辑', '🎯 翻身建议']
      tags.forEach((tag, i) => {
        const tx = textColX + i * 148; const ty = qrY + 94
        roundRect(tx, ty, 128, 26, 13)
        ctx.setFillStyle('rgba(255,45,85,0.18)'); ctx.fill()
        ctx.setStrokeStyle('rgba(255,100,130,0.75)'); ctx.setLineWidth(1); ctx.stroke()
        ctx.setTextAlign('center'); ctx.setFontSize(17); ctx.setFillStyle('#ffdce5')
        ctx.fillText(tag, tx + 64, ty + 19)
      })

      ctx.draw(false, function () {
        console.log('[ShockPoster] 6. draw complete')
        setTimeout(function () {
          wx.canvasToTempFilePath({
            canvasId: 'posterCanvas',
            x: 0, y: 0, width: W, height: H,
            destWidth: W * 2, destHeight: H * 2,
            success: function (res) {
              console.log('[ShockPoster] 7. export complete, tempFilePath:', res.tempFilePath)
              page.setData({ posterPath: res.tempFilePath, showPoster: true }, function () {
                console.log('[ShockPoster] 8. preview opened, showPoster:', page.data.showPoster)
                wx.hideLoading()
                page.setData({ posterGenerating: false })
                setTimeout(function () {
                  const rectQuery = wx.createSelectorQuery().in(page)
                  rectQuery.select('.poster-backdrop.show').boundingClientRect(function (rect) {
                    if (!rect) {
                      console.log('[ShockPoster] backdrop NOT FOUND, using previewImage fallback')
                      wx.previewImage({ current: res.tempFilePath, urls: [res.tempFilePath] })
                    }
                  }).exec()
                }, 500)
              })
            },
            fail: function (err) {
              console.error('[ShockPoster] 7. EXPORT FAILED:', JSON.stringify(err))
              console.error('[ShockPoster]   errMsg:', err.errMsg)
              wx.hideLoading()
              page.setData({ posterGenerating: false })
              wx.showModal({
                title: '海报生成失败',
                content: err.errMsg || 'Canvas输出异常，请重试',
                showCancel: false
              })
            },
            complete: function () {
              console.log('[ShockPoster] canvasToTempFilePath — complete')
            }
          }, page)
        }, 300)
      })
    }
  }

  return PageConfig
}

module.exports = { installPoster }
