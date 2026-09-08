Component({ options: { styleIsolation: 'apply-shared', addGlobalClass: true },
  properties: { visible: { type: Boolean, value: false }, product: { type: Object, value: {} }, loading: { type: Boolean, value: false } },
  observers: { 'visible'(v) { if (v) this.setData({ anim: true }) } },
  data: { anim: false },
  methods: {
    // FIX1: guard both `visible` and `loading` — a hidden or in-flight modal must never emit `pay`.
    onPay() { if (!this.data.visible || this.data.loading) return; this.triggerEvent('pay') },
    // FIX3: track the close timer so it can be cleared on re-open and on detach.
    onClose() {
      this.setData({ anim: false })
      if (this._closeTimer) { clearTimeout(this._closeTimer); this._closeTimer = null }
      this._closeTimer = setTimeout(() => { this._closeTimer = null; this.triggerEvent('close') }, 250)
    },
  },
  lifetimes: {
    detached() { if (this._closeTimer) { clearTimeout(this._closeTimer); this._closeTimer = null } },
  },
})