/**
 * xsg-card — 统一卡片组件
 * 类型: default / premium / danger / ai
 */
Component({
  options: { styleIsolation: 'apply-shared', addGlobalClass: true },
  properties: {
    type: { type: String, value: 'default' },
    title: { type: String, value: '' },
    subtitle: { type: String, value: '' },
    clickable: { type: Boolean, value: true },
    showArrow: { type: Boolean, value: false },
    padding: { type: String, value: '32' },
    theme: { type: String, value: 'dark' },
  },
  methods: {
    onTap() { if (this.data.clickable) this.triggerEvent('tapcard') },
  },
})
