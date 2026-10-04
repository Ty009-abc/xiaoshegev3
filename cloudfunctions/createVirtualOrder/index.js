/**
 * createVirtualOrder — RC8_13 虚拟支付·下单（SKELETON / BOOTSTRAP）
 *
 * 状态：骨架。仅完成「环境配置存在性 + 商品目录解析」两条安全路径；
 *       签名 (paySig/signature) 与订单落库为 Stage1 实现点，当前以
 *       NOT_IMPLEMENTED 显式 fail-closed 返回（绝不发起任何支付、不写库）。
 *
 * 权威（Stage1 实现约定）：
 *   - openid 来自 cloud.getWXContext().OPENID（客户端不可声明）。
 *   - 价格 / durationDays / virtualProductId 一律取自服务端目录 (virtualPayCatalog)。
 *   - AppKey 仅服务端持有；signData 只序列化一次，paySig/signature 按官方规则计算；
 *     绝不把 AppKey / session_key 返回客户端或写入日志。
 *
 * 安全：本骨架不读取、不打印、不返回任何密钥值（仅探测存在性）。
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { ok, fail, CODES } = require('./lib/response.js')
const { getCatalog, resolveVirtualPayConfig } = require('./lib/virtualPayCatalog.js')

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED, '未认证用户')

  const { productId } = event || {}
  if (!productId) return fail(CODES.PARAM_ERROR, '缺少 productId')

  const cfg = resolveVirtualPayConfig(process.env)

  // ── 配置自检（值永不外泄，仅布尔）──
  if (event && event.__selfcheck === true) {
    return ok({ virtualPay: cfg, service: 'createVirtualOrder', stage: 'bootstrap' })
  }

  const product = getCatalog(productId)
  if (!product) return fail(CODES.NOT_FOUND, '商品不存在或未开通虚拟支付')

  // ── 发售模式（服务端权威，失败闭合）──
  if (cfg.salesMode !== 'ENABLED') {
    return fail(CODES.PRODUCT_INACTIVE, '当前版本暂不提供该商品的购买', {
      salesDisabled: true, reason: 'VIRTUAL_PAY_SALES_DISABLED',
    })
  }

  // ── 环境配置门禁（存在性；绝不返回值）──
  const missing = []
  if (!cfg.offerIdPresent) missing.push('VIRTUAL_PAY_OFFER_ID')
  if (cfg.envFlag === 0 && !cfg.prodAppKeyPresent) missing.push('VIRTUAL_PAY_PROD_APP_KEY')
  if (cfg.envFlag === 1 && !cfg.sandboxAppKeyPresent) missing.push('VIRTUAL_PAY_SANDBOX_APP_KEY')
  if (missing.length > 0) {
    return fail(CODES.CONFIG_ERROR, '虚拟支付环境未配置', { missing })
  }

  // ── Stage1 实现点：生成 signData + paySig + signature，创建本地订单 ──
  //    骨架阶段尚未实现（不发起真实支付、不写库）。
  return fail(CODES.NOT_IMPLEMENTED, 'createVirtualOrder 骨架：签名/建单待 Stage1 实现', {
    orderContract: {
      mode: product.mode,
      localProductId: product.localProductId,
      virtualProductId: product.virtualProductId,
      priceFen: product.priceFen,
      durationDays: product.durationDays,
      env: cfg.envFlag,
    },
    expectedReturnFields: ['mode', 'signData', 'paySig', 'signature', 'outTradeNo'],
  })
}
