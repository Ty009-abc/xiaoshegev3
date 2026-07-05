Component({
  options: { styleIsolation: 'apply-shared', addGlobalClass: true },
  properties: {
    type: { type: String, value: 'primary' },
    text: { type: String, value: '' },
    loading: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false },
    size: { type: String, value: 'default' },
    block: { type: Boolean, value: true },
  },
  methods: {
    onTap() { if (!this.data.disabled && !this.data.loading) this.triggerEvent('tapbutton') },
  },
})
