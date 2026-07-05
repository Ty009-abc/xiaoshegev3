Component({ options: { styleIsolation: 'apply-shared', addGlobalClass: true },
  properties: { visible: { type: Boolean, value: false }, fromLevel: { type: Number, value: 1 }, toLevel: { type: Number, value: 2 }, fromTitle: { type: String, value: '执行者' }, toTitle: { type: String, value: '认知探索者' }, message: { type: String, value: '' } },
  data: { anim: false },
  observers: { 'visible'(v) { if (v) setTimeout(() => this.setData({ anim: true }), 50); else this.setData({ anim: false }) } },
  methods: { onConfirm() { this.triggerEvent('confirm') } },
})