/**
 * pages/membership/membership.js — 挑战解锁专用页
 * 来源：challenge-play 锁定卡 → 支付解锁 → 返回继续挑战
 */
const paymentService = require('../../services/paymentService.js')
const userTrack = require('../../utils/userTrack.js')

Page({
  data: {
    source: '',
    recordId: '',
    productId: '',
    product: null,
    paying: false,
    loading: true,
    // Stage5B: report_9_9 purchase requires a server-issued reportId (recordId).
    // Missing reportId or a still-generating/failed report must NOT create an order,
    // and must NEVER fall back to the default 39.9 product.
    blockedNoRecord: false,
  },

  onLoad(opt) {
    const source = opt.source || ''
    const recordId = opt.recordId || ''
    const productId = opt.productId || 'challenge_39_9'
    this.setData({ source, recordId, productId })
    // RC8.9B — 进入付款页（best-effort）
    userTrack.event('payment_view', { productId, source: source || '' })

    // report_9_9 is a report-unlock SKU: relatedId MUST be the server reportId.
    // Without it we block payment entirely (no default-product fallback).
    if (productId === 'report_9_9' && !recordId) {
      this.setData({ blockedNoRecord: true, loading: false })
      wx.showToast({ title: '报告信息缺失，请返回重试', icon: 'none' })
      return
    }
    this.loadProduct(productId)
  },

  async loadProduct(productId) {
    try {
      const r = await paymentService.getProductList()
      if (r.code === 0) {
        const products = r.data.products || r.data || []
        const product = products.find(p => p.productId === productId)
        if (product) {
          this.setData({
            product,
            priceDisplay: (product.price / 100).toFixed(2),
            originalPriceDisplay: product.originalPrice ? (product.originalPrice / 100).toFixed(2) : '',
            hasOriginalPrice: !!product.originalPrice,
          })
        } else {
          // Product not found in server config. Price is server-authoritative, so we
          // NEVER fabricate one. challenge_39_9 preserves its legacy local fallback;
          // report_9_9 fails closed (no 39.9 default).
          if (productId === 'report_9_9') {
            this.setData({ loadError: '商品配置加载失败，请稍后重试', product: null })
            return
          }
          console.warn('[ChallengeUnlock] product not found, using fallback')
          this.setData({
            product: {
              productId: 'challenge_39_9',
              name: '解锁完整30天认知挑战',
              description: '30天人生模拟器·从底层打工到财富自由·每道题都在诊断你的认知层级',
              price: 3990,
              originalPrice: 5990,
              type: 'single',
            },
            priceDisplay: '39.90',
            originalPriceDisplay: '59.90',
            hasOriginalPrice: true,
          })
        }
      } else {
        throw new Error('商品加载失败')
      }
    } catch (err) {
      console.error('[ChallengeUnlock] product load fail', err)
      this.setData({ loadError: '商品加载失败，请重试' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async onPay() {
    if (!this.data.productId || this.data.paying) return

    // Hard block: report_9_9 with no server reportId must not create an order.
    if (this.data.productId === 'report_9_9' && !this.data.recordId) {
      this.setData({ blockedNoRecord: true })
      wx.showToast({ title: '报告信息缺失，无法购买', icon: 'none' })
      return
    }

    this.setData({ paying: true })

    try {
      // 1. 创建订单
      //    relatedId = server reportId (report_9_9) / challenge recordId (39.9).
      //    The server derives the price from its own product config.
      const relatedId = this.data.productId === 'report_9_9'
        ? this.data.recordId
        : (this.data.recordId || 'challenge_unlock')
      const r = await paymentService.createOrder(this.data.productId, relatedId)

      if (r && r.code === 10020 && r.data && r.data.entitled) {
        // 服务端已拥有权益（防重复扣款）— 友好提示并返回，不再次扣款。
        console.log('[ChallengeUnlock] already entitled, skip payment', { source: r.data.source })
        wx.showToast({ title: r.message || '已解锁，无需重复购买', icon: 'none', duration: 2000 })
        this.setData({ paying: false })
        this._navTimer = setTimeout(() => { wx.navigateBack() }, 1500)
        return
      }

      if (!r || r.code !== 0) {
        throw new Error(r?.message || '创建订单失败')
      }

      const order = r.data
      console.log('[ChallengeUnlock] order created', { orderId: order.orderId })
      // RC8.9B — 创建订单（best-effort）
      userTrack.event('payment_create', { productId: this.data.productId })

      // 2. 调微信支付
      if (order.paymentParams && !order.paymentParams._mock) {
        const paymentResult = await paymentService.requestPayment(order.paymentParams)

        if (!paymentResult.success) {
          // 用户取消 — 不写 paid
          wx.showToast({ title: '支付已取消', icon: 'none' })
          userTrack.event('payment_fail', { reason: 'cancel' })
          return
        }
      } else if (order.paymentParams && order.paymentParams._mock) {
        console.log('[ChallengeUnlock] mock payment')
        wx.showToast({ title: '测试支付完成', icon: 'success' })
      }

      // 3. 验证支付
      const verifyRes = await paymentService.verifyPayment(order.orderId)
      console.log('[ChallengeUnlock] verifyPay', verifyRes)

      if (verifyRes.code === 0 && verifyRes.data && verifyRes.data.status === 'paid') {
        wx.showToast({ title: '解锁成功！', icon: 'success' })
        userTrack.event('payment_success', { productId: this.data.productId })
        this._navTimer = setTimeout(() => { wx.navigateBack() }, 800)
      } else if (verifyRes.code === 0 && verifyRes.data && verifyRes.data.status === 'pending') {
        // 验单处理中 — 不误报已解锁
        wx.showToast({ title: '支付确认中，请稍后查看报告', icon: 'none' })
      } else {
        wx.showToast({ title: '支付确认中，请稍后重试', icon: 'none' })
      }
    } catch (err) {
      console.error('[ChallengeUnlock] pay fail', err)
      userTrack.event('payment_fail', { reason: 'error' })
      wx.showToast({ title: '支付未完成，请重试', icon: 'none' })
    } finally {
      this.setData({ paying: false })
    }
  },

  onRetry() {
    this.setData({ loading: true, loadError: '' })
    this.loadProduct(this.data.productId)
  },

  onBack() {
    wx.navigateBack()
  },
  onUnload() {
    if (this._navTimer) { clearTimeout(this._navTimer); this._navTimer = null }
  },
  onCancelUnlock() {
    if (this.data.paying) return
    console.log('[MembershipCancelUnlock]', {
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
