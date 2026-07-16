/**
 * pages/membership/membership.js — 挑战解锁专用页
 * 来源：challenge-play 锁定卡 → 支付解锁 → 返回继续挑战
 */
const paymentService = require('../../services/paymentService.js')

Page({
  data: {
    source: '',
    recordId: '',
    productId: '',
    product: null,
    paying: false,
    loading: true,
  },

  onLoad(opt) {
    const source = opt.source || ''
    const recordId = opt.recordId || ''
    const productId = opt.productId || 'challenge_39_9'
    this.setData({ source, recordId, productId })
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
    this.setData({ paying: true })

    try {
      // 1. 创建订单
      const r = await paymentService.createOrder(
        this.data.productId,
        this.data.recordId || 'challenge_unlock'
      )

      if (!r || r.code !== 0) {
        throw new Error(r?.message || '创建订单失败')
      }

      const order = r.data
      console.log('[ChallengeUnlock] order created', { orderId: order.orderId })

      // 2. 调微信支付
      if (order.paymentParams && !order.paymentParams._mock) {
        const paymentResult = await paymentService.requestPayment(order.paymentParams)

        if (!paymentResult.success) {
          // 用户取消 — 不写 paid
          wx.showToast({ title: '支付已取消', icon: 'none' })
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
        setTimeout(() => { wx.navigateBack() }, 800)
      } else {
        wx.showToast({ title: '支付确认中，请稍后重试', icon: 'none' })
      }
    } catch (err) {
      console.error('[ChallengeUnlock] pay fail', err)
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
})
