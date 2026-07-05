Component({ options: { styleIsolation: 'apply-shared', addGlobalClass: true },
  properties: { icon: { type: String, value: '⚠️' }, title: { type: String, value: '系统暂时看不清这个世界' }, desc: { type: String, value: '请稍后再试' }, btnText: { type: String, value: '重试' } },
  methods: { onRetry() { this.triggerEvent('retry') } },
})