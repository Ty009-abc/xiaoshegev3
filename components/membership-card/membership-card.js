Component({ options: { styleIsolation: 'apply-shared', addGlobalClass: true },
  properties: { product: { type: Object, value: {} }, recommended: { type: Boolean, value: false }, selected: { type: Boolean, value: false } },
  methods: { onTap() { this.triggerEvent('select') } },
})