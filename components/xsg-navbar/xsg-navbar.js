Component({ options: { styleIsolation: 'apply-shared', addGlobalClass: true },
  properties: {
    title: { type: String, value: '珠澳小事哥' },
    showBack: { type: Boolean, value: false },
    transparent: { type: Boolean, value: false },
    light: { type: Boolean, value: false },
  },
  data: {
    // RC8_13_P1_SAFE_AREA — dynamic top inset (px) from the platform status bar.
    // Never a hard-coded single-device value; falls back to env() when unknown.
    padTop: '',
  },
  lifetime: {
    attached() { this._computeTopInset() },
  },
  attached() { this._computeTopInset() },
  methods: {
    onBack() { this.triggerEvent('back') },
    // Compute the status-bar top inset so the custom navbar clears the system
    // status bar on BOTH Android (env()=0) and iOS. Prefer the platform-provided
    // statusBarHeight (px); fall back to the CSS env() token.
    _computeTopInset() {
      try {
        const info = (typeof wx.getWindowInfo === 'function')
          ? wx.getWindowInfo()
          : (wx.getSystemInfoSync ? wx.getSystemInfoSync() : null)
        const sbh = info && Number(info.statusBarHeight)
        if (sbh && sbh > 0) { this.setData({ padTop: sbh + 'px' }); return }
      } catch (_) {}
      this.setData({ padTop: 'env(safe-area-inset-top)' })
    },
  },
})
