const { runAll } = require('../../lib/c1-c10-runner.js')

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
  data: { status: 'idle', summary: null, lines: [], tz: '', identityOk: false },

  onLoad () {
    this.setData({ tz: (Intl && Intl.DateTimeFormat) ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'unknown' })
  },

  // Identity self-check is INDEPENDENT of startChallenge.
  async onIdentityCheck () {
    this.setData({ status: '身份自检中…' })
    try {
      const res = await wx.cloud.callFunction({ name: 'stagingIdentityProbe', data: {} }).then(r => r.result)
      const ok = res && res.code === 0 && res.data && res.data.identityPresent
      this.setData({
        identityOk: !!ok,
        status: ok ? ('✅ 身份已核验 ' + (res.data.openidMasked || '')) : ('❌ 身份核验失败 ' + JSON.stringify(res)),
      })
    } catch (e) {
      this.setData({ identityOk: false, status: '❌ ' + String((e && e.errMsg) || e) })
    }
  },

  onRun () {
    if (!this.data.identityOk) { this.setData({ status: '请先完成身份自检' }); return }
    this.setData({ status: 'running', lines: ['[' + stamp() + '] running C1–C10…'] })
    runAll((s) => {
      const lines = s.rows.map(r => r.id + ' [' + r.status + '] ' + r.name + ' — ' + r.detail)
      this.setData({
        status: 'done',
        summary: s,
        lines: lines.concat(['', 'PASS=' + s.pass + ' FAIL=' + s.fail + ' BLOCKED=' + s.blocked, 'env=' + s.env, 'at=' + stamp()]),
      })
    })
  },
})
