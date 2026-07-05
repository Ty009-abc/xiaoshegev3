/**
 * ai-generating — AI 生成等待组件
 * 文案轮播 + 假进度条
 */
Component({ options: { styleIsolation: 'apply-shared', addGlobalClass: true },
  properties: { visible: { type: Boolean, value: false } },
  data: {
    texts: [
      '小事哥正在拆解你的世界模型...',
      '正在识别你的认知漏洞...',
      '正在计算你的翻身概率...',
      '正在生成未来30天行动建议...',
      '正在匹配最优成长路径...',
      '最后校准...',
    ],
    currentText: '',
    index: 0,
    progress: 0,
    timer: null,
    fakeTimer: null,
  },
  lifetimes: {
    attached() {
      this.setData({ currentText: this.data.texts[0] })
    },
    detached() { this.stopAll() },
  },
  methods: {
    start() {
      this.stopAll()
      this.setData({ progress: 0, index: 0, currentText: this.data.texts[0] })

      // 文案轮播
      const t = setInterval(() => {
        let i = this.data.index + 1
        if (i >= this.data.texts.length) i = 0
        this.setData({ index: i, currentText: this.data.texts[i] })
      }, 1800)
      this.data.timer = t

      // 假进度
      this._fakeProgress()
    },
    _fakeProgress() {
      const step = () => {
        let p = this.data.progress
        if (p < 60) p += 8
        else if (p < 85) p += 3
        else if (p < 92) p += 1
        if (p > 92) p = 92
        this.setData({ progress: p })

        if (!this.data.stopped && p < 92) {
          this.data.fakeTimer = setTimeout(step, p < 60 ? 300 : 600)
        }
      }
      step()
    },
    finish() {
      this.stopAll()
      this.setData({ progress: 100 })
      setTimeout(() => this.triggerEvent('done'), 400)
    },
    stopAll() {
      clearInterval(this.data.timer)
      clearTimeout(this.data.fakeTimer)
      this.data.stopped = true
    },
  },
})
