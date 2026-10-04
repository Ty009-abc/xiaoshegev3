/**
 * createVirtualOrder — RC8_13 虚拟支付·下单（服务器权威 · 沙箱就绪）
 *
 * 流程（全部服务端权威）：
 *   1. 认证 openid（cloud.getWXContext）
 *   2. 商品目录（服务端）解析 priceFen / durationDays / virtualProductId / mode
 *   3. 生成唯一 outTradeNo，持久化本地 pending_payment 订单（payChannel: wechat_virtual）
 *   4. 构造 signData（固定字段顺序，序列化一次）→ paySig(appKey) + signature(session_key)
 *   5. 返回 { mode, signData(原串), paySig, signature, outTradeNo }
 *
 * 安全：AppKey / session_key / access_token 绝不返回客户端、绝不落盘、绝不入日志。
 * 客户端不可提供 price / offerId / virtualProductId / openid。
 * 发售开关 VIRTUAL_PAY_SALES_MODE 默认 DISABLED（失败闭合，绝不放行新售）。
 *
 * 客户端契约：STEP_2 收到 signData 后必须原样字符串透传给 wx.requestVirtualPayment，
 *   严禁 JSON.parse + JSON.stringify（字节不一致 → -15006/-15005）。
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')
const { getCatalog, resolveVirtualPayConfig } = require('./lib/virtualPayCatalog.js')
const {
  buildSignData,
  serializeSignData,
  calcPaySig,
  calcUserSignature,
  selectAppKey,
  resolveEnvFlag,
  URI_REQUEST_VIRTUAL_PAYMENT,
  getSessionKey,
} = require('./lib/virtualPaySigning.js')

const { rightsForProduct } = require('./lib/accessAuthority.js')

const now = () => Date.now()

// outTradeNo：8-32 字符，[0-9A-Za-z_-|*@]，不以 _ 开头。前缀 VO(virtual order) 保证唯一性充分。
function generateOutTradeNo () {
  const d = new Date()
  const p = (n, w = 2) => String(n).padStart(w, '0')
  const ts = p(d.getFullYear() % 100) + p(d.getMonth() + 1) + p(d.getDate()) +
    p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds())
  const rand = require('crypto').randomBytes(4).toString('hex').toUpperCase()
  return 'VO' + ts + rand
}

exports.main = async (event) => {
  // ── 配置自检（仅布尔；无需登录态）──
  if (event && event.__selfcheck === true) {
    return ok({
      virtualPay: resolveVirtualPayConfig(process.env),
      service: 'createVirtualOrder', stage: 'stage1',
    })
  }

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED, '未认证用户')

  const { productId, jsCode = '', attach = '' } = event || {}
  if (!productId) return fail(CODES.PARAM_ERROR, '缺少 productId')

  const cfgEnv = resolveVirtualPayConfig(process.env)
  const envFlag = resolveEnvFlag(process.env)
  const ts = now()

  // ── 发售模式（服务端权威，失败闭合）──
  if (cfgEnv.salesMode !== 'ENABLED') {
    return fail(CODES.PRODUCT_INACTIVE, '当前版本暂不提供该商品的购买', {
      salesDisabled: true, reason: 'VIRTUAL_PAY_SALES_DISABLED',
    })
  }

  // ── 商品目录（服务端权威）──
  const product = getCatalog(productId)
  if (!product) return fail(CODES.NOT_FOUND, '商品不存在或未开通虚拟支付')

  // ── 环境配置门禁（存在性；绝不返回值）──
  const missing = []
  if (!cfgEnv.offerIdPresent) missing.push('VIRTUAL_PAY_OFFER_ID')
  if (envFlag === 0 && !cfgEnv.prodAppKeyPresent) missing.push('VIRTUAL_PAY_PROD_APP_KEY')
  if (envFlag === 1 && !cfgEnv.sandboxAppKeyPresent) missing.push('VIRTUAL_PAY_SANDBOX_APP_KEY')
  if (missing.length > 0) return fail(CODES.CONFIG_ERROR, '虚拟支付环境未配置', { missing })

  // ── session_key（用户态签名权威来源）──
  const sess = await getSessionKey(process.env, jsCode)
  if (!sess || !sess.sessionKey) {
    return fail(CODES.CONFIG_ERROR, 'session_key 获取失败（需配置 WX_APPID/WX_APPSECRET 且传入 jsCode）', {
      code2Session: false,
    })
  }
  if (sess.openid && sess.openid !== openid) {
    return fail(CODES.FORBIDDEN, '登录态与当前用户不一致')
  }

  const appKey = selectAppKey(process.env, envFlag)
  if (!appKey) return fail(CODES.CONFIG_ERROR, '虚拟支付 AppKey 缺失', { envFlag })

  // ── 订单号 + 本地订单 ──
  const outTradeNo = generateOutTradeNo()
  const orderId = outTradeNo
  const signDataObj = buildSignData(product, { offerId: cfgEnv.offerId, envFlag }, outTradeNo, attach)
  const signDataStr = serializeSignData(signDataObj) // 唯一序列化点
  const paySig = calcPaySig(URI_REQUEST_VIRTUAL_PAYMENT, signDataStr, appKey)
  const signature = calcUserSignature(signDataStr, sess.sessionKey)
  if (!paySig || !signature) return fail(CODES.CONFIG_ERROR, '签名生成失败')

  // 本地订单：pending_payment，权威字段全部服务端写入
  try {
    await db.collection('orders').add({
      data: {
        orderId,
        openid,
        productId: product.localProductId,
        productName: product.displayName,
        totalAmount: product.priceFen,
        amount: product.priceFen,
        type: 'membership',
        payChannel: 'wechat_virtual',
        mode: product.mode,
        env: envFlag,
        virtualProductId: product.virtualProductId,
        outTradeNo,
        attach: attach == null ? '' : String(attach),
        status: 'pending_payment',
        entitlementSnapshot: {
          productId: product.localProductId,
          durationDays: product.durationDays,
          rights: rightsForProduct(product.localProductId),
        },
        transactionId: '',
        paidAt: 0,
        createdAt: ts,
        updatedAt: ts,
      },
    })
  } catch (err) {
    console.error('[createVirtualOrder] 订单落库失败:', err.message)
    return fail(CODES.DB_ERROR, '订单创建失败')
  }

  console.log(`[createVirtualOrder] order created outTradeNo=${outTradeNo} product=${product.localProductId} env=${envFlag}`)

  return ok({
    mode: product.mode,
    signData: signDataStr, // 原串，客户端原样透传
    paySig,
    signature,
    outTradeNo,
    orderId,
    env: envFlag,
  })
}
