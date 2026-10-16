/**
 * RC8_14 independent staging test client — app.js (v3)
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
 *
 * v3 (RC8_14_D12_R5B): add a NORMAL-login onboarding action (`login()`) so a
 *     real test WeChat account can complete ordinary login and get a `users`
 *     record. Hard rules:
 *       - login() calls ONLY the `login` cloud function. It NEVER calls
 *         startChallenge (no challenge is created, no challenge_active session).
 *       - NO automatic retries anywhere (single attempt; a failure is surfaced,
 *         never silently re-tried).
 *       - identity stays server-derived (getWXContext); no payload identity.
 *       - all logged identity is redacted (openid form → prefix + '…').
 */
const STAGING_ENV = 'fanshen002-d9g0rjr3b6e313af5'
const APPID = 'wxd441fbf3b9f10aa3'
// Test-client-only redaction so identity never lands in logs verbatim.
const { redactOpenid } = require('./lib/preview-utils.js')

App({
  globalData: {
    stagingEnv: STAGING_ENV,
    appidPin: APPID,
    identityPresent: false,
    openid: null,
    openidMasked: '',
    appid: null,
    envVerified: false,
    identityErr: null,
    // ── normal-login onboarding (D12 R5B) ──
    loggedIn: false,
    isNewUser: null,
    loginErr: null,
    membershipLevel: null,
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('[test-client] 需要基础库 2.2.3+ 以使用云能力')
      return
    }
    // Pin to staging — explicit env, never DYNAMIC_CURRENT_ENV here, so this
    // project can never silently fall back to the official/prod env.
    wx.cloud.init({ env: STAGING_ENV, traceUser: true })
    // Identity self-check only. Deliberately NO automatic login and NO
    // startChallenge on launch (login is an explicit owner action).
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

  // ── NORMAL LOGIN ONLY (no startChallenge, no retry) ──
  // Mirrors the official client's login path (POST → `login`), so the server
  // creates/updates the `users` row for this real WeChat identity. Returns the
  // raw result; callers display it verbatim.
  async login() {
    if (!this.globalData.identityPresent) {
      return { ok: false, error: '身份未核验（请先完成身份自检）' }
    }
    this.globalData.loginErr = null
    try {
      const r = await wx.cloud.callFunction({ name: 'login', data: {} })
      const res = r && r.result
      if (res && res.code === 0 && res.data) {
        this.globalData.loggedIn = true
        this.globalData.isNewUser = !!res.data.isNewUser
        this.globalData.openid = res.data.openid || this.globalData.openid
        this.globalData.membershipLevel = (res.data.user && res.data.user.membershipLevel) || 'free'
        console.log('[test-client] login ok isNew=' + this.globalData.isNewUser +
          ' openid=' + redactOpenid(this.globalData.openid || ''))
        return { ok: true, res }
      }
      this.globalData.loginErr = (res && res.message) || 'login non-zero'
      return { ok: false, error: this.globalData.loginErr, res }
    } catch (e) {
      // Single attempt. NEVER auto-retried.
      this.globalData.loginErr = String((e && e.errMsg) || e)
      return { ok: false, error: this.globalData.loginErr }
    }
  },

  // ── RC8_14_D12_R5B_4 — EXACTLY ONE 8-way authenticated concurrency batch ──
  //   Dispatches `count` startChallenge(mode:'challenge') calls WITHOUT awaiting
  //   the previous one, collects via Promise.allSettled, and independently
  //   timestamps each dispatch and each settlement. HARD RULES:
  //     - NO automatic retries (single dispatch per slot; failures are reported);
  //     - NO submitChallengeChoice / replay / payment / entitlement calls;
  //     - identity stays server-derived (getWXContext); no client openid.
  //   Returns a sanitized, machine-readable summary; callers display it verbatim.
  async startChallengeEightWay (count, onProgress) {
    const n = Number.isInteger(count) && count > 0 ? count : 8
    if (!this.globalData.identityPresent) {
      return { ok: false, error: '身份未核验（请先完成身份自检）' }
    }
    const now = () => Date.now()
    const prog = (done, total) => { if (typeof onProgress === 'function') { try { onProgress(done, total) } catch (_) {} } }
    const slots = []
    const dispatches = []
    let settledCount = 0
    for (let i = 0; i < n; i++) {
      const dispatchTs = now()
      dispatches.push({ i, dispatchTs })
      // Each slot dispatches immediately; the loop does NOT await prior slots.
      const p = wx.cloud.callFunction({ name: 'startChallenge', data: { mode: 'challenge' } })
        .then((r) => ({ i, dispatchTs, settlementTs: now(), res: (r && r.result) || null }))
        .catch((e) => ({ i, dispatchTs, settlementTs: now(), netError: String((e && e.errMsg) || e), res: null }))
      // Per-request completion signal (does NOT add a call); collected by allSettled below.
      p.then(() => { settledCount++; prog(settledCount, n) })
      slots.push(p)
    }
    const win0 = Math.min.apply(null, dispatches.map((d) => d.dispatchTs))
    const settled = await Promise.allSettled(slots)
    // Do NOT assign one shared completion time: each record keeps its own settle ts.
    const pick = (s, i, dispatchTs) => {
      const v = (s && s.status === 'fulfilled') ? s.value : null
      if (!v || v.netError) {
        return { clientRequestIndex: i, dispatchTimestamp: dispatchTs, settlementTimestamp: now(), netError: (v && v.netError) || ('rejected:' + String(s && s.reason)), code: null, message: null, recordId: null, resumed: null, trialMode: null, currentEventIndex: null, errorCode: null, retryable: null }
      }
      const res = v.res || {}
      const d = (res && res.data) || {}
      return {
        clientRequestIndex: v.i,
        dispatchTimestamp: v.dispatchTs,
        settlementTimestamp: v.settlementTs,
        code: (res && res.code !== undefined) ? res.code : null,
        message: (res && res.message) || null,
        recordId: d.recordId || null,
        resumed: (d.resumed === undefined ? null : !!d.resumed),
        trialMode: (d.trialMode === undefined ? null : !!d.trialMode),
        currentEventIndex: (d.currentEventIndex === undefined ? null : d.currentEventIndex),
        errorCode: (res && res.code !== undefined && res.code !== 0) ? res.code : null,
        retryable: (res && res.code !== undefined && res.code !== 0 && res.code !== 401) ? true : false,
      }
    }
    const perRequest = settled.map((s, i) => pick(s, dispatches[i].i, dispatches[i].dispatchTs))
    const win1 = Math.max.apply(null, perRequest.map((r) => r.settlementTimestamp))
    // Client-side dispatch overlap: any two calls whose dispatch→settlement windows overlap.
    let clientOverlap = false
    for (let a = 0; a < perRequest.length && !clientOverlap; a++) {
      for (let b = a + 1; b < perRequest.length; b++) {
        if (perRequest[a].dispatchTimestamp < perRequest[b].settlementTimestamp && perRequest[b].dispatchTimestamp < perRequest[a].settlementTimestamp) { clientOverlap = true; break }
      }
    }
    const codes = perRequest.map((r) => r.code)
    const successIds = Array.from(new Set(perRequest.filter((r) => r.code === 0 && r.recordId).map((r) => r.recordId)))
    const summary = {
      ok: true,
      count: n,
      batchWallClockMs: win1 - win0,
      firstDispatch: win0,
      lastSettlement: win1,
      clientOverlap,
      perRequest,
      responseCodes: codes,
      successCount: perRequest.filter((r) => r.code === 0).length,
      conflictCount: perRequest.filter((r) => r.code !== 0 && r.code !== null).length,
      errorCount: perRequest.filter((r) => r.netError).length,
      successRecordIds: successIds,
    }
    console.log('[test-client] eight-way done success=' + summary.successCount + ' distinctRecordIds=' + successIds.length + ' overlap=' + clientOverlap)
    return summary
  },

  onIdentityReady(cb) {
    if (this.globalData.identityPresent || this.globalData.identityErr) cb(this.globalData)
    else this.identityReady = cb
  },
})
