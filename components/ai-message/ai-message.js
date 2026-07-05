Component({ options: { styleIsolation: 'apply-shared', addGlobalClass: true },
  properties: { role: { type: String, value: 'user' }, content: { type: String, value: '' }, loading: { type: Boolean, value: false }, showAvatar: { type: Boolean, value: true } },
})