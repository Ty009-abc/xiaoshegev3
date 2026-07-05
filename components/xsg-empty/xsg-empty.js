Component({ options: { styleIsolation: 'apply-shared', addGlobalClass: true },
  properties: { icon: { type: String, value: '📭' }, title: { type: String, value: '暂无内容' }, desc: { type: String, value: '' }, btnText: { type: String, value: '' } },
  methods: { onBtn() { this.triggerEvent('action') } },
})