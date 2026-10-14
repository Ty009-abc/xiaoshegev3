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
      this._log('← ' + JSON.stringify(res).slice(0, 260))
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
      this._log('← ' + JSON.stringify(res).slice(0, 260))
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
      this._log('← ' + JSON.stringify(res).slice(0, 260))
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
      this._log('← ' + JSON.stringify(res).slice(0, 220))
      this.setData({ submitStatus: (res && res.code === 0) ? '✅ 提交成功' : ('❌ 提交失败：' + this._reason(res)) })
    } catch (e) {
      this.setData({ submitStatus: '❌ 调用异常：' + String((e && e.errMsg) || e) })
      this._log('✗ ' + String((e && e.errMsg) || e))
    }
    this.setData({ busy: false })
  },

  goRunner () { wx.navigateTo({ url: '/pages/runner/runner' }) },
})
