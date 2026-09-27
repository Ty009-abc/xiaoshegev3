/**
 * pages/admin/admins — RC8.9C 管理员管理（RBAC）
 *
 * 展示管理员列表 + 审计日志。角色/权限变更的服务端权威在 adminUpsertAdmin。
 * 客户端仅负责展示与发起请求；UI 隐藏不构成安全控制。
 */
const adminService = require('../../../services/adminService.js')

const ROLE_NAME = { SUPER_ADMIN: '超级管理员', OPERATOR: '运营', ANALYST: '分析师', SUPPORT: '客服' }
const AUDIT_LABEL = {
  ADMIN_CREATED: '新增管理员', ADMIN_ROLE_CHANGED: '修改角色', ADMIN_DISABLED: '禁用管理员',
  ADMIN_ENABLED: '启用管理员', PERMISSION_CHANGED: '修改权限', USER_DETAIL_VIEWED: '查看用户详情',
  admin_login: '管理员登录',
}

function fmt(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

Page({
  data: {
    loading: true, error: '', list: [], audit: [],
    callerRole: '', canManage: false,
    roleName: ROLE_NAME, auditLabel: AUDIT_LABEL,
  },
  onLoad() { this.fetch() },
  onPullDownRefresh() { this.fetch().finally(() => wx.stopPullDownRefresh()) },
  async fetch() {
    this.setData({ loading: true, error: '' })
    try {
      const [r, a] = await Promise.all([
        adminService.listAdmins(),
        adminService.getAuditLogs({ pageSize: 20 }),
      ])
      if (r.code !== 0) { this.setData({ error: r.message || '加载失败' }); return }
      const callerRole = r.data.callerRole
      this.setData({
        list: r.data.list || [],
        callerRole: ROLE_NAME[callerRole] || callerRole,
        // 仅 SUPER_ADMIN 具备 admin:create/admin:update 才展示管理入口
        canManage: callerRole === 'SUPER_ADMIN',
        audit: (a.code === 0 && a.data && a.data.list) || [],
      })
    } catch (_) {
      this.setData({ error: '网络异常，请重试' })
    } finally {
      this.setData({ loading: false })
    }
  },
  onCreate() {
    wx.showActionSheet({
      itemList: ['运营', '分析师', '客服', '超级管理员'],
      success: (res) => {
        const roles = ['OPERATOR', 'ANALYST', 'SUPPORT', 'SUPER_ADMIN']
        const role = roles[res.tapIndex]
        wx.showModal({
          title: '新增管理员',
          editable: true,
          placeholderText: '请输入对方 OpenID',
          success: (m) => {
            if (!m.confirm || !m.content) return
            this._upsert('create', m.content.trim(), role)
          },
        })
      },
    })
  },
  onManage(e) {
    const { openid, role, status } = e.currentTarget.dataset
    const items = status === 'ACTIVE'
      ? ['修改角色', '禁用管理员']
      : ['修改角色', '启用管理员']
    wx.showActionSheet({
      itemList: items,
      success: (res) => {
        if (res.tapIndex === 1) {
          this._upsert(status === 'ACTIVE' ? 'disable' : 'enable', openid)
          return
        }
        wx.showActionSheet({
          itemList: ['运营', '分析师', '客服', '超级管理员'],
          success: (r2) => {
            const roles = ['OPERATOR', 'ANALYST', 'SUPPORT', 'SUPER_ADMIN']
            this._upsert('update', openid, roles[r2.tapIndex])
          },
        })
      },
    })
  },
  async _upsert(action, openid, role) {
    const label = action === 'create' ? '新增' : action === 'update' ? '修改角色' : action === 'disable' ? '禁用' : '启用'
    const confirm = await new Promise((res) => wx.showModal({ title: '确认', content: `确定${label}该管理员？`, success: (m) => res(m.confirm) }))
    if (!confirm) return
    try {
      const r = await adminService.upsertAdmin(action, openid, role)
      if (r.code !== 0) {
        wx.showToast({ title: r.message || '操作失败', icon: 'none' })
        return
      }
      wx.showToast({ title: '已更新', icon: 'success' })
      this.fetch()
    } catch (_) {
      wx.showToast({ title: '网络异常', icon: 'none' })
    }
  },
})
