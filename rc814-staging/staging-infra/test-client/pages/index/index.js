/**
 * RC8_14 independent staging test client — index page (v2)
 *
 * Thin harness over the 3 challenge functions + the staging-only identity probe.
 * Identity is server-derived (getWXContext().OPENID). No payload openid; no
 * header identity entry.
 *
 * v2 fixes (RC8_14 Part 五):
 *   - identity self-check is its OWN step (stagingIdentityProbe) and is
 *     INDEPENDENT of whether startChallenge succeeds;
 *   - a failed start shows the explicit reason (code + message + data);
 *   - get/submit buttons are DISABLED until a non-empty recordId/event exists;
 *   - submit button text no longer overflows;
 *   - every log line carries an explicit timezone offset.
 */
const STAGING_ENV = 'fanshen002-d9g0rjr3b6e313af5'

// RC8_14_D10_R4 — shared (test-client-only) parsing + redaction helpers.
const { redactOpenid, redactJson, parseSubmitResponse, fmtFlag } = require('../../lib/preview-utils.js')

// Local wall-clock with explicit UTC offset — never an ambiguous bare time.
function stamp () {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const offMin = -d.getTimezoneOffset()
  const sign = offMin >= 0 ? '+' : '-'
  const off = sign + p(Math.floor(Math.abs(offMin) / 60)) + ':' + p(Math.abs(offMin) % 60)
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
    p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + ' UTC' + off
}

Page({
  data: {
    stagingEnv: STAGING_ENV,
    // identity self-check (independent of startChallenge)
    identityChecked: false,
    identityOk: false,
    identityStatus: '未自检',
    openid: '',
    openidMasked: '',
    appid: '',
    envVerified: false,
    // ── normal-login onboarding (D12 R5B) — login ONLY, never startChallenge ──
    loginBusy: false,
    loginOk: false,
    loginStatus: '未登录',
    isNewUser: null,
    membershipLevel: '',
    // start
    startStatus: '',
    startError: '',
    recordId: '',
    lastEvent: null,
    eventLabel: '',
    // submit
    submitStatus: '',
    busy: false,
    // ── RC8.14 D10 CAS 验证面板（隔离；仅 test-client）──
    d10: {
      recordId: 'CR17920376443640tylag',
      eventId: 'CE012',
      choiceKey: 'A',
      choiceIndex: 0,
      choiceOptions: ['A', 'B'],
      inFlight: false,
      submitResp: null,
      submitText: '',
      getResp: null,
      getText: '',
    },
    // ── RC8.14 D12 R5B_4 — 授权的 8 路真实并发（单批次；仅 test-client）──
    eight: {
      running: false,
      done: false,
      summaryText: '',
      perReqText: '',
      overlap: null,
    },
    // ── RC8.14 D11 真实并发 CAS 测试面板（隔离；仅 test-client）──
    d11: {
      recordId: 'CR17920376443640tylag',
      eventId: 'GAME015',
      choiceA: 'A',
      choiceB: 'B',
      verifying: false,
      verifyText: '',
      target: null,        // {recordId,eventId,currentEventIndex,choiceKeys}
      inFlight: false,
      runText: '',
      respA: null, respB: null,
      respAText: '', respBText: '',
      getResp: null, getText: '',
      overlap: null,
    },
    // ── RC8.14 D12 R6D — Day1–Day3 受控验收（OWNER-ASSISTED；仅 test-client）──
    //   固定 recordId；逐步：取当前题 → owner 手动选择 → 单次提交。
    //   绝不自动选择 / 自动提交 / 自动重试；不调用 startChallenge。
    day3: {
      recordId: 'CRmvakykxsq5m5s6zj',
      slots: [
        { n: 1, eventId: 'CE012' },
        { n: 2, eventId: 'GAME015' },
        { n: 3, eventId: 'CE011' },
      ],
      slotIndex: 0,
      busy: false,
      event: null,      // server-served event {eventId,day,title,description,choices:[{key,text}]}
      selected: null,   // 'A' | 'B' | 'C' — set only by an owner tap
      fetchText: '',
      submitText: '',
      phase: 'idle',
    },
    // ── RC8.14 D12 R6D — Day4 付费边界【负向探针】Test B / Test C ──
    //   与正式 D3 提交守卫【完全隔离】；默认锁定；需在本卡片单独解锁 + 再次确认；
    //   每项至多 1 次真实调用（首次 await 前锁定）；绝不自动重试；仅隔离 staging。
    stagingEnvText: STAGING_ENV,
    tb: {
      recordId: 'CRmvakykxsq5m5s6zj',
      armed: false, done: false, busy: false,
      boundaryText: '', resultText: '',
    },
    tc: {
      recordId: 'CRmvakykxsq5m5s6zj',
      eventId: 'CE014', choiceKey: 'A',
      armed: false, done: false, busy: false,
      resultText: '',
    },
    log: [],
  },

  _log (line) {
    this.setData({ log: this.data.log.concat('[' + stamp() + '] ' + line).slice(-60) })
  },

  // Visible, non-silent feedback for guards/cancel (never throws if wx.showToast absent).
  _toast (title, icon) {
    try {
      if (typeof wx !== 'undefined' && wx.showToast) wx.showToast({ title: String(title || ''), icon: icon || 'none' })
    } catch (_) { /* test/mock env: no toast */ }
  },

  _reason (res) {
    if (!res) return 'no result'
    if (res.error) return String(res.error)
    return 'code=' + res.code + ' message=' + (res.message || '-') +
      (res.data ? ' data=' + JSON.stringify(res.data) : '')
  },

  // ── 1) identity self-check (server-verified; NOT dependent on startChallenge) ──
  async onIdentityCheck () {
    this.setData({ busy: true, identityStatus: '自检中…' })
    this._log('→ stagingIdentityProbe (身份自检)')
    try {
      const res = await wx.cloud.callFunction({ name: 'stagingIdentityProbe', data: {} }).then(r => r.result)
      this._log('← ' + this._redact(JSON.stringify(res).slice(0, 260)))
      const d = (res && res.data) || {}
      if (res && res.code === 0 && d.identityPresent) {
        this.setData({
          identityChecked: true, identityOk: true, identityStatus: '✅ 身份已核验',
          openid: d.openid || '', openidMasked: d.openidMasked || '',
          appid: d.appid || '', envVerified: !!d.envVerified,
        })
      } else {
        this.setData({
          identityChecked: true, identityOk: false,
          identityStatus: '❌ 身份核验失败：' + this._reason(res),
        })
      }
    } catch (e) {
      this.setData({ identityChecked: true, identityOk: false, identityStatus: '❌ 调用失败：' + String((e && e.errMsg) || e) })
      this._log('✗ ' + String((e && e.errMsg) || e))
    }
    this.setData({ busy: false })
  },

  // ── 1b) NORMAL LOGIN ONLY (creates/updates the users record for this identity) ──
  //       Deliberately does NOT create a challenge: no challenge record, no
  //       challenge_active session, no coupon/entitlement change. Single attempt.
  async onLogin () {
    if (this.data.loginBusy) { this._log('⛔ 登录请求进行中，忽略重复点击'); return }
    if (!this.data.identityOk) { this._log('⛔ 请先完成身份自检'); return }
    this.setData({ loginBusy: true, loginStatus: '登录中…' })
    this._log('→ login（仅普通登录；不创建挑战、不改权益）')
    try {
      const out = await getApp().login()
      if (out && out.ok) {
        const d = (out.res && out.res.data) || {}
        this.setData({
          loginOk: true,
          loginStatus: '✅ 登录成功' + (d.isNewUser ? '（新用户）' : '（老用户）'),
          isNewUser: !!d.isNewUser,
          membershipLevel: (d.user && d.user.membershipLevel) || 'free',
        })
        this._log('← login ok isNew=' + !!d.isNewUser + ' member=' + ((d.user && d.user.membershipLevel) || 'free'))
      } else {
        this.setData({ loginOk: false, loginStatus: '❌ 登录失败：' + ((out && out.error) || 'unknown') })
        this._log('✗ login ' + ((out && out.error) || 'unknown'))
      }
    } catch (e) {
      this.setData({ loginOk: false, loginStatus: '❌ 调用异常：' + String((e && e.errMsg) || e) })
      this._log('✗ login ' + String((e && e.errMsg) || e))
    }
    this.setData({ loginBusy: false })
  },

  // ── 2) startChallenge (requires identity self-check first) ──
  async onStart () {
    if (!this.data.identityOk) { this._log('⛔ 请先完成身份自检'); return }
    this.setData({ busy: true, startStatus: '进行中…', startError: '' })
    this._log('→ startChallenge')
    try {
      const res = await wx.cloud.callFunction({ name: 'startChallenge', data: {} }).then(r => r.result)
      this._log('← ' + this._redact(JSON.stringify(res).slice(0, 260)))
      if (res && res.code === 0 && res.data && res.data.recordId) {
        this.setData({ recordId: res.data.recordId, startStatus: '✅ 已创建/复用记录', startError: '' })
      } else {
        // explicit failure reason — never a vague "failed"
        this.setData({ startStatus: '❌ startChallenge 失败', startError: this._reason(res) })
      }
    } catch (e) {
      this.setData({ startStatus: '❌ startChallenge 调用异常', startError: String((e && e.errMsg) || e) })
      this._log('✗ ' + String((e && e.errMsg) || e))
    }
    this.setData({ busy: false })
  },

  async onGetEvent () {
    if (!this.data.recordId) { this._log('⛔ 无 recordId，先运行 startChallenge'); return }
    this.setData({ busy: true })
    this._log('→ getChallengeEvent ' + this.data.recordId)
    try {
      const res = await wx.cloud.callFunction({ name: 'getChallengeEvent', data: { recordId: this.data.recordId } }).then(r => r.result)
      this._log('← ' + this._redact(JSON.stringify(res).slice(0, 260)))
      const ev = (res && res.data) || null
      this.setData({ lastEvent: ev, eventLabel: ev && ev.eventId ? (ev.eventId + ' (day ' + ev.day + ')') : '（无可用题目/已完成）' })
    } catch (e) { this._log('✗ ' + String((e && e.errMsg) || e)) }
    this.setData({ busy: false })
  },

  async onSubmit0 () {
    const { recordId, lastEvent } = this.data
    if (!recordId) { this._log('⛔ 无 recordId'); return }
    if (!lastEvent || !lastEvent.eventId) { this._log('⛔ 无可用题目，先运行 getChallengeEvent'); return }
    const choiceKey = (lastEvent.choices && lastEvent.choices[0] && lastEvent.choices[0].key) || 'A'
    this.setData({ busy: true, submitStatus: '提交中…' })
    this._log('→ submitChallengeChoice ' + lastEvent.eventId + '/' + choiceKey)
    try {
      const res = await wx.cloud.callFunction({
        name: 'submitChallengeChoice',
        data: { recordId, eventId: lastEvent.eventId, choiceKey },
      }).then(r => r.result)
      this._log('← ' + this._redact(JSON.stringify(res).slice(0, 220)))
      this.setData({ submitStatus: (res && res.code === 0) ? '✅ 提交成功' : ('❌ 提交失败：' + this._reason(res)) })
    } catch (e) {
      this.setData({ submitStatus: '❌ 调用异常：' + String((e && e.errMsg) || e) })
      this._log('✗ ' + String((e && e.errMsg) || e))
    }
    this.setData({ busy: false })
  },

  // ══════════════════════════════════════════════════════════════════════
  // RC8.14 D10 — 隔离 CAS 验证面板（固定 recordId + 历史 eventId + A/B）
  //   仅 test-client；不调用 startChallenge；身份仅来自 getWXContext。
  // ══════════════════════════════════════════════════════════════════════
  _redact (s) {
    // 脱敏：openid 形态（o + 20/28 base62）永不完整落日志（含嵌套 JSON）
    return redactOpenid(s)
  },
  _nowMs () { return Date.now() },

  onD10RecordIdInput (e) { this.setData({ 'd10.recordId': (e.detail.value || '').trim() }) },
  onD10EventIdInput (e) { this.setData({ 'd10.eventId': (e.detail.value || '').trim() }) },
  onD10ChoiceChange (e) {
    const i = Number(e.detail.value) || 0
    const opts = this.data.d10.choiceOptions
    this.setData({ 'd10.choiceIndex': i, 'd10.choiceKey': opts[i] || 'A' })
  },

  _d10Guard () {
    const d = this.data.d10
    if (!d.recordId) { this._log('⛔ [D10] recordId 为空，已拒绝'); return null }
    if (!d.eventId) { this._log('⛔ [D10] eventId 为空，已拒绝'); return null }
    if (d.choiceKey !== 'A' && d.choiceKey !== 'B') { this._log('⛔ [D10] choiceKey 非法，已拒绝'); return null }
    return d
  },

  // 提交"指定"选择（需可见确认；禁用重复点击；不自动 startChallenge；409 不自动重试）
  onD10Submit () {
    if (this.data.d10.inFlight) { this._log('⛔ [D10] 请求进行中，忽略重复点击'); return }
    const d = this._d10Guard(); if (!d) return
    wx.showModal({
      title: '确认提交（staging）',
      content: '环境 ' + STAGING_ENV + '\nrecordId ' + d.recordId + '\neventId ' + d.eventId + '\nchoice ' + d.choiceKey +
        '\n\n这是隔离 staging 环境，非生产。确认提交？',
      confirmText: '提交',
      cancelText: '取消',
      success: (m) => { if (m.confirm) this._d10DoSubmit(d) },
    })
  },

  async _d10DoSubmit (d) {
    this.setData({ 'd10.inFlight': true, 'd10.submitText': '提交中…' })
    const t0 = this._nowMs()
    const req = { recordId: d.recordId, eventId: d.eventId, choiceKey: d.choiceKey }
    this._log('→ [D10] submit t0=' + t0 + ' ' + JSON.stringify(req))
    try {
      const res = await wx.cloud.callFunction({ name: 'submitChallengeChoice', data: req }).then(r => r.result)
      const t1 = this._nowMs()
      // 从正确层级(res.data)读取业务标志；缺省(null)与显式 false 区分；不合成 PASS。
      const p = parseSubmitResponse(res)
      const txt = 'code=' + p.code + ' message=' + (p.message || '-') +
        '\nduplicate=' + fmtFlag(p.duplicate) + ' idempotent=' + fmtFlag(p.idempotent) + ' conflict=' + fmtFlag(p.conflict) +
        '\ncurrentEventIndex=' + (p.currentEventIndex === null ? '-' : p.currentEventIndex) +
        '\ndata=' + this._redact(redactJson(p.data)) +
        '\nt0=' + t0 + ' t1=' + t1 + ' dt=' + (t1 - t0) + 'ms'
      // 保留原始服务端响应；不合成 flag、不把意外响应转 PASS
      this.setData({ 'd10.submitResp': res, 'd10.submitText': txt })
      this._log('← [D10] submit ' + this._redact('code=' + p.code + ' dup=' + fmtFlag(p.duplicate) + ' idem=' + fmtFlag(p.idempotent) + ' conflict=' + fmtFlag(p.conflict)))
    } catch (e) {
      const t1 = this._nowMs()
      const msg = String((e && e.errMsg) || e)
      this.setData({ 'd10.submitResp': { error: msg }, 'd10.submitText': '调用异常/被拒: ' + msg + '\nt0=' + t0 + ' t1=' + t1 })
      this._log('✗ [D10] submit ' + this._redact(msg))
    }
    this.setData({ 'd10.inFlight': false })
  },

  // 只读：取当前事件（不提交）
  async onD10GetEvent () {
    if (this.data.d10.inFlight) { this._log('⛔ [D10] 请求进行中，忽略重复点击'); return }
    const d = this._d10Guard(); if (!d) return
    this.setData({ 'd10.inFlight': true, 'd10.getText': '查询中…' })
    const t0 = this._nowMs()
    this._log('→ [D10] getEvent t0=' + t0 + ' recordId=' + d.recordId)
    try {
      const res = await wx.cloud.callFunction({ name: 'getChallengeEvent', data: { recordId: d.recordId } }).then(r => r.result)
      const t1 = this._nowMs()
      const ev = (res && res.data) || {}
      const txt = 'code=' + (res && res.code) + ' eventId=' + (ev.eventId || '-') +
        ' displayDay=' + (ev.displayDay !== undefined ? ev.displayDay : (ev.day !== undefined ? ev.day : '-')) +
        ' finished=' + (ev.finished === true) +
        '\nt0=' + t0 + ' t1=' + t1 + ' dt=' + (t1 - t0) + 'ms'
      this.setData({ 'd10.getResp': res, 'd10.getText': txt })
      this._log('← [D10] getEvent ' + this._redact('code=' + (res && res.code) + ' eventId=' + (ev.eventId || '-') + ' day=' + (ev.displayDay !== undefined ? ev.displayDay : ev.day)))
    } catch (e) {
      const t1 = this._nowMs()
      const msg = String((e && e.errMsg) || e)
      this.setData({ 'd10.getResp': { error: msg }, 'd10.getText': '调用异常/被拒: ' + msg + '\nt0=' + t0 + ' t1=' + t1 })
      this._log('✗ [D10] getEvent ' + this._redact(msg))
    }
    this.setData({ 'd10.inFlight': false })
  },

  // ══════════════════════════════════════════════════════════════════════
  // RC8.14 D11 — 真实并发 CAS 测试面板
  //   同一 recordId + 同一(当前未答)eventId，两个不同 choiceKey 并发提交；
  //   客户端不 await 任一请求，Promise.allSettled 收集；不自动重试；
  //   固定 staging env；身份来自 getWXContext；不调用 startChallenge。
  // ══════════════════════════════════════════════════════════════════════
  onD11RecordIdInput (e) { this.setData({ 'd11.recordId': (e.detail.value || '').trim() }) },
  onD11EventIdInput (e) { this.setData({ 'd11.eventId': (e.detail.value || '').trim() }) },
  onD11ChoiceAInput (e) { this.setData({ 'd11.choiceA': (e.detail.value || '').trim().toUpperCase() }) },
  onD11ChoiceBInput (e) { this.setData({ 'd11.choiceB': (e.detail.value || '').trim().toUpperCase() }) },

  _d11Guard () {
    const d = this.data.d11
    if (!d.recordId) { this._log('⛔ [D11] recordId 为空，已拒绝'); return null }
    if (!d.eventId) { this._log('⛔ [D11] eventId 为空，已拒绝'); return null }
    if (!/^[A-Z]$/.test(d.choiceA) || !/^[A-Z]$/.test(d.choiceB)) { this._log('⛔ [D11] choiceKey 非法（需单个 A-Z），已拒绝'); return null }
    if (d.choiceA === d.choiceB) { this._log('⛔ [D11] 两个 choiceKey 相同，已拒绝（须不同）'); return null }
    return d
  },

  // VERIFY_TARGET — 只读校验（getChallengeEvent）；确认 eventId 为当前未答事件。
  async onD11VerifyTarget () {
    if (!this.data.identityOk) { this._log('⛔ [D11] 请先完成身份自检'); return }
    if (this.data.d11.inFlight) { this._log('⛔ [D11] 请求进行中，忽略重复点击'); return }
    const d = this._d11Guard(); if (!d) return
    this.setData({ 'd11.verifying': true, 'd11.verifyText': '校验中…', 'd11.target': null })
    const t0 = this._nowMs()
    this._log('→ [D11] verifyTarget t0=' + t0 + ' recordId=' + d.recordId)
    try {
      const res = await wx.cloud.callFunction({ name: 'getChallengeEvent', data: { recordId: d.recordId } }).then(r => r.result)
      const t1 = this._nowMs()
      const ev = (res && res.data) || {}
      const isCurrent = !!(res && res.code === 0 && ev.eventId === d.eventId && ev.finished !== true)
      const txt = 'code=' + (res && res.code) +
        '\ncurrentEventId=' + (ev.eventId || '-') +
        '\ncurrentEventIndex=' + (ev.currentEventIndex !== undefined ? ev.currentEventIndex : '-') +
        '\ndisplayDay=' + (ev.displayDay !== undefined ? ev.displayDay : (ev.day !== undefined ? ev.day : '-')) +
        '\nfinished=' + (ev.finished === true) +
        '\ntargetMatch=' + isCurrent +
        '\nt0=' + t0 + ' t1=' + t1 + ' dt=' + (t1 - t0) + 'ms'
      this.setData({
        'd11.verifyText': txt,
        'd11.target': isCurrent ? { recordId: d.recordId, eventId: d.eventId, currentEventIndex: (ev.currentEventIndex !== undefined ? ev.currentEventIndex : null), choiceKeys: [d.choiceA, d.choiceB] } : null,
      })
      this._log('← [D11] verifyTarget ' + this._redact('code=' + (res && res.code) + ' ev=' + (ev.eventId || '-') + ' match=' + isCurrent))
    } catch (e) {
      const msg = String((e && e.errMsg) || e)
      this.setData({ 'd11.verifyText': '调用异常/被拒: ' + msg })
      this._log('✗ [D11] verifyTarget ' + this._redact(msg))
    }
    this.setData({ 'd11.verifying': false })
  },

  onD11Run () {
    if (this.data.d11.inFlight) { this._log('⛔ [D11] 并发测试进行中，忽略重复点击'); return }
    const d = this._d11Guard(); if (!d) return
    if (!d.target) { this._log('⛔ [D11] 请先 VERIFY_TARGET 校验目标（当前未答事件）'); return }
    wx.showModal({
      title: '确认并发提交（staging）',
      content: '环境 ' + STAGING_ENV + '\nrecordId ' + d.recordId + '\neventId ' + d.eventId +
        '\nchoice A=' + d.choiceA + ' / B=' + d.choiceB +
        '\n\n两请求将并发提交，只应一个成功。仅隔离 staging，非生产。确认执行？',
      confirmText: '并发提交',
      cancelText: '取消',
      success: (m) => { if (m.confirm) this._d11RunTwo(d) },
    })
  },

  // 并发：先构造两请求 → 不 await 任一 → Promise.allSettled 收集；不自动重试。
  async _d11RunTwo (d) {
    this.setData({
      'd11.inFlight': true, 'd11.runText': '并发提交中…', 'd11.overlap': null,
      'd11.respA': null, 'd11.respB': null, 'd11.respAText': '', 'd11.respBText': '',
      'd11.target': null,  // 运行后必须重新 VERIFY（防止在已答事件上重跑）
    })
    const reqA = { recordId: d.recordId, eventId: d.eventId, choiceKey: d.choiceA }
    const reqB = { recordId: d.recordId, eventId: d.eventId, choiceKey: d.choiceB }
    // 构造完成 → 并发派发（先不 await）
    const tA0 = this._nowMs()
    const pA = wx.cloud.callFunction({ name: 'submitChallengeChoice', data: reqA }).then(r => r.result, e => ({ __netError: String((e && e.errMsg) || e) }))
    const tB0 = this._nowMs()
    const pB = wx.cloud.callFunction({ name: 'submitChallengeChoice', data: reqB }).then(r => r.result, e => ({ __netError: String((e && e.errMsg) || e) }))
    this._log('→ [D11] concurrent dispatch tA0=' + tA0 + ' tB0=' + tB0 + ' reqA=' + JSON.stringify(reqA) + ' reqB=' + JSON.stringify(reqB))
    const settled = await Promise.allSettled([pA, pB])
    const tA1 = this._nowMs(), tB1 = this._nowMs()
    const val = (s) => (s && s.status === 'fulfilled') ? s.value : { __netError: 'rejected: ' + String(s && s.reason) }
    const resA = val(settled[0]), resB = val(settled[1])

    const fmt = (res, key, t0, t1) => {
      if (res && res.__netError) return key + ' 网络/调用错误: ' + this._redact(res.__netError) + '\nt0=' + t0 + ' t1=' + t1 + ' dt=' + (t1 - t0) + 'ms'
      const p = parseSubmitResponse(res)
      return key + ' code=' + p.code + ' message=' + (p.message || '-') +
        '\nduplicate=' + fmtFlag(p.duplicate) + ' idempotent=' + fmtFlag(p.idempotent) + ' conflict=' + fmtFlag(p.conflict) +
        '\nsubmittedChoice=' + ((p.data && p.data.submittedChoice) || '-') +
        '\ncurrentEventIndex=' + (p.currentEventIndex === null ? '-' : p.currentEventIndex) +
        '\ndata=' + this._redact(redactJson(p.data)) +
        '\nt0=' + t0 + ' t1=' + t1 + ' dt=' + (t1 - t0) + 'ms'
    }
    const overlap = (tA0 < tB1 && tB0 < tA1)
    this.setData({
      'd11.respA': resA, 'd11.respB': resB,
      'd11.respAText': fmt(resA, 'A:' + d.choiceA, tA0, tA1),
      'd11.respBText': fmt(resB, 'B:' + d.choiceB, tB0, tB1),
      'd11.overlap': overlap,
      'd11.runText': '完成。clientOverlap=' + overlap + '（tA=[' + tA0 + ',' + tA1 + '] tB=[' + tB0 + ',' + tB1 + ']）',
    })
    const cA = parseSubmitResponse(resA).code, cB = parseSubmitResponse(resB).code
    this._log('← [D11] concurrent done codeA=' + cA + ' codeB=' + cB + ' overlap=' + overlap)
    this.setData({ 'd11.inFlight': false })
  },

  // 只读：取当前事件（并发后读回）
  async onD11GetEvent () {
    if (this.data.d11.inFlight) { this._log('⛔ [D11] 请求进行中，忽略重复点击'); return }
    const d = this._d11Guard(); if (!d) return
    this.setData({ 'd11.inFlight': true, 'd11.getText': '查询中…' })
    const t0 = this._nowMs()
    this._log('→ [D11] getEvent t0=' + t0 + ' recordId=' + d.recordId)
    try {
      const res = await wx.cloud.callFunction({ name: 'getChallengeEvent', data: { recordId: d.recordId } }).then(r => r.result)
      const t1 = this._nowMs()
      const ev = (res && res.data) || {}
      const txt = 'code=' + (res && res.code) + ' eventId=' + (ev.eventId || '-') +
        ' currentEventIndex=' + (ev.currentEventIndex !== undefined ? ev.currentEventIndex : '-') +
        ' displayDay=' + (ev.displayDay !== undefined ? ev.displayDay : (ev.day !== undefined ? ev.day : '-')) +
        ' finished=' + (ev.finished === true) +
        '\nt0=' + t0 + ' t1=' + t1 + ' dt=' + (t1 - t0) + 'ms'
      this.setData({ 'd11.getResp': res, 'd11.getText': txt })
      this._log('← [D11] getEvent ' + this._redact('code=' + (res && res.code) + ' eventId=' + (ev.eventId || '-')))
    } catch (e) {
      const msg = String((e && e.errMsg) || e)
      this.setData({ 'd11.getResp': { error: msg }, 'd11.getText': '调用异常/被拒: ' + msg })
      this._log('✗ [D11] getEvent ' + this._redact(msg))
    }
    this.setData({ 'd11.inFlight': false })
  },

  // ══════════════════════════════════════════════════════════════════════
  // RC8.14 D12 R6D — Day1–Day3 受控验收面板（OWNER-ASSISTED；仅 test-client）
  //   固定 recordId；逐步：取当前题 → 手动选择 → 单次提交。
  //   绝不自动选择 / 自动提交 / 自动重试；不调用 startChallenge；
  //   身份来自 getWXContext；固定 staging env；不支付、不改权益。
  // ══════════════════════════════════════════════════════════════════════
  onD3RecordIdInput (e) { this.setData({ 'day3.recordId': (e.detail.value || '').trim() }) },
  onD3SlotChange (e) {
    const i = Number(e.detail.value) || 0
    this.setData({ 'day3.slotIndex': i, 'day3.event': null, 'day3.selected': null, 'day3.fetchText': '', 'day3.submitText': '', 'day3.phase': 'idle' })
    // 探针状态与正常步骤完全隔离：切换步骤仅重置 D3 面板，绝不影响/复位 Test B/C 探针。
  },
  _d3Expected () { return this.data.day3.slots[this.data.day3.slotIndex] || this.data.day3.slots[0] },

  // 取当前题（只读）。不提交、不自动选择。
  async onD3Fetch () {
    // Always clear any previous submission result FIRST — a blocked guard must never leave a stale
    // success line visible beside a new (or refused) fetch.
    this.setData({ 'day3.submitText': '' })
    if (!this.data.identityOk) { this._toast('请先完成身份自检', 'none'); this._log('⛔ [D3] 请先身份自检（0 请求）'); return }
    if (this.data.day3.busy) { this._log('⛔ [D3] 请求进行中，忽略重复点击'); return }
    const recordId = this.data.day3.recordId
    if (!recordId) { this._toast('recordId 为空', 'none'); return }
    const exp = this._d3Expected()
    this.setData({ 'day3.busy': true, 'day3.fetchText': '查询中…', 'day3.event': null, 'day3.selected': null, 'day3.submitText': '' })
    this._log('→ [D3] getChallengeEvent ' + recordId + ' day=' + exp.n + ' expect=' + exp.eventId)
    try {
      const res = await wx.cloud.callFunction({ name: 'getChallengeEvent', data: { recordId } }).then(r => r.result)
      const ev = (res && res.data) || {}
      let phase = 'error', txt = ''
      if (res && res.code === 0 && ev.locked === true && ev.needPayment === true) {
        phase = 'blocked'
        txt = '⛔ 付费边界：needPayment=true locked=true\ncurrentEventIndex=' + (ev.currentEventIndex !== undefined ? ev.currentEventIndex : '-') + '\n未下发题目（符合预期）。'
        this._log('← [D3] BOUNDARY needPayment=true（无题目）')
      } else if (res && res.code === 0 && ev.finished === true) {
        phase = 'done'; txt = '✅ 已完成（finished=true）。'
      } else if (res && res.code === 0 && ev.eventId) {
        const match = ev.eventId === exp.eventId
        phase = match ? 'choose' : 'mismatch'
        txt = 'code=0 eventId=' + ev.eventId + ' day=' + ev.day +
          '\ntrialMode=' + (ev.trialMode === true) + ' trialRemaining=' + (ev.trialRemaining !== undefined ? ev.trialRemaining : '-') +
          '\n计划期望 eventId=' + exp.eventId + ' → ' + (match ? '✅ 匹配' : '⚠ 不匹配（已阻止提交，0 请求）')
        this._log('← [D3] getEvent ' + this._redact('eventId=' + ev.eventId + ' day=' + ev.day + ' match=' + match))
      } else {
        txt = '异常响应：' + this._redact(JSON.stringify(res).slice(0, 200))
        this._log('✗ [D3] ' + this._redact(JSON.stringify(res).slice(0, 200)))
      }
      // 仅在真正匹配（phase==='choose'）时下发可提交事件；不匹配/边界/异常 ⇒ event=null（隐藏选择与提交控件）。
      this.setData({ 'day3.event': (phase === 'choose' && ev && ev.eventId) ? ev : null, 'day3.fetchText': txt, 'day3.phase': phase })
    } catch (e) {
      this.setData({ 'day3.fetchText': '调用异常: ' + String((e && e.errMsg) || e), 'day3.phase': 'error' })
      this._log('✗ [D3] ' + this._redact(String((e && e.errMsg) || e)))
    }
    this.setData({ 'day3.busy': false })
  },

  // owner 手动选择其一 —— 永远不自动选择。
  onD3Select (e) {
    if (this.data.day3.busy) return
    const key = e.currentTarget.dataset.key
    this.setData({ 'day3.selected': key, 'day3.submitText': '' })
    this._log('· [D3] owner 选择 ' + key + '（尚未提交）')
  },

  onD3Submit () {
    const d = this.data.day3
    if (d.busy) { this._log('⛔ [D3] 请求进行中，忽略重复点击'); return }
    // 付费边界：显式处理，绝不当作普通不匹配，也绝不发起提交。
    if (d.phase === 'blocked') { this._toast('已到付费边界（needPayment）', 'none'); this._log('⛔ [D3] locked/needPayment，已阻止提交（0 请求）'); return }
    // 强制门禁：仅当 phase==='choose' 才允许提交。
    if (d.phase !== 'choose') { this._toast('当前题未就绪，已阻止提交', 'none'); this._log('⛔ [D3] phase=' + d.phase + '，已阻止提交（0 请求）'); return }
    if (!d.event || !d.event.eventId) { this._toast('请先取当前题', 'none'); return }
    // 二次校验：当前事件必须等于所选步骤的期望 eventId，否则在联网前失败。
    const exp = this._d3Expected()
    const servedId = d.event.eventId
    if (servedId !== exp.eventId) {
      this.setData({ 'day3.event': null, 'day3.selected': null, 'day3.phase': 'mismatch' })
      this._toast('目标不匹配，已阻止提交', 'none')
      this._log('⛔ [D3] 不匹配（' + servedId + '≠' + exp.eventId + '），已阻止提交（0 请求）')
      return
    }
    if (d.selected !== 'A' && d.selected !== 'B' && d.selected !== 'C') { this._toast('请先选择一个选项', 'none'); return }
    wx.showModal({
      title: '确认提交（staging）',
      content: '环境 ' + STAGING_ENV + '\nrecordId ' + d.recordId +
        '\neventId ' + d.event.eventId + '\nchoice ' + d.selected +
        '\n\n仅隔离 staging，非生产。单次提交，不重试。确认？',
      confirmText: '提交',
      cancelText: '取消',
      success: (m) => { if (m.confirm) this._d3DoSubmit() },
      fail: () => { this._log('✗ [D3] showModal fail（0 请求）') },
    })
  },

  async _d3DoSubmit () {
    const d = this.data.day3
    this.setData({ 'day3.busy': true, 'day3.submitText': '提交中…' })
    const req = { recordId: d.recordId, eventId: d.event.eventId, choiceKey: d.selected }
    const t0 = Date.now()
    this._log('→ [D3] submit ' + JSON.stringify(req))
    try {
      const res = await wx.cloud.callFunction({ name: 'submitChallengeChoice', data: req }).then(r => r.result)
      const t1 = Date.now()
      const p = parseSubmitResponse(res)
      const txt = 'code=' + p.code + ' message=' + (p.message || '-') +
        '\nduplicate=' + fmtFlag(p.duplicate) + ' idempotent=' + fmtFlag(p.idempotent) + ' conflict=' + fmtFlag(p.conflict) +
        '\ncurrentEventIndex=' + (p.currentEventIndex === null ? '-' : p.currentEventIndex) +
        '\ndata=' + this._redact(redactJson(p.data)) + '\ndt=' + (t1 - t0) + 'ms'
      this.setData({ 'day3.submitText': (p.code === 0 ? '✅ 提交成功\n' : '❌ 提交失败\n') + txt, 'day3.phase': 'submitted', 'day3.event': null, 'day3.selected': null })
      this._log('← [D3] submit ' + this._redact('code=' + p.code + ' dup=' + fmtFlag(p.duplicate) + ' idem=' + fmtFlag(p.idempotent) + ' idx=' + (p.currentEventIndex === null ? '-' : p.currentEventIndex)))
    } catch (e) {
      this.setData({ 'day3.submitText': '❌ 调用异常: ' + String((e && e.errMsg) || e) })
      this._log('✗ [D3] submit ' + this._redact(String((e && e.errMsg) || e)))
    }
    this.setData({ 'day3.busy': false })
  },

  goRunner () { wx.navigateTo({ url: '/pages/runner/runner' }) },

  // ══════════════════════════════════════════════════════════════════════
  // RC8.14 D12 R6D — Day4 付费边界【负向探针】Test B / Test C
  //   ⚠ 仅 test-client；固定 recordId；身份服务端权威；无客户端 openid；
  //   默认锁定；单独解锁 + 再次确认；首次 await 前锁定（至多 1 次）；
  //   绝不自动重试；不支付、不建订单、不授权益；不修改 D3 正式守卫。
  // ══════════════════════════════════════════════════════════════════════
  onTBArm (e) {
    const v = !!(e && e.detail && e.detail.value)
    this.setData({ 'tb.armed': v, 'tb.boundaryText': v ? '🔓 已解锁：点击将发起恰好 1 次 startChallenge(mode=challenge)。' : '🔒 已锁定' })
    this._log((v ? '🔓' : '🔒') + ' [TB] armed=' + v)
  },
  onTCArm (e) {
    const v = !!(e && e.detail && e.detail.value)
    this.setData({ 'tc.armed': v })
    this._log((v ? '🔓' : '🔒') + ' [TC] armed=' + v)
  },

  // Test B — 单次 startChallenge（期望：同 recordId + needPayment=true/locked=true，无新试用/无重置）
  onTBStart () {
    const b = this.data.tb
    if (b.done || b.busy) { this._toast('Test B 已完成或进行中', 'none'); this._log('⛔ [TB] 已锁定（单次）'); return }
    if (!b.armed) { this._toast('请先解锁 Test B', 'none'); this._log('⛔ [TB] 未解锁（0 请求）'); return }
    if (!this.data.identityOk) { this._toast('请先完成身份自检', 'none'); this._log('⛔ [TB] 未自检（0 请求）'); return }
    wx.showModal({
      title: '确认 Test B（单次）',
      content: '将发起 1 次 startChallenge(mode=challenge)\nrecordId ' + b.recordId +
        '\n\n仅隔离 staging，非生产。仅此一次，不重试。确认？',
      confirmText: '确认执行',
      cancelText: '取消',
      success: (m) => { if (m.confirm) this._tbDoStart() },
      fail: () => this._log('✗ [TB] showModal fail（0 请求）'),
    })
  },
  async _tbDoStart () {
    if (this.data.tb.done || this.data.tb.busy) return
    // 首次网络 await 之前锁定（单次语义）。
    this.setData({ 'tb.busy': true, 'tb.done': true })
    this._log('→ [TB] startChallenge mode=challenge（仅此 1 次）')
    try {
      const res = await wx.cloud.callFunction({ name: 'startChallenge', data: { mode: 'challenge' } }).then(r => r.result)
      const p = res || {}
      const d = p.data || {}
      const txt = 'code=' + p.code + ' message=' + (p.message || '-') +
        '\nlocked=' + fmtFlag(d.locked) + ' needPayment=' + fmtFlag(d.needPayment) +
        '\nrecordId=' + this._redact(String(d.recordId || '-')) +
        '\ncurrentEventIndex=' + (d.currentEventIndex !== undefined ? d.currentEventIndex : '-') +
        '\nresumed=' + fmtFlag(d.resumed) + ' trialMode=' + fmtFlag(d.trialMode) +
        '\ndata=' + this._redact(redactJson(d))
      this.setData({ 'tb.resultText': txt, 'tb.busy': false })
      this._log('← [TB] startChallenge ' + this._redact('code=' + p.code + ' locked=' + fmtFlag(d.locked) + ' needPayment=' + fmtFlag(d.needPayment) + ' idx=' + (d.currentEventIndex !== undefined ? d.currentEventIndex : '-')))
    } catch (e) {
      this.setData({ 'tb.resultText': '❌ 调用异常: ' + String((e && e.errMsg) || e), 'tb.busy': false })
      this._log('✗ [TB] ' + this._redact(String((e && e.errMsg) || e)))
    }
  },

  // Test C — 单次直连 submit（CE014/A 为合法题库选项；期望 1002 NEED_PAYMENT、零写入）
  onTCSubmit () {
    const c = this.data.tc
    if (c.done || c.busy) { this._toast('Test C 已完成或进行中', 'none'); this._log('⛔ [TC] 已锁定（单次）'); return }
    if (!c.armed) { this._toast('请先解锁 Test C', 'none'); this._log('⛔ [TC] 未解锁（0 请求）'); return }
    if (!this.data.identityOk) { this._toast('请先完成身份自检', 'none'); this._log('⛔ [TC] 未自检（0 请求）'); return }
    wx.showModal({
      title: '确认 Test C（单次）',
      content: '将发起 1 次 submitChallengeChoice(' + c.eventId + '/' + c.choiceKey + ')\nrecordId ' + c.recordId +
        '\n预期被拒 1002（付费边界）。仅此一次，不重试。确认？',
      confirmText: '确认执行',
      cancelText: '取消',
      success: (m) => { if (m.confirm) this._tcDoSubmit() },
      fail: () => this._log('✗ [TC] showModal fail（0 请求）'),
    })
  },
  async _tcDoSubmit () {
    if (this.data.tc.done || this.data.tc.busy) return
    this.setData({ 'tc.busy': true, 'tc.done': true })
    const req = { recordId: this.data.tc.recordId, eventId: this.data.tc.eventId, choiceKey: this.data.tc.choiceKey }
    this._log('→ [TC] submit ' + JSON.stringify(req) + '（仅此 1 次，预期 1002 NEED_PAYMENT）')
    try {
      const res = await wx.cloud.callFunction({ name: 'submitChallengeChoice', data: req }).then(r => r.result)
      const p = parseSubmitResponse(res)
      const dd = p.data || {}
      const txt = 'code=' + p.code + ' message=' + (p.message || '-') +
        '\nneedPayment=' + fmtFlag(dd.needPayment) + ' locked=' + fmtFlag(dd.locked) +
        '\ncurrentEventIndex=' + (p.currentEventIndex === null ? '-' : p.currentEventIndex) +
        '\ndata=' + this._redact(redactJson(dd))
      this.setData({ 'tc.resultText': (p.code === 1002 ? '⛔ 预期拒绝 1002 NEED_PAYMENT\n' : '⚠ 非预期响应 code=' + p.code + '\n') + txt, 'tc.busy': false })
      this._log('← [TC] submit ' + this._redact('code=' + p.code + ' needPayment=' + fmtFlag(dd.needPayment) + ' locked=' + fmtFlag(dd.locked)))
    } catch (e) {
      this.setData({ 'tc.resultText': '❌ 调用异常: ' + String((e && e.errMsg) || e), 'tc.busy': false })
      this._log('✗ [TC] ' + this._redact(String((e && e.errMsg) || e)))
    }
  },

  // ══════════════════════════════════════════════════════════════════════
  // RC8.14 D12 R5B_4 — 单次授权 8 路真实并发（startChallenge, mode=challenge）
  //   仅 test-client；身份来自 getWXContext；不 submitChoice、不 replay、
  //   不支付、不改权益；不自动重试；只允许一次批次（运行后按钮锁定）。
  // ══════════════════════════════════════════════════════════════════════
  onEightWayRun () {
    // Session-wide single-batch lock (survives page re-entry within this app session).
    const app = getApp()
    app.globalData = app.globalData || {}
    if (app.globalData.eightWayDone) {
      this.setData({ 'eight.done': true, 'eight.summaryText': '⛔ 已执行过单次批次（会话级锁定）; 本任务只允许一个批次。' })
      this._toast('已执行过单次批次', 'none')
      this._log('⛔ [8W] 会话级批次已锁定')
      return
    }
    if (this.data.eight.running) { this._toast('批次进行中', 'none'); this._log('⛔ [8W] 批次进行中，忽略重复点击'); return }
    if (this.data.eight.done) { this._toast('已执行过单次批次', 'none'); this._log('⛔ [8W] 已执行过单次批次'); return }
    if (!this.data.identityOk) {
      this.setData({ 'eight.summaryText': '❌ 未完成身份自检，未派发任何请求（0 次网络调用）' })
      this._toast('请先完成身份自检', 'none')
      this._log('⛔ [8W] 请先完成身份自检（0 请求）')
      return
    }
    // Visible feedback IMMEDIATELY on tap, BEFORE any modal or network call.
    this.setData({ 'eight.summaryText': '已点击：等待弹窗确认（尚未发送任何请求）…', 'eight.perReqText': '' })
    this._log('· [8W] tap 已接收，弹窗确认中（0 请求）')
    wx.showModal({
      title: '确认 8 路并发（staging，单批次）',
      content: '环境 ' + STAGING_ENV + '\n将并发派发 8 个 startChallenge(mode=challenge)。\n仅隔离 staging，非生产；不提交答案、不重试。\n\n确认执行唯一一次批次？',
      confirmText: '确认执行',
      cancelText: '取消',
      success: (m) => {
        if (m && m.confirm) {
          this._log('· [8W] 已确认，开始派发 8 个请求')
          this._eightWayDo()
        } else {
          // Cancellation / dismiss ⇒ ZERO requests.
          this.setData({ 'eight.summaryText': '已取消：未派发任何请求（0 次网络调用）' })
          this._toast('已取消，未发送请求', 'none')
          this._log('· [8W] 已取消（0 请求）')
        }
      },
      fail: (e) => {
        this.setData({ 'eight.summaryText': '弹窗异常：未派发任何请求（0 次网络调用）' })
        this._log('✗ [8W] showModal fail ' + String((e && e.errMsg) || e) + '（0 请求）')
      },
    })
  },

  async _eightWayDo () {
    const app = getApp()
    // Lock BOTH page + app globalData BEFORE the first await (blocks synchronous duplicate taps).
    app.globalData = app.globalData || {}
    app.globalData.eightWayDone = true
    this.setData({ 'eight.running': true, 'eight.done': true, 'eight.summaryText': '并发派发中… 0/8 已完成', 'eight.perReqText': '', 'eight.overlap': null })
    this._log('→ [8W] dispatch 8 × startChallenge(mode=challenge) — 不 await 前序、单批次、不重试')
    try {
      const s = await app.startChallengeEightWay(8, (done, total) => {
        this.setData({ 'eight.summaryText': '并发派发中… ' + done + '/' + total + ' 已完成' })
      })
      if (!s || !s.ok) {
        this.setData({ 'eight.running': false, 'eight.summaryText': '❌ ' + ((s && s.error) || 'unknown') })
        this._log('✗ [8W] ' + ((s && s.error) || 'unknown'))
        return
      }
      const distinct = s.successRecordIds.length
      const summary = 'count=' + s.count +
        '\nsuccess=' + s.successCount + ' conflict/err=' + s.conflictCount + ' netErr=' + s.errorCount +
        '\nresponseCodes=' + JSON.stringify(s.responseCodes) +
        '\ndistinctSuccessRecordIds=' + distinct + ' ' + JSON.stringify(s.successRecordIds) +
        '\nclientOverlap=' + s.clientOverlap +
        '\nbatchWallClockMs=' + s.batchWallClockMs + ' (firstDispatch=' + s.firstDispatch + ' lastSettlement=' + s.lastSettlement + ')'
      const lines = s.perRequest.map((r) => {
        return '#' + r.clientRequestIndex +
          ' dispatch=' + r.dispatchTimestamp + ' settle=' + r.settlementTimestamp +
          ' code=' + (r.code === null ? '-' : r.code) + ' msg=' + (r.message || '-') +
          ' recordId=' + (r.recordId || '-') +
          ' resumed=' + r.resumed + ' trialMode=' + r.trialMode +
          ' idx=' + (r.currentEventIndex === null ? '-' : r.currentEventIndex) +
          ' errCode=' + (r.errorCode === null ? '-' : r.errorCode) + ' retryable=' + r.retryable +
          (r.netError ? (' netErr=' + this._redact(r.netError)) : '')
      }).join('\n')
      this.setData({ 'eight.running': false, 'eight.done': true, 'eight.summaryText': summary, 'eight.perReqText': lines, 'eight.overlap': s.clientOverlap })
      this._log('← [8W] done success=' + s.successCount + ' distinct=' + distinct + ' overlap=' + s.clientOverlap)
    } catch (e) {
      this.setData({ 'eight.running': false, 'eight.done': true, 'eight.summaryText': '❌ 客户端异常：' + String((e && e.errMsg) || e) })
      this._log('✗ [8W] ' + String((e && e.errMsg) || e))
    }
  },
})
