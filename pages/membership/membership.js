/**
 * pages/membership/membership.js — 认知会员购买页（RC8_11 会员权威）
 *
 * 新主售：认知会员月卡 ¥39.9 / 年卡 ¥299（微信虚拟支付 short_series_goods）。
 * 退役商品（report_9_9 / challenge_39_9 / vip_month_99）不再新售 ——
 *   历史用户权益由服务端权威保留（本页不参与其放行判定，客户端绝不覆盖）。
 * 价格/权益一律以服务端商品配置为准，客户端不编造价格；
 * 虚拟支付通道失败闭合 —— 绝不回退普通 wx.requestPayment。
 */
const paymentService = require('../../services/paymentService.js')
const userTrack = require('../../utils/userTrack.js')

const MONTHLY = 'vip_month_39_9'
const ANNUAL = 'vip_year_299'
// RC8_11：退休新售商品 —— 统一导向会员方案（历史购买者已由服务端放行，不会进入本页）
const RETIRED = ['report_9_9', 'challenge_39_9', 'vip_month_99']

Page({
  data: {
    source: '',
    recordId: '',
    productId: MONTHLY,
    plan: 'monthly',
    product: null,
    monthly: null,
    annual: null,
    paying: false,
    loading: true,
    loadError: '',
    priceDisplay: '',
    originalPriceDisplay: '',
    hasOriginalPrice: false,
  },

  onLoad(opt) {
    const source = opt.source || ''
    const recordId = opt.recordId || ''
    let productId = opt.productId || MONTHLY
    const retiredRequested = RETIRED.indexOf(productId) >= 0
    if (retiredRequested) {
      console.warn('[Membership] retired product requested → membership offer', { requested: opt.productId })
      productId = MONTHLY
    }
    const plan = productId === ANNUAL ? 'annual' : 'monthly'
    this.setData({ source, recordId, productId, plan })
    userTrack.event('payment_view', { productId, source: source || '' })
    if (retiredRequested) {
      wx.showToast({ title: '该方案已升级为会员，请选择会员方案', icon: 'none' })
    }
    this.loadProducts()
  },

  async loadProducts() {
    try {
      const r = await paymentService.getProductList()
      if (!r || r.code !== 0) throw new Error('商品加载失败')
      const products = r.data.products || r.data || []
      const monthly = products.find((p) => p.productId === MONTHLY) || null
      const annual = products.find((p) => p.productId === ANNUAL) || null
      this._decorate(monthly)
      this._decorate(annual)
      if (!monthly) {
        // 服务端权威价格缺失 → 失败闭合，绝不编造价格。
        this.setData({ loadError: '会员方案加载失败，请稍后重试', product: null, loading: false })
        return
      }
      const product = this.data.plan === 'annual' && annual ? annual : monthly
      this.setData({
        monthly, annual, product, productId: product.productId, loading: false,
        priceDisplay: product.priceDisplay,
        originalPriceDisplay: product.originalPriceDisplay,
        hasOriginalPrice: product.hasOriginalPrice,
      })
    } catch (err) {
      console.error('[Membership] product load fail', err)
      this.setData({ loadError: '会员方案加载失败，请重试', loading: false })
    }
  },

  _decorate(p) {
    if (!p) return
    p.priceDisplay = (p.price / 100).toFixed(2)
    p.originalPriceDisplay = p.originalPrice ? (p.originalPrice / 100).toFixed(2) : ''
    p.hasOriginalPrice = !!p.originalPrice
    p.perMonth = (p.productId === ANNUAL && p.durationDays)
      ? (p.price / 100 / (p.durationDays / 30)).toFixed(1)
      : ''
  },

  onSelectPlan(e) {
    const plan = e.currentTarget.dataset.plan
    const product = plan === 'annual' && this.data.annual ? this.data.annual : this.data.monthly
    if (!product) return
    this.setData({
      plan,
      product,
      productId: product.productId,
      priceDisplay: product.priceDisplay,
      originalPriceDisplay: product.originalPriceDisplay,
      hasOriginalPrice: product.hasOriginalPrice,
    })
  },

  async onPay() {
    const product = this.data.product
    if (!product || this.data.paying) return
    return this._payVirtual(product)
  },

  // ── 微信虚拟支付（RC8_13 会员新售唯一通道）──
  //   仅上送本地 productId + jsCode；价格/offerId/virtualProductId/openid 由服务端权威。
  //   客户端 success 仅进入「确认中」；权益一律以服务端 verifyVirtualPayment 为准。
  //   绝不回退普通 wx.requestPayment；不本地发放权益。
  async _payVirtual(product) {
    this.setData({ paying: true })
    userTrack.event('payment_create', { productId: product.productId })
    try {
      const login = await new Promise((resolve, reject) => {
        wx.login({ success: resolve, fail: reject })
      })
      if (!login || !login.code) throw new Error('wx.login 未返回 code')

      const r = await paymentService.createVirtualOrder(product.productId, login.code)

      if (r && r.code === 10020 && r.data && r.data.entitled) {
        // 服务端已拥有权益（防重复扣款）— 友好提示并返回，不再次扣款。
        console.log('[Membership] already entitled, skip virtual payment', { source: r.data.source })
        wx.showToast({ title: r.message || '已开通，无需重复购买', icon: 'none', duration: 2000 })
        this._navTimer = setTimeout(() => { wx.navigateBack() }, 1500)
        return
      }

      if (!r || r.code !== 0 || !r.data) {
        // 失败闭合：不编造价格、不回落普通支付
        console.warn('[Membership] createVirtualOrder rejected', { code: r && r.code, reason: r && r.data && r.data.reason })
        wx.showToast({ title: (r && r.message) || '当前暂无法购买', icon: 'none' })
        userTrack.event('payment_fail', { reason: 'create_virtual_order' })
        return
      }

      const order = r.data
      userTrack.event('virtual_pay_invoke', { productId: product.productId, outTradeNo: order.outTradeNo })

      // signData 原样透传（服务端已序列化一次；客户端不得再序列化）
      const pay = await paymentService.requestVirtualPayment(order)
      if (!pay.success) {
        const cancelled = pay.errCode === -2 // 用户取消
        wx.showToast({ title: cancelled ? '支付已取消' : '支付未完成，请重试', icon: 'none' })
        userTrack.event('payment_fail', { reason: 'virtual_pay', errCode: pay.errCode })
        return
      }

      // 客户端 success ≠ 权益权威 → 仅进入「确认中」，轮询服务端权威
      wx.showToast({ title: '支付确认中…', icon: 'none' })
      const verifyRes = await this._pollVirtual(order.outTradeNo)

      if (verifyRes && verifyRes.code === 0 && verifyRes.data && verifyRes.data.status === 'paid') {
        wx.showToast({ title: '会员已开通！', icon: 'success' })
        userTrack.event('payment_success', { productId: product.productId, outTradeNo: order.outTradeNo })
        this._navTimer = setTimeout(() => { wx.navigateBack() }, 800)
      } else {
        wx.showToast({ title: '支付确认中，请稍后查看', icon: 'none' })
      }
    } catch (err) {
      console.error('[Membership] virtual pay fail', err)
      userTrack.event('payment_fail', { reason: 'error' })
      wx.showToast({ title: '支付未完成，请重试', icon: 'none' })
    } finally {
      this.setData({ paying: false })
    }
  },

  // 服务端权威确认轮询（回调/查单最终一致；不在本地发放权益）
  async _pollVirtual(orderId, attempts = 4) {
    let last = null
    for (let i = 0; i < attempts; i++) {
      last = await paymentService.verifyVirtualPayment(orderId)
      if (last && last.code === 0 && last.data && last.data.status === 'paid') return last
      await new Promise((resolve) => setTimeout(resolve, 1200))
    }
    return last
  },

  onRetry() {
    this.setData({ loading: true, loadError: '' })
    this.loadProducts()
  },

  onBack() {
    wx.navigateBack()
  },
  onUnload() {
    if (this._navTimer) { clearTimeout(this._navTimer); this._navTimer = null }
  },
  onCancelUnlock() {
    if (this.data.paying) return
    console.log('[MembershipCancel]', {
      paying: this.data.paying,
      pageCount: getCurrentPages().length,
      action: getCurrentPages().length > 1 ? 'navigateBack' : 'reLaunch',
    })
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
    } else {
      wx.reLaunch({ url: '/pages/home/home' })
    }
  },
})
