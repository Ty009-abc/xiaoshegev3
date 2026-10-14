/**
 * RC8_14 independent staging test client — app.js (v2)
 *
 * ⚠️ SEPARATE test project. It never touches the official client's default env
 *    (fanshex-d2g0adgv7dfbc9bdc). wx.cloud is pinned to staging ONLY.
 *
 * Identity: resolved via the platform-native wx.cloud.callFunction transport, so
 * the server derives it from cloud.getWXContext().OPENID exactly as in prod.
 * No payload openid; no self-supplied header identity entry.
 *
 * v2: identity self-check uses the staging-only `stagingIdentityProbe` so that
 *     identity verification is INDEPENDENT of login/startChallenge succeeding.
 */
const STAGING_ENV = 'fanshen002-d9g0rjr3b6e313af5'

App({
  globalData: {
    stagingEnv: STAGING_ENV,
    identityPresent: false,
    openid: null,
    openidMasked: '',
    appid: null,
    envVerified: false,
    identityErr: null,
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('[test-client] 需要基础库 2.2.3+ 以使用云能力')
      return
    }
    // Pin to staging — explicit env, never DYNAMIC_CURRENT_ENV here, so this
    // project can never silently fall back to the official/prod env.
    wx.cloud.init({ env: STAGING_ENV, traceUser: true })
    this._resolveIdentity()
  },

  // Independent, server-verified identity self-check (no business function needed).
  async _resolveIdentity() {
    try {
      const r = await wx.cloud.callFunction({ name: 'stagingIdentityProbe', data: {} })
      const res = r && r.result
      if (res && res.code === 0 && res.data && res.data.identityPresent) {
        this.globalData.identityPresent = true
        this.globalData.openid = res.data.openid || null
        this.globalData.openidMasked = res.data.openidMasked || ''
        this.globalData.appid = res.data.appid || null
        this.globalData.envVerified = !!res.data.envVerified
      } else {
        this.globalData.identityErr = (res && res.message) || 'probe non-zero'
      }
    } catch (e) {
      this.globalData.identityErr = String((e && e.errMsg) || e)
    }
    if (this.identityReady) this.identityReady(this.globalData)
  },

  onIdentityReady(cb) {
    if (this.globalData.identityPresent || this.globalData.identityErr) cb(this.globalData)
    else this.identityReady = cb
  },
})
