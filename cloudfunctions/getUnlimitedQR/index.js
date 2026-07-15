/**
 * getUnlimitedQR v2.0 — 分阶段诊断小程序码生成
 * 前端: wx.cloud.callFunction({ name:'getUnlimitedQR', data:{ scene, page } })
 * 成功: { code:0, data:{ fileID, cloudPath, scene, page } }
 * 失败: { code:非0, stage, errCode, errMsg }
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 安全字符校验
const SAFE_SCENE_RE = /^[a-zA-Z0-9_-]+$/

exports.main = async (event) => {
  const scene = String(event.scene || 'shock')
  const page = String(event.page || 'subpkg-ai/cognitive-shock-detail/cognitive-shock-detail')

  // ═══ STAGE_1_VALIDATE_INPUT ═══
  console.log('[QR] validate page=' + page + ' scene=' + scene)

  // page: 不能以 / 开头
  if (page.startsWith('/')) {
    console.error('[QR] validate FAIL: page starts with /')
    return { code: 1001, stage: 'STAGE_1_VALIDATE_INPUT', errCode: 'PAGE_LEADING_SLASH', errMsg: 'page参数不能以/开头' }
  }

  // page: 长度检查
  if (page.length > 128) {
    return { code: 1002, stage: 'STAGE_1_VALIDATE_INPUT', errCode: 'PAGE_TOO_LONG', errMsg: 'page参数过长: ' + page.length }
  }

  // scene: 长度 <= 32
  if (scene.length > 32) {
    return { code: 1003, stage: 'STAGE_1_VALIDATE_INPUT', errCode: 'SCENE_TOO_LONG', errMsg: 'scene参数过长: ' + scene.length }
  }

  // scene: 安全字符
  if (!SAFE_SCENE_RE.test(scene)) {
    console.warn('[QR] validate WARN: scene contains special chars: ' + scene)
  }

  // ═══ STAGE_2_WXACODE_CALL ═══
  console.log('[QR] wxacode:start scene=' + scene + ' page=' + page + ' envVersion=release checkPath=false')
  let wxacodeResult
  try {
    wxacodeResult = await cloud.openapi.wxacode.getUnlimited({
      scene,
      page,
      width: 280,
      autoColor: false,
      lineColor: { r: 127, g: 86, b: 217 },
      isHyaline: false,
      envVersion: 'release',
      checkPath: false,
    })
  } catch (err) {
    console.error('[QR] wxacode:fail errCode=' + (err.errCode || '') + ' errMsg=' + (err.errMsg || err.message || ''))
    return {
      code: 2001,
      stage: 'STAGE_2_WXACODE_CALL',
      errCode: String(err.errCode || 'WXACODE_API_ERROR'),
      errMsg: err.errMsg || err.message || 'wxacode.getUnlimited调用失败',
    }
  }

  console.log('[QR] wxacode:success typeof=' + typeof wxacodeResult + ' isBuffer=' + Buffer.isBuffer(wxacodeResult))

  // ═══ STAGE_3_BUFFER_VALIDATE ═══
  let buffer
  if (Buffer.isBuffer(wxacodeResult)) {
    buffer = wxacodeResult
  } else if (wxacodeResult && Buffer.isBuffer(wxacodeResult.buffer)) {
    buffer = wxacodeResult.buffer
  } else if (wxacodeResult && wxacodeResult.buffer) {
    buffer = Buffer.from(wxacodeResult.buffer)
  } else {
    console.error('[QR] buffer:invalid type=' + typeof wxacodeResult + ' keys=' + (wxacodeResult ? Object.keys(wxacodeResult).join(',') : 'null'))
    return {
      code: 3001,
      stage: 'STAGE_3_BUFFER_VALIDATE',
      errCode: 'BUFFER_INVALID_TYPE',
      errMsg: 'wxacode返回非Buffer类型: ' + typeof wxacodeResult,
    }
  }

  if (!buffer || buffer.length === 0) {
    console.error('[QR] buffer:empty')
    return {
      code: 3002,
      stage: 'STAGE_3_BUFFER_VALIDATE',
      errCode: 'BUFFER_EMPTY',
      errMsg: 'wxacode返回空Buffer',
    }
  }

  console.log('[QR] buffer:length ' + buffer.length)

  // ═══ STAGE_4_UPLOAD ═══
  const cloudPath = 'qrcode/shock_' + scene + '_' + Date.now() + '.jpg'
  console.log('[QR] upload:start cloudPath=' + cloudPath)

  let uploadRes
  try {
    uploadRes = await cloud.uploadFile({
      cloudPath,
      fileContent: buffer,
    })
  } catch (err) {
    console.error('[QR] upload:fail errCode=' + (err.errCode || '') + ' errMsg=' + (err.errMsg || err.message || ''))
    return {
      code: 4001,
      stage: 'STAGE_4_UPLOAD',
      errCode: String(err.errCode || 'UPLOAD_FAILED'),
      errMsg: err.errMsg || err.message || '云存储上传失败',
    }
  }

  if (!uploadRes || !uploadRes.fileID) {
    console.error('[QR] upload:noFileID')
    return {
      code: 4002,
      stage: 'STAGE_4_UPLOAD',
      errCode: 'UPLOAD_NO_FILEID',
      errMsg: '上传成功但未返回fileID',
    }
  }

  console.log('[QR] upload:success fileID=' + uploadRes.fileID)

  // ═══ STAGE_5_RETURN ═══
  return {
    code: 0,
    data: {
      fileID: uploadRes.fileID,
      cloudPath,
      scene,
      page,
    },
  }
}
