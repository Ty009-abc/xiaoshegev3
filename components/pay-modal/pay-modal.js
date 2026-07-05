Component({ options: { styleIsolation: 'apply-shared', addGlobalClass: true },
  properties: { visible: { type: Boolean, value: false }, product: { type: Object, value: {} }, loading: { type: Boolean, value: false } },
  observers: { 'visible'(v) { if (v) this.setData({ anim: true }) } },
  data: { anim: false },
  methods: {
    onPay() { if (!this.data.loading) this.triggerEvent('pay') },
    onClose() { this.setData({ anim: false }); setTimeout(() => this.triggerEvent('close'), 250) },
  },
})