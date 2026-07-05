Component({ options: { styleIsolation: 'apply-shared', addGlobalClass: true },
  properties: { choiceKey: { type: String, value: 'A' }, text: { type: String, value: '' }, selected: { type: Boolean, value: false }, disabled: { type: Boolean, value: false }, submitted: { type: Boolean, value: false } },
  methods: {
    onTap() { if (!this.data.disabled && !this.data.submitted) this.triggerEvent('select', { key: this.data.choiceKey }) },
  },
})