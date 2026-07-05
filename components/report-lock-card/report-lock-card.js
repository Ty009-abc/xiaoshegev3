Component({ options: { styleIsolation: 'apply-shared', addGlobalClass: true },
  properties: { title: { type: String, value: '完整报告已生成' }, benefits: { type: Array, value: [] }, btnText: { type: String, value: '立即解锁' } },
  methods: { onTap() { this.triggerEvent('unlock') } },
})