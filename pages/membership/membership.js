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
    // RC8_13_P0_MEMBER_ENTRY — 会员态（服务端 getMembership 权威；未知绝不渲染为 free）
    mode: '', active: false, memberLoading: false, memberLoadError: false,
    memberDetail: null, memberExpiryText: '', memberLevelText: '', memberRights: [],
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
    // RC8_13_P0_MEMBER_ENTRY — 已付费会员进入会员页显示详情态；绝不自动购买。
    const mode = opt.mode || ''
    this.setData({ source, recordId, productId, plan, mode })
    userTrack.event('payment_view', { productId, source: source || '', mode })
    this.loadProducts()
    // 除显式购买入口(mode=member)外，一律先同步服务端会员态，
    // 避免把已付费用户误当成购买者（强制复购）。
    if (mode !== 'member') this.refreshMemberState()
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

  // ── RC8_13_P0_MEMBER_ENTRY —— 会员态（服务端权威）──
  //   会员页必须能区分「已付费会员」与「免费用户」：会员显示详情，
  //   绝不自动跳转购买、绝不强制复购、绝不覆盖既有到期时间。
  async refreshMemberState() {
    this.setData({ memberLoading: true, memberLoadError: false })
    try {
      const res = await wx.cloud.callFunction({ name: 'getMembership', data: {} })
      const r = (res && res.result) || {}
      if (r.code !== 0) throw new Error('getMembership failed')
      this._decorateMember(r.data || {})
    } catch (err) {
      console.warn('[Membership] getMembership failed:', err && err.message)
      this._setMemberUnknown()
    }
    if (this.data.memberLoading) this.setData({ memberLoading: false })
  },

  _setMemberUnknown() {
    this.setData({
      memberLoading: false, memberLoadError: true,
      memberDetail: null, memberExpiryText: '', memberLevelText: '', memberRights: [],
    })
  },

  // 服务端会员 → 客户端展示装饰（到期/类型文案；绝不编造状态）
  _decorateMember(d) {
    const m = (d && d.membership) || null
    const isActive = !!(d && d.isActive)
    if (!isActive || !m) {
      this.setData({ active: false, memberLoading: false, memberDetail: null, memberExpiryText: '', memberLevelText: '', memberRights: [] })
      return
    }
    const expiryText = this._formatExpiry(m.expiredAt)
    this.setData({
      active: true, memberLoading: false,
      memberDetail: {
        level: m.level || '',
        memberType: m.memberType || '',
        expiredAt: m.expiredAt || 0,
        permissions: m.permissions || [],
        orderId: m.orderId || '',
      },
      memberExpiryText: expiryText,
      memberLevelText: this._memberLevelName(m.memberType || m.level || ''),
      memberRights: this._memberRights(m.permissions || []),
    })
    // 权威会员缺到期时间 → 显式失败态（绝不暗默显示为免费/未知）
    if (!expiryText) this.setData({ memberLoadError: true })
  },

  _formatExpiry(ts) {
    const n = Number(ts)
    if (!n || !isFinite(n)) return ''
    const d = new Date(n + 8 * 3600 * 1000) // 展示按 GMT+8
    const p = (x) => String(x).padStart(2, '0')
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
  },

  _memberLevelName(productId) {
    if (String(productId).indexOf('month') >= 0) return '月卡'
    if (String(productId).indexOf('year') >= 0) return '年卡'
    if (String(productId).indexOf('quarter') >= 0) return '季卡'
    return '会员'
  },

  // 会员权益码 → 展示文案（仅展示，不代表放行判定；放行由服务端权限决定）
  _memberRights(perms) {
    const MAP = {
      ai_member: 'AI 问小事哥',
      report_member: '完整世界模型报告',
      challenge_member: '30天认知挑战',
      memory_member: '长期记忆',
      scenario_member: '6个个性化场景',
    }
    return (perms || []).map((p) => MAP[p] || p)
  },

  // 会员详情入口（会员中心）—— 已付费用户查看权益/到期，不进入购买
  openMemberDetails() {
    wx.navigateTo({ url: '/pages/membership-center/membership-center' })
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
    // RC8_13_P0_MEMBER_ENTRY — 已付费会员绝不二次扣款（服务端 10020 亦兵底）。
    if (this.data.active) {
      wx.showToast({ title: '你已是会员，无需重复购买', icon: 'none' })
      return
    }
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
