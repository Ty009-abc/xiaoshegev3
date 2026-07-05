Component({ options: { styleIsolation: 'apply-shared', addGlobalClass: true },
  properties: {
    cv:       { type: Number, value: 0 },
    level:    { type: Number, value: 1 },
    streak:   { type: Number, value: 0 },
    title:    { type: String, value: '认知成长' },
    levelTitle: { type: String, value: '认知探索者' },
    theme:    { type: String, value: 'dark' },
  },
  // computed data for progress bar
  observers: {
    'cv,level'(cv, level) {
      const lvTitles = [
        '', '认知探索者','思维破局者','系统思考者',
        '深度分析者','跨界洞察者','认知架构师',
        '维度穿越者','认知炼金师','觉醒者',
      ]
      const current = cv % 100
      const target = (Math.floor(cv / 100) + 1) * 100
      const nextTitle = lvTitles[(level || 1) + 1] || lvTitles[lvTitles.length - 1]
      this.setData({
        pct: Math.min(current / 100 * 100, 100),
        remain: Math.max(target - cv, 0),
        target: target,
        nextTitle: nextTitle,
      })
    }
  },
})