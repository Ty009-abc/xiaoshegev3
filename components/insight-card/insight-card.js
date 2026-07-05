Component({ options: { styleIsolation: 'apply-shared', addGlobalClass: true },
  properties: { insight: { type: Object, value: {} }, showAction: { type: Boolean, value: true }, expanded: { type: Boolean, value: false } },
  methods: {
    onTap() { this.triggerEvent('expand') },
    onAction() { this.triggerEvent('completeaction') },
  },
})