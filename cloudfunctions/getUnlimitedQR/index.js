/**
 * getUnlimitedQR v1.0 — 生成无限制小程序码
 * 前端调用: wx.cloud.callFunction({ name:'getUnlimitedQR', data:{ scene, page } })
 * 返回: { code:0, data:{ fileID } } — 小程序码云存储 fileID
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  const { scene = 'shock', page = 'subpkg-ai/cognitive-shock-detail/cognitive-shock-detail' } = event

  console.log('[getUnlimitedQR] request scene:', scene, 'page:', page)

  try {
    const result = await cloud.openapi.wxacode.getUnlimited({
      scene,
      page,
      width: 280,
      autoColor: false,
      lineColor: { r: 127, g: 86, b: 217 },  // 紫色主题
      isHyaline: false,
      envVersion: 'release',  // 正式版
      checkPath: false,       // 跳过页面路径预检（分包页面有时会报错）
    })

    if (!result || !result.buffer) {
      return { code: -1, message: 'wxacode.getUnlimited 返回空 buffer' }
    }

    // 上传到云存储
    const cloudPath = `qrcode/shock_${scene}_${Date.now()}.jpg`
    const uploadRes = await cloud.uploadFile({
      cloudPath,
      fileContent: result.buffer,
    })

    console.log('[getUnlimitedQR] upload success, fileID:', uploadRes.fileID)

    return {
      code: 0,
      data: {
        fileID: uploadRes.fileID,
        cloudPath,
      },
    }
  } catch (err) {
    console.error('[getUnlimitedQR] error:', err)
    return {
      code: -1,
      message: err.errMsg || err.message || '生成失败',
      detail: JSON.stringify(err),
    }
  }
}
