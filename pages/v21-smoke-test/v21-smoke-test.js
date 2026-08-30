/**
 * pages/v21-smoke-test/v21-smoke-test.js
 *
 * RC8.3 Stage20 R5C — world_model_v2_1 OFF-state 内部 smoke 入口（仅 U1-U5 可访问）。
 *
 * 这是纯测试工具，不是正式诊断入口：
 *   - 只调用 generateAiReport 一次，携带 { type:'diagnostic', diagnosticVersion:'world_model_v2_1' }
 *   - 不发送伪造答案，不发送伪造 openid，不绕过 getWXContext()
 *   - 不写数据库，不覆盖本地报告，不改动用户正常报告缓存/历史
 *   - 不调用正常报告渲染/存储流程
 *
 * OFF 验收只校验 4 个精确信号（不推断认知分数/blindspot）：
 *   code === 0
 *   data.reportType === 'diagnostic_v2_1_off'
 *   data.v21Mode === 'OFF'
 *   data.v21PrimaryActive === false
 */
const app = getApp()
const { V2_INTERNAL_ALLOWLIST } = require('../../utils/v2Questionnaire')

const AUTH_FAILED_CODE = 10002

Page({
  data: {
    loading: true,          // 登录就绪前
    allowed: false,         // 客户端内部白名单门（复用现有 U1-U5 allowlist，不新增绕过）
    calling: false,
    called: false,
    rawResult: '',          // 原始返回 JSON（供 R5 证据收集）
    code: null,
    reportType: null,
    diagnosticVersion: null,
    v21Mode: null,
    v21PrimaryActive: null,
    authGatePassed: null,       // AUTH_GATE_PASSED
    v21OffBranchReached: null,  // V21_OFF_BRANCH_REACHED
    offSignaturePass: null,     // OFF_SIGNATURE_PASS
    errorMsg: '',
  },

  onLoad() {
    // 直连入口（体验/预览二维码指定 pagePath）时，openid 由 app.onLaunch 异步加载。
    // 复用现有内部测试页的登录就绪判定模式：等待 openid 就绪再结算白名单。
    this._applied = false
    const apply = () => {
      if (this._applied) return
      this._applied = true
      const openid = app.globalData.openid || ''
      const allowed = V2_INTERNAL_ALLOWLIST.indexOf(openid) >= 0
      this.setData({ allowed, loading: false })
    }
    app.onReady(apply)
    this._fallbackTimer = setTimeout(apply, 3000)
  },

  onUnload() {
    if (this._fallbackTimer) clearTimeout(this._fallbackTimer)
  },

  onSmoke() {
    if (this.data.calling) return
    this.setData({
      calling: true,
      called: false,
      rawResult: '',
      errorMsg: '',
      code: null,
      reportType: null,
      diagnosticVersion: null,
      v21Mode: null,
      v21PrimaryActive: null,
      authGatePassed: null,
      v21OffBranchReached: null,
      offSignaturePass: null,
    })

    // 精确 smoke 调用：不带答案、不带 openid、不绕过 getWXContext()。
    wx.cloud.callFunction({
      name: 'generateAiReport',
      data: {
        type: 'diagnostic',
        diagnosticVersion: 'world_model_v2_1',
      },
    }).then(res => {
      const result = res && res.result ? res.result : null
      const code = result && typeof result.code === 'number' ? result.code : null
      const data = result && result.data ? result.data : null
      const reportType = data ? data.reportType : null
      const diagnosticVersion = data ? data.diagnosticVersion : null
      const v21Mode = data ? data.v21Mode : null
      const v21PrimaryActive = data ? data.v21PrimaryActive : null

      // AUTH_GATE_PASSED：真实登录态 OPENID 通过了 getWXContext() 认证门（未返回 10002）。
      const authGatePassed = code !== null && code !== AUTH_FAILED_CODE
      // V21_OFF_BRANCH_REACHED：服务端返回了精确的 V2.1 OFF 分支签名。
      const v21OffBranchReached = code === 0 && reportType === 'diagnostic_v2_1_off'
      // OFF_SIGNATURE_PASS：OFF 分支 + v21Mode=OFF + v21PrimaryActive=false 三者精确匹配。
      const offSignaturePass = v21OffBranchReached === true && v21Mode === 'OFF' && v21PrimaryActive === false

      this.setData({
        calling: false,
        called: true,
        rawResult: JSON.stringify(result, null, 2),
        code,
        reportType,
        diagnosticVersion,
        v21Mode,
        v21PrimaryActive: v21PrimaryActive === undefined ? null : v21PrimaryActive,
        authGatePassed,
        v21OffBranchReached,
        offSignaturePass,
      })
    }).catch(err => {
      this.setData({
        calling: false,
        called: true,
        rawResult: '',
        errorMsg: (err && err.message) || '调用失败',
        code: null,
        reportType: null,
        diagnosticVersion: null,
        v21Mode: null,
        v21PrimaryActive: null,
        authGatePassed: false,
        v21OffBranchReached: false,
        offSignaturePass: false,
      })
    })
  },

  onCopyResult() {
    if (!this.data.rawResult) return
    wx.setClipboardData({
      data: this.data.rawResult,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    })
  },
})
