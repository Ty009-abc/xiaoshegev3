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

    wx.cloud.init({
      env: 'fanshex-d2g0adgv7dfbc9bdc',
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
      if (this._onReadyCallback) this._onReadyCallback()
    } catch (err) {
      console.error('[app] 启动流程异常:', err)
      setTimeout(() => this._doLogin(), 3000)
    }
  },

  onReady(callback) {
    if (this.globalData.ready) {
      callback()
    } else {
      this._onReadyCallback = callback
    }
  },
})
