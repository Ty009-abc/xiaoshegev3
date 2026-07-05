Component({ options: { styleIsolation: 'apply-shared', addGlobalClass: true },
  properties: { visible: { type: Boolean, value: false }, title: { type: String, value: '解锁高级功能' }, permission: { type: String, value: '' }, benefits: { type: Array, value: [] }, btnText: { type: String, value: '立即解锁' } },
  methods: {
    onConfirm() { this.triggerEvent('confirm') },
    onCancel() { this.triggerEvent('cancel') },
  },
})