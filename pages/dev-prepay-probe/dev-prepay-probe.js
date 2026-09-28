/**
 * pages/dev-prepay-probe/dev-prepay-probe.js
 *
 * PAYMENT_STAGE4A_REAL_MINIPROGRAM_PREPAY_ONLY — TEMPORARY DEVELOPMENT-ONLY probe.
 *
 * ============================ PREPAY ONLY ============================
 * NO PAYMENT INVOCATION.
 *
 * Purpose: call createOrder ONCE through `wx.cloud.callFunction` from a REAL
 * mini-program user context (so cloud.getWXContext().OPENID is a genuine payer),
 * exercise the real WeChat JSAPI prepay request, and DISPLAY SAFE METADATA ONLY.
 *
 * This page intentionally does NOT import services/paymentService.js, and does
 * NOT call wx.requestPayment anywhere. There is no code path from this page to
 * any payment invocation. It never calls verifyPayment and never fabricates a
 * transaction_id / paid state / entitlement.
 *
 * This is a TEMPORARY probe — to be REMOVED in a separate cleanup commit after
 * evidence collection (owner directive §8). It must never ship in release UX.
 * =====================================================================
 */

Page({
  data: {
    calling: false,
    called: false,
    code: null,
    orderId: '',
    totalAmount: null,
    productName: '',
    paymentParamsPresent: null,   // boolean — does createOrder return paymentParams?
    prepayPackagePrefix: '',      // masked: "prepay_id=wx…"
    prepayPackageLen: null,
    signType: '',
    timeStamp: '',
    nonceStrLen: null,
    paySignLen: null,
    safeRaw: '',                  // scrubbed JSON evidence
    errorMsg: '',
  },

  onLoad() {
    // Loud, unambiguous banner (also emitted to console for evidence capture).
    console.log('[DEV_PREPAY_PROBE] PREPAY ONLY — NO PAYMENT INVOCATION')
    console.log('[DEV_PREPAY_PROBE] target=report_9_9 (990 fen). No wx.requestPayment anywhere on this page.')
  },

  onProbe() {
    if (this.data.calling) return
    // Hard reset of prior evidence.
    this.setData({
      calling: true, called: false, code: null, orderId: '', totalAmount: null,
      productName: '', paymentParamsPresent: null, prepayPackagePrefix: '',
      prepayPackageLen: null, signType: '', timeStamp: '', nonceStrLen: null,
      paySignLen: null, safeRaw: '', errorMsg: '',
    })

    // The ONLY cloud call on this page. Direct call — no paymentService wrapper.
    wx.cloud.callFunction({
      name: 'createOrder',
      data: { productId: 'report_9_9' },
    }).then((res) => {
      const result = (res && res.result) ? res.result : null
      const code = (result && typeof result.code === 'number') ? result.code : null
      const data = (result && result.data) ? result.data : null

      // Build scrubbed, secret-free evidence (never expose paySign, never full prepay_id).
      let safe = { code }
      let ppPresent = null
      let pkgPrefix = ''
      let pkgLen = null
      let signType = ''
      let timeStamp = ''
      let nonceStrLen = null
      let paySignLen = null

      if (data) {
        safe.orderId = data.orderId
        safe.totalAmount = data.totalAmount
        safe.productName = data.productName
        safe.expireMinutes = data.expireMinutes
        const pp = data.paymentParams
        if (pp) {
          ppPresent = true
          pkgPrefix = pp.package ? (String(pp.package).slice(0, 16) + '…') : ''
          pkgLen = pp.package ? String(pp.package).length : 0
          signType = pp.signType || ''
          timeStamp = pp.timeStamp || ''
          nonceStrLen = pp.nonceStr ? String(pp.nonceStr).length : 0
          paySignLen = pp.paySign ? String(pp.paySign).length : 0
          safe.paymentParams = {
            present: true,
            package_prefix: pkgPrefix,
            package_len: pkgLen,
            signType, timeStamp, nonceStr_len: nonceStrLen, paySign_len: paySignLen,
          }
        } else {
          ppPresent = false
          safe.paymentParams = { present: false }
        }
      }

      this.setData({
        calling: false, called: true,
        code,
        orderId: (data && data.orderId) || '',
        totalAmount: (data && data.totalAmount != null) ? data.totalAmount : null,
        productName: (data && data.productName) || '',
        paymentParamsPresent: ppPresent,
        prepayPackagePrefix: pkgPrefix,
        prepayPackageLen: pkgLen,
        signType, timeStamp, nonceStrLen, paySignLen,
        safeRaw: JSON.stringify(safe, null, 2),
        errorMsg: (result && code !== 0) ? (result.message || '') : '',
      })
    }).catch((err) => {
      this.setData({
        calling: false, called: true,
        safeRaw: '', errorMsg: (err && err.message) || '调用失败',
        code: null, paymentParamsPresent: null,
      })
    })
  },

  onCopyResult() {
    if (!this.data.safeRaw) return
    wx.setClipboardData({
      data: this.data.safeRaw,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    })
  },
})
