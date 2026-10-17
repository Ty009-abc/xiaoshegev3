/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * app.js
 *
 * 启动流程:
 *   1. 初始化云开发
 *   2. splash → onboarding（首次）→ home
 *   3. 调用 login 云函数
 *   4. 保存 user / profile / permissions 到 globalData
 *   5. 拉取系统配置
 */

// RC8.9B — 用户行为埋点（best-effort，绝不阻塞主流程）
const userTrack = require('./utils/userTrack.js')

// RC814 — 云端环境由构建目标决定（禁止硬编码）。解析失败即拒绝启动。
const cloudEnv = require('./config/cloudEnv.js')

App({
  globalData: {
    openid: '',
    user: null,
    profile: null,
    userInfo: {},     // UI 层统一别名
    permissions: [],
    isVip: false,
    isNewUser: false,
    configs: {},
    ready: false,
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }

    // ═══ 调试浮层：trial/release 环境强制关闭 ═══
    try {
      var envVersion = (typeof __wxConfig !== 'undefined' && __wxConfig.envVersion) || 'develop'
      if (envVersion === 'trial' || envVersion === 'release') {
        if (typeof wx.setEnableDebug === 'function') {
          wx.setEnableDebug({ enableDebug: false })
        }
      }
    } catch (_) {}

    // ═══ RC814 环境解析（fail closed）═══
    // 构建目标来自 config/cloudEnv.generated.js，只允许 production / staging。
    // 任何未知或缺失的目标都会抛错，此时【绝不】调用 wx.cloud.init，
    // 以免请求被静默路由到非预期环境。
    let resolvedEnv
    try {
      resolvedEnv = cloudEnv.resolveCloudEnv()
    } catch (e) {
      console.error('[app] 云端环境解析失败，已拒绝启动:', e && e.message)
      this.globalData.envError = (e && e.message) || 'CLOUD_ENV_UNRESOLVED'
      this.globalData.ready = false
      this._showEnvError()
      return
    }

    this.globalData.cloudEnvTarget = resolvedEnv.target
    this.globalData.cloudEnvId = resolvedEnv.envId
    console.log('[app] 云端环境: target=' + resolvedEnv.target)

    wx.cloud.init({
      env: resolvedEnv.envId,
      traceUser: true,
    })

    this._doLogin()
  },

  async _doLogin() {
    try {
      const loginResult = await wx.cloud.callFunction({
        name: 'login',
        data: {},
      }).then(res => res.result)

      if (loginResult.code !== 0) {
        console.error('[app] 登录失败:', loginResult.message)
        setTimeout(() => this._doLogin(), 2000)
        return
      }

      const { user, profile, isNewUser, openid } = loginResult.data

      this.globalData.openid = openid
      this.globalData.user = user
      this.globalData.profile = profile
      this.globalData.userInfo = user   // UI 别名
      this.globalData.isNewUser = isNewUser
      this.globalData.isVip = user.membershipLevel !== 'free'

      console.log(`[app] 登录成功 openid=${openid} isNew=${isNewUser} member=${user.membershipLevel}`)

      // 获取会员权限
      try {
        const memberResult = await wx.cloud.callFunction({
          name: 'getMembership',
          data: {},
        }).then(res => res.result)

        if (memberResult.code === 0 && memberResult.data) {
          this.globalData.permissions = memberResult.data.permissions || []
          this.globalData.isVip = memberResult.data.isActive
        }
      } catch (e) {
        console.warn('[app] getMembership 失败, 使用默认权限:', e.message)
        this.globalData.permissions = ['daily_insight_read']
      }

      // 获取系统配置
      try {
        const configResult = await wx.cloud.callFunction({
          name: 'getSystemConfig',
          data: {},
        }).then(res => res.result)

        if (configResult.code === 0 && configResult.data) {
          this.globalData.configs = configResult.data.configs || {}
        }
      } catch (e) {
        console.warn('[app] getSystemConfig 失败:', e.message)
      }

      this.globalData.ready = true
      // RC8.9B — app_open（best-effort，登录成功后）
      try { userTrack.event('app_open', { isNewUser: !!isNewUser, membershipLevel: user.membershipLevel || 'free' }) } catch (_) {}
      if (this._onReadyCallback) this._onReadyCallback()
    } catch (err) {
      console.error('[app] 启动流程异常:', err)
      setTimeout(() => this._doLogin(), 3000)
    }
  },

  /**
   * RC814 — 环境解析失败时的用户可见兜底。
   * 不发起任何云调用，不重试，只提示用户升级到正确版本。
   */
  _showEnvError() {
    try {
      wx.showModal({
        title: '版本异常',
        content: '当前版本未配置正确的云端环境，请升级到最新版本后重试。',
        showCancel: false,
      })
    } catch (_) {}
  },

  onReady(callback) {
    if (this.globalData.ready) {
      callback()
    } else {
      this._onReadyCallback = callback
    }
  },
})
