/**
 * pages/admin/content - 内容管理
 */
const adminService = require('../../../services/adminService.js')

const COLLECTIONS = [
  { key: 'daily_insights', label: '认知暴击' },
  { key: 'world_rules', label: '世界规则' },
  { key: 'challenge_events', label: '挑战题库' },
]

Page({
  data: { list: [], collections: COLLECTIONS, activeCol: 'daily_insights', loading: false, showForm: false, editingDoc: null },
  onLoad() { this.load() },
  async load() {
    this.setData({ loading: true })
    try {
      // 直接读集合内容（管理端专用）
      const db = wx.cloud.database()
      const res = await db.collection(this.data.activeCol).limit(100).get()
      this.setData({ list: res.data, loading: false })
    } catch (_) { this.setData({ loading: false }) }
  },
  onTab(e) { this.setData({ activeCol: e.currentTarget.dataset.col }, () => this.load()) },
  onAdd() { this.setData({ showForm: true, editingDoc: null }) },
  onEdit(e) { this.setData({ showForm: true, editingDoc: e.currentTarget.dataset.doc }) },
  async onSave(e) {
    const d = e.detail.value
    if (!d.title && !d.rule && !d.question) { wx.showToast({ title: '请填写必要字段', icon: 'none' }); return }
    try {
      if (this.data.editingDoc) {
        const { _id, ...rest } = this.data.editingDoc
        await adminService.manageContent(this.data.activeCol, 'update', { ...rest, ...d }, _id)
      } else {
        await adminService.manageContent(this.data.activeCol, 'create', d, '')
      }
      this.setData({ showForm: false, editingDoc: null })
      this.load()
    } catch (e) { wx.showToast({ title: '保存失败', icon: 'none' }) }
  },
  async onDisable(e) {
    await adminService.manageContent(this.data.activeCol, 'disable', {}, e.currentTarget.dataset.id)
    this.load()
  },
  async onEnable(e) {
    await adminService.manageContent(this.data.activeCol, 'enable', {}, e.currentTarget.dataset.id)
    this.load()
  },
  onCancel() { this.setData({ showForm: false, editingDoc: null }) },
})
