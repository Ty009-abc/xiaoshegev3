/**
 * pages/admin/settings - 系统配置
 */
const adminService = require('../../../services/adminService.js')

const CONFIG_KEYS = [
  { key: 'paymentEnabled', label: '支付开关', type: 'bool' },
  { key: 'challengeEnabled', label: '挑战开关', type: 'bool' },
  { key: 'dailyInsightEnabled', label: '每日暴击开关', type: 'bool' },
  { key: 'vipEnabled', label: '会员开关', type: 'bool' },
  { key: 'freeAiCount', label: '免费AI次数/日', type: 'number' },
  { key: 'trialChallengeCount', label: '试玩题数', type: 'number' },
  { key: 'aiModel', label: 'AI模型', type: 'text' },
  { key: 'maintenanceMode', label: '维护模式', type: 'bool' },
]

Page({
  data: { configs: CONFIG_KEYS, config: {}, loading: true, saving: false },
  onLoad() {
    this.fetchConfig()
  },
  async fetchConfig() {
    this.setData({ loading: true })
    try {
      const db = wx.cloud.database()
      const res = await db.collection('system_configs').where({ key: 'app_config', status: 'active' }).limit(1).get()
      if (res.data[0]) { this.setData({ config: res.data[0].value || {}, loading: false }) }
      else { this.setData({ loading: false }) }
    } catch (_) { this.setData({ loading: false }) }
  },
  onToggle(e) {
    const { key } = e.currentTarget.dataset
    const val = !this.data.config[key]
    adminService.updateSystemConfig(key, val).then(() => {
      this.setData({ ['config.' + key]: val })
      wx.showToast({ title: '已更新', icon: 'success' })
    })
  },
  async onSaveNumber(e) {
    const { key } = e.currentTarget.dataset
    const val = parseInt(e.detail.value, 10)
    if (isNaN(val) || val < 0) { wx.showToast({ title: '请输入有效数字', icon: 'none' }); return }
    const r = await adminService.updateSystemConfig(key, val)
    if (r.code === 0) { this.setData({ ['config.' + key]: val }); wx.showToast({ title: '已更新', icon: 'success' }) }
    else wx.showToast({ title: r.message, icon: 'none' })
  },
  async onSaveText(e) {
    const { key } = e.currentTarget.dataset
    const val = e.detail.value.trim()
    if (!val) { wx.showToast({ title: '不能为空', icon: 'none' }); return }
    const r = await adminService.updateSystemConfig(key, val)
    if (r.code === 0) { this.setData({ ['config.' + key]: val }); wx.showToast({ title: '已更新', icon: 'success' }) }
    else wx.showToast({ title: r.message, icon: 'none' })
  },
})
