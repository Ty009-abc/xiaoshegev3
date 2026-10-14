const { runAll } = require('../../lib/c1-c10-runner.js')

Page({
  data: { status: 'idle', summary: null, lines: [] },
  onRun () {
    this.setData({ status: 'running', lines: ['running C1–C10…'] })
    runAll((s) => {
      const lines = s.rows.map(r => r.id + ' [' + r.status + '] ' + r.name + ' — ' + r.detail)
      this.setData({
        status: 'done',
        summary: s,
        lines: lines.concat(['', 'PASS=' + s.pass + ' FAIL=' + s.fail + ' BLOCKED=' + s.blocked, 'env=' + s.env, 'at=' + s.ranAt]),
      })
    })
  },
})
