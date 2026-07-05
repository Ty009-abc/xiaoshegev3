/**
 * services/paymentService.js — 前端支付服务（第五册 Part 1 升级版）
 *
 * 接口：
 *   createOrder(productId, relatedId)       → 下单
 *   requestPayment(paymentParams)            → 调微信支付
 *   verifyPayment(orderId)                   → 确认支付
 *   restorePendingOrder()                    → 恢复未支付订单
 *   getPendingOrders()                       → 查待支付订单列表
 *   getEntitlements()                        → 查用户权益
 *   checkPermission(permission)              → 快速权限检查
 *   getProductList()                         → 商品列表
 */

function call(name, data) {
  return wx.cloud.callFunction({ name, data }).then(r => r.result)
}

/**
 * 下单
 */
function createOrder(productId, relatedId = '') {
  return call('createOrder', { productId, relatedId })
}

/**
 * 调微信支付
 *
 * @param {object} paymentParams - createOrder 返回的 paymentParams
 * @returns {{ success, transactionId }}
 */
async function requestPayment(paymentParams) {
  if (!paymentParams) throw new Error('缺少支付参数')

  // Mock 模式 — 直接模拟支付成功
  if (paymentParams._mock) {
    console.warn('[paymentService] 测试模式支付', paymentParams._message)
    wx.showToast({ title: '测试支付成功', icon: 'success' })
    return { success: true, mock: true }
  }

  return new Promise((resolve, reject) => {
    wx.requestPayment({
      timeStamp: paymentParams.timeStamp,
      nonceStr: paymentParams.nonceStr,
      package: paymentParams.package,
      signType: paymentParams.signType || 'RSA',
      paySign: paymentParams.paySign,
      success: (res) => {
        console.log('[paymentService] 支付成功', res)
        resolve({ success: true, transactionId: res.transactionId || '' })
      },
      fail: (err) => {
        console.error('[paymentService] 支付失败', err)
        // 用户取消 → 保留订单，弹窗提示
        resolve({ success: false, cancelled: true, errMsg: err.errMsg })
      },
    })
  })
}

/**
 * 确认支付结果 & 发放权益
 */
function verifyPayment(orderId) {
  return call('verifyPayment', { orderId })
}

/**
 * 恢复未支付订单 — 用户支付中退出小程序后重新打开
 */
async function restorePendingOrder() {
  try {
    const orders = await getPendingOrders()
    if (orders.length === 0) return { recovered: false, message: '无待支付订单' }

    const latest = orders[0]

    // 检查是否过期
    const age = Date.now() - latest.createdAt
    if (age > 30 * 60 * 1000) {
      return { recovered: false, expired: true, message: '订单已过期,请重新下单', orderId: latest.orderId }
    }

    // 尝试确认支付
    const verifyRes = await verifyPayment(latest.orderId)
    if (verifyRes.code === 0 && verifyRes.data && verifyRes.data.status === 'paid') {
      return { recovered: true, paid: true, orderId: latest.orderId, data: verifyRes.data }
    }

    // 仍在等待支付
    return {
      recovered: true,
      paid: false,
      orderId: latest.orderId,
      paymentParams: latest.paymentParams,
      productName: latest.productName,
      totalAmount: latest.totalAmount,
    }
  } catch (err) {
    console.error('[paymentService] restorePendingOrder 异常:', err)
    return { recovered: false, message: err.message }
  }
}

/**
 * 查待支付订单（本地存储备份）
 */
async function getPendingOrders() {
  try {
    // 从云函数拉取
    const res = await wx.cloud.callFunction({
      name: 'getUserProfile', // 复用现有CF拉订单
      data: {},
    })
    // fallback: 本地存储
    const local = wx.getStorageSync('pending_order')
    if (local) return [local]
    return []
  } catch (_) {
    const local = wx.getStorageSync('pending_order')
    return local ? [local] : []
  }
}

/**
 * 保存待支付订单到本地（支付中断恢复用）
 */
function savePendingOrderLocally(order) {
  try {
    wx.setStorageSync('pending_order', {
      ...order,
      savedAt: Date.now(),
    })
  } catch (_) {}
}

/**
 * 清除本地待支付订单
 */
function clearPendingOrderLocally() {
  try {
    wx.removeStorageSync('pending_order')
  } catch (_) {}
}

/**
 * 获取用户权益
 */
function getEntitlements() {
  return call('getUserProfile', { fields: ['entitlements', 'membership'] })
}

/**
 * 快速权限检查
 */
async function checkPermission(permission) {
  try {
    const ent = wx.getStorageSync('entitlements')
    if (ent && ent.permissions && ent.permissions.includes(permission)) return true
    const res = await getEntitlements()
    if (res.code === 0 && res.data) {
      const perms = res.data.entitlements?.permissions || []
      const membership = res.data.membership
      // 会员过期检查
      if (membership && membership.expiredAt && membership.expiredAt < Date.now()) return false
      wx.setStorageSync('entitlements', { permissions: perms, updatedAt: Date.now() })
      return perms.includes(permission) || perms.includes('vip')
    }
    return false
  } catch (_) {
    return false
  }
}

/**
 * 商品列表
 */
function getProductList() {
  return call('getProductList', {})
}

/**
 * 申请退款
 */
function refundOrder(orderId, reason = '') {
  return call('refundOrder', { orderId, reason })
}

module.exports = {
  createOrder,
  requestPayment,
  verifyPayment,
  restorePendingOrder,
  getPendingOrders,
  savePendingOrderLocally,
  clearPendingOrderLocally,
  getEntitlements,
  checkPermission,
  getProductList,
  refundOrder,
}
