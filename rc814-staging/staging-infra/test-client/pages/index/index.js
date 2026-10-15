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
    log: [],
  },

  _log (line) {
    this.setData({ log: this.data.log.concat('[' + stamp() + '] ' + line).slice(-60) })
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

  goRunner () { wx.navigateTo({ url: '/pages/runner/runner' }) },
})
