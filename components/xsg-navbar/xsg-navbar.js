Component({ options: { styleIsolation: 'apply-shared', addGlobalClass: true },
  properties: {
    title: { type: String, value: '珠澳小事哥' },
    showBack: { type: Boolean, value: false },
    transparent: { type: Boolean, value: false },
    light: { type: Boolean, value: false },
  },
  methods: { onBack() { this.triggerEvent('back') } },
})