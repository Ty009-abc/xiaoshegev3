/**
 * pages/membership/membership.js — 认知会员购买页（RC8_11 会员权威）
 *
 * 新主售：认知会员月卡 ¥39.9 / 年卡 ¥299。
 * 退役商品（report_9_9 / challenge_39_9 / vip_month_99）不再新售 ——
 *   历史用户权益由服务端权威保留（本页不参与其放行判定，客户端绝不覆盖）。
 * 价格/权益一律以服务端商品配置为准，客户端不编造价格。
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
    this.setData({ paying: true })

    try {
      // relatedId 仅作上下文记录（会员不绑定单条报告/挑战实体）。
      const relatedId = this.data.recordId || ''
      const r = await paymentService.createOrder(product.productId, relatedId)

      if (r && r.code === 10020 && r.data && r.data.entitled) {
        // 服务端已拥有权益（防重复扣款）— 友好提示并返回，不再次扣款。
        console.log('[Membership] already entitled, skip payment', { source: r.data.source })
        wx.showToast({ title: r.message || '已开通，无需重复购买', icon: 'none', duration: 2000 })
        this.setData({ paying: false })
        this._navTimer = setTimeout(() => { wx.navigateBack() }, 1500)
        return
      }

      if (!r || r.code !== 0) {
        throw new Error((r && r.message) || '创建订单失败')
      }

      const order = r.data
      console.log('[Membership] order created', { orderId: order.orderId })
      userTrack.event('payment_create', { productId: product.productId })

      if (order.paymentParams && !order.paymentParams._mock) {
        const paymentResult = await paymentService.requestPayment(order.paymentParams)
        if (!paymentResult.success) {
          wx.showToast({ title: '支付已取消', icon: 'none' })
          userTrack.event('payment_fail', { reason: 'cancel' })
          return
        }
      } else if (order.paymentParams && order.paymentParams._mock) {
        console.log('[Membership] mock payment')
        wx.showToast({ title: '测试支付完成', icon: 'success' })
      }

      const verifyRes = await paymentService.verifyPayment(order.orderId)
      console.log('[Membership] verifyPay', verifyRes)

      if (verifyRes.code === 0 && verifyRes.data && verifyRes.data.status === 'paid') {
        wx.showToast({ title: '会员已开通！', icon: 'success' })
        userTrack.event('payment_success', { productId: product.productId })
        this._navTimer = setTimeout(() => { wx.navigateBack() }, 800)
      } else if (verifyRes.code === 0 && verifyRes.data && verifyRes.data.status === 'pending') {
        wx.showToast({ title: '支付确认中，请稍后查看', icon: 'none' })
      } else {
        wx.showToast({ title: '支付确认中，请稍后重试', icon: 'none' })
      }
    } catch (err) {
      console.error('[Membership] pay fail', err)
      userTrack.event('payment_fail', { reason: 'error' })
      wx.showToast({ title: '支付未完成，请重试', icon: 'none' })
    } finally {
      this.setData({ paying: false })
    }
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
