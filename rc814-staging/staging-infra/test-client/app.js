/**
 * RC8_14 independent staging test client — app.js
 *
 * ⚠️ This is a SEPARATE test project. It does NOT touch the official client's
 *    default environment (fanshex-d2g0adgv7dfbc9bdc). It pins wx.cloud to the
 *    staging environment ONLY.
 *
 * Identity: uses the platform-native wx.cloud.callFunction transport, so the
 * server derives identity from cloud.getWXContext().OPENID exactly as in prod.
 * No payload openid is injected; no self-supplied header identity entry exists.
 */
const STAGING_ENV = 'fanshen002-d9g0rjr3b6e313af5'

App({
  globalData: {
    stagingEnv: STAGING_ENV,
    openid: null,
    appid: null,
    loginErr: null,
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('[test-client] 需要基础库 2.2.3+ 以使用云能力')
      return
    }
    // Pin to staging — explicit env, never DYNAMIC_CURRENT_ENV here so this
    // project can never silently fall back to the official/prod env.
    wx.cloud.init({
      env: STAGING_ENV,
      traceUser: true,
    })
    this._resolveIdentity()
  },

  async _resolveIdentity() {
    try {
      const r = await wx.cloud.callFunction({ name: 'login', data: {} })
      const res = r && r.result
      if (res && res.code === 0) {
        this.globalData.openid = res.openid || (res.data && res.data.openid) || null
        this.globalData.appid = res.appid || (res.data && res.data.appid) || null
      } else {
        this.globalData.loginErr = (res && res.message) || 'login non-zero'
      }
    } catch (e) {
      this.globalData.loginErr = String((e && e.errMsg) || e)
    }
    if (this.identityReady) this.identityReady(this.globalData)
  },

  onIdentityReady(cb) {
    if (this.globalData.openid || this.globalData.loginErr) cb(this.globalData)
    else this.identityReady = cb
  },
})
