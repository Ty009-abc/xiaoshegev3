/**
 * utils/radarChart.js
 *
 * PAYMENT_STAGE5A_R9_CHALLENGE_RESULT_VISUAL_UPGRADE — 纯前端雷达图渲染器.
 *
 * 选型：小程序原生 Canvas 2D 绘制（wx.createCanvasContext 兼容 API）。
 *   采用原生绘制而不是引入 Chart.js：Chart.js 依赖 DOM/React 式测量，
 *   在小程序端适配层维护成本高、包体大、首屏有白屏风险。原生绘制
 *   无依赖、可控、60fps 友好，符合“稳定性优先”的要求。
 *
 * 本模块：纯函数，无副作用，无网络、无 DB、无 AI。
 * 只负责把 (ctx, 数据, 进度) 画成一个多边形雷达图；调用方负责
 * 获取 canvas 尺寸并在每帧后调用 ctx.draw()。
 *
 * @version world_model_radar_v1
 */

const RADAR_TOKENS = Object.freeze({
  levels: 3,               // 网格环数（不含中心）
  max: 100,                // 分值上限
  startAngle: -Math.PI / 2, // 第一个轴指向正上方
  labelGap: 16,            // 标签距最外环的像素距离
  labelFont: 11,
  colors: {
    ring: 'rgba(123, 97, 255, 0.14)',
    axis: 'rgba(123, 97, 255, 0.18)',
    fill: 'rgba(123, 97, 255, 0.20)',
    fillAlt: 'rgba(217, 75, 255, 0.16)',
    stroke: '#7B61FF',
    point: '#D94BFF',
    label: '#5A6485',
  },
})

/**
 * 构建雷达数据点。缺值兜底 50（与结果页归一化一致），绝不编造。
 * @param {object} profile  九维分数字典
 * @param {string[]} keys   维度顺序
 * @param {object} labels   维度中文名
 * @returns {{label:string, value:number}[]}
 */
function buildRadarData (profile, keys, labels) {
  if (!Array.isArray(keys)) return []
  return keys.map((k) => ({
    label: (labels && labels[k]) || k,
    value: (profile && typeof profile[k] === 'number') ? profile[k] : 50,
  }))
}

/**
 * 在给定 canvas 上下文绘制雷达图。
 * @param {object} ctx     wx.createCanvasContext(...) 返回的上下文
 * @param {object} options { width, height, cx?, cy?, radius?, data, progress? }
 */
function drawRadar (ctx, options) {
  const o = Object.assign({}, RADAR_TOKENS, options || {})
  const width = o.width, height = o.height, data = o.data
  if (!ctx || !width || !height || !Array.isArray(data) || data.length < 3) return

  const n = data.length
  const cx = (o.cx != null) ? o.cx : width / 2
  const cy = (o.cy != null) ? o.cy : height / 2
  const radius = (o.radius != null) ? o.radius : Math.min(width, height) / 2 - (o.labelGap + o.labelFont)
  if (radius <= 0) return
  const t = (typeof o.progress === 'number') ? Math.max(0, Math.min(1, o.progress)) : 1
  const max = o.max

  const angleAt = (i) => o.startAngle + (Math.PI * 2 * i) / n
  const pointAt = (i, r) => ({ x: cx + Math.cos(angleAt(i)) * r, y: cy + Math.sin(angleAt(i)) * r })

  // ── 网格环 ──
  for (let lv = 1; lv <= o.levels; lv++) {
    const r = (radius * lv) / o.levels
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const p = pointAt(i, r)
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y)
    }
    ctx.closePath()
    ctx.setStrokeStyle(o.colors.ring)
    ctx.setLineWidth(1)
    ctx.stroke()
  }

  // ── 轴 + 维度标签 ──
  ctx.setFontSize(o.labelFont)
  for (let i = 0; i < n; i++) {
    const p = pointAt(i, radius)
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(p.x, p.y)
    ctx.setStrokeStyle(o.colors.axis)
    ctx.setLineWidth(1)
    ctx.stroke()

    const lp = pointAt(i, radius + o.labelGap)
    ctx.setFillStyle(o.colors.label)
    ctx.setTextAlign(Math.abs(lp.x - cx) < 0.5 ? 'center' : (lp.x > cx ? 'left' : 'right'))
    ctx.setTextBaseline(Math.abs(lp.y - cy) < 0.5 ? 'middle' : (lp.y > cy ? 'top' : 'bottom'))
    ctx.fillText(String(data[i].label), lp.x, lp.y)
  }

  // ── 数据多边形（按 progress 从中心展开） ──
  const pts = []
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, Math.min(max, Number(data[i].value) || 0))
    const r = (radius * v / max) * t
    const p = pointAt(i, r)
    pts.push(p)
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y)
  }
  ctx.closePath()
  ctx.setFillStyle(o.colors.fill)
  ctx.fill()
  ctx.setStrokeStyle(o.colors.stroke)
  ctx.setLineWidth(2)
  ctx.stroke()

  // ── 顶点 ──
  for (let i = 0; i < n; i++) {
    ctx.beginPath()
    ctx.arc(pts[i].x, pts[i].y, 2.6, 0, Math.PI * 2)
    ctx.setFillStyle(o.colors.point)
    ctx.fill()
  }
}

// 缓动：easeOutCubic —— 让“展开”收尾更柔和
function easeOutCubic (x) {
  const c = 1 - Math.max(0, Math.min(1, x))
  return 1 - c * c * c
}

module.exports = {
  RADAR_TOKENS,
  buildRadarData,
  drawRadar,
  easeOutCubic,
}
