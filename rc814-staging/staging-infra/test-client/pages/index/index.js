/**
 * RC8_14 independent staging test client — index page
 * Thin harness over the 3 challenge functions. Identity is server-derived
 * (getWXContext().OPENID). No payload openid; no header identity entry.
 *
 * Fixtures (synthetic, staging-only) map to REAL test identities by having the
 * tester's own openid written to the fixture docs — NOT by trusting a client
 * claim. See staging-infra/map-identity.js (server-side CLI mapping).
 */
const svc = {
  call(name, data) {
    return wx.cloud.callFunction({ name, data }).then(r => r.result)
  },
}

Page({
  data: {
    stagingEnv: 'fanshen002-d9g0rjr3b6e313af5',
    openid: '',
    appid: '',
    status: 'idle',
    log: [],
    recordId: '',
    lastEvent: null,
  },

  onLoad() {
    const app = getApp()
    app.onIdentityReady((g) => {
      this.setData({ openid: g.openid || '(none)', appid: g.appid || '-', status: g.loginErr ? ('login error: ' + g.loginErr) : 'ready' })
    })
  },

  _log(line) {
    const t = new Date().toISOString().slice(11, 19)
    this.setData({ log: this.data.log.concat('[' + t + '] ' + line).slice(-40) })
  },

  async onStart() {
    this.setData({ status: 'startChallenge...' }); this._log('→ startChallenge')
    try {
      const res = await svc.call('startChallenge', {})
      this._log('← ' + JSON.stringify(res).slice(0, 220))
      if (res && res.recordId) this.setData({ recordId: res.recordId })
    } catch (e) { this._log('✗ ' + String(e)) }
    this.setData({ status: 'idle' })
  },

  async onGetEvent() {
    const recordId = this.data.recordId
    if (!recordId) return this._log('no recordId — run startChallenge first')
    this.setData({ status: 'getChallengeEvent...' }); this._log('→ getChallengeEvent ' + recordId)
    try {
      const res = await svc.call('getChallengeEvent', { recordId })
      this._log('← ' + JSON.stringify(res).slice(0, 260))
      this.setData({ lastEvent: res })
    } catch (e) { this._log('✗ ' + String(e)) }
    this.setData({ status: 'idle' })
  },

  async onSubmit0() {
    const { recordId, lastEvent } = this.data
    if (!recordId || !lastEvent || !lastEvent.eventId) return this._log('need recordId + an event first')
    const choiceKey = (lastEvent.choices && lastEvent.choices[0] && lastEvent.choices[0].key) || 'A'
    this.setData({ status: 'submitChallengeChoice...' }); this._log('→ submit ' + lastEvent.eventId + '/' + choiceKey)
    try {
      const res = await svc.call('submitChallengeChoice', { recordId, eventId: lastEvent.eventId, choiceKey })
      this._log('← ' + JSON.stringify(res).slice(0, 220))
    } catch (e) { this._log('✗ ' + String(e)) }
    this.setData({ status: 'idle' })
  },
})
