Component({ options: { styleIsolation: 'apply-shared', addGlobalClass: true },
  properties: { rule: { type: Object, value: {} }, locked: { type: Boolean, value: false } },
  methods: {
    onTap() { if (!this.data.locked) this.triggerEvent('openrule') },
  },
})