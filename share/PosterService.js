/**
 * share/PosterService.js — 统一海报保存服务 v1.0
 *
 * 职责：
 *   - 相册权限申请
 *   - Canvas 离屏导出
 *   - saveImageToPhotosAlbum
 *   - 统一 Toast
 *   - 失败回退 previewImage
 *
 * 用法：
 *   const PosterService = require('../../share/PosterService.js')
 *
 *   PosterService.save({
 *     type: 'worldRule',
 *     canvasId: 'posterCanvas',
 *     canvasW: 750,
 *     canvasH: calculatedH,
 *     drawFn: (ctx) => { ... 绘制逻辑 ... },
 *     page: this,
 *   })
 *
 * 流程：
 *   Loading "正在生成海报..."
 *   → drawFn(ctx) 绘制
 *   → canvasToTempFilePath 导出
 *   → authorize → saveImageToPhotosAlbum
 *   → Toast "✓ 海报已保存到手机相册"
 *   → 失败 → previewImage 回退
 */

const analytics = require('../utils/analytics.js')

// ═══ 超时工具 ═══
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label || 'timeout')), ms)
    promise.then(r => { clearTimeout(timer); resolve(r) }).catch(e => { clearTimeout(timer); reject(e) })
  })
}

// ═══ 阶段日志 ═══
let _t0 = 0
function log(step, msg) {
  const ts = Date.now(); const el = _t0 ? (ts - _t0) + 'ms' : '0ms'; _t0 = ts
  console.log('[PosterService] ' + step + ' +' + el + (msg ? ' ' + msg : ''))
}

/**
 * 统一保存流程
 *
 * @param {Object} opts
 * @param {string} opts.type        - 海报类型: worldRule | cognitiveStrike | turnaround | aiReport
 * @param {string} opts.canvasId    - Canvas canvas-id
 * @param {number} opts.canvasW     - Canvas 宽度
 * @param {number} opts.canvasH     - Canvas 高度（动态计算后传入）
 * @param {Function} opts.drawFn    - (ctx) => void  绘制函数
 * @param {Page} opts.page          - 当前页 this
 * @param {Object} opts.extra       - 附加信息: { ruleId, dateId, ... } 用于 analytics
 */
function save(opts) {
  const { type, canvasId, canvasW, canvasH, drawFn, page, extra } = opts

  if (!page || !drawFn) {
    console.error('[PosterService] missing page or drawFn')
    return
  }

  log('01', 'start type=' + type)

  // 防重复
  if (page._psBusy) {
    console.log('[PosterService] BLOCKED - generating in progress')
    return
  }
  page._psBusy = true

  wx.showLoading({ title: '正在生成海报...', mask: true })

  _generate({ type, canvasId, canvasW, canvasH, drawFn, page, extra })
    .then(tempPath => _saveToAlbum(tempPath, page))
    .then(() => {
      log('90', 'save success')
      wx.showToast({ title: '海报已保存到手机相册', icon: 'success', duration: 2000 })
      try { analytics.track('poster_saved', { type, ...(extra || {}) }) } catch (_) {}
    })
    .catch(err => {
      log('99', 'fail: ' + (err && err.message))
      console.error('[PosterService] fail:', err)

      // 相册权限拒绝 → 引导授权
      if (err && err.message && err.message.includes('auth')) {
        wx.showModal({
          title: '需要相册权限',
          content: '请前往设置开启「保存到相册」权限',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) wx.openSetting()
          },
        })
      }
      // 保存失败但有临时路径 → 预览回退
      else if (err && err._tempPath) {
        wx.hideLoading()
        page._psBusy = false
        wx.previewImage({ current: err._tempPath, urls: [err._tempPath] })
        return  // previewImage 已接管，不执行 finally 里的 hideLoading
      }
      // 其他失败
      else {
        wx.showToast({
          title: '海报生成失败，请重试',
          icon: 'none',
          duration: 2500,
        })
      }
    })
    .finally(() => {
      wx.hideLoading()
      page._psBusy = false
      log('99', 'finally reset')
    })
}

// ═══ 生成导出 ═══
function _generate(opts) {
  const { canvasId, canvasW, canvasH, drawFn, page } = opts

  return new Promise((resolve, reject) => {
    // 确保 Canvas 尺寸
    if (!canvasW || !canvasH || canvasW <= 0 || canvasH <= 0) {
      reject(new Error('canvas size invalid: ' + canvasW + 'x' + canvasH))
      return
    }

    log('02', 'canvas ' + canvasW + 'x' + canvasH)

    const ctx = wx.createCanvasContext(canvasId, page)
    if (!ctx) { reject(new Error('createCanvasContext failed')); return }

    log('03', 'draw start')

    // 执行绘制
    try {
      drawFn(ctx)
    } catch (e) {
      reject(new Error('drawFn error: ' + e.message))
      return
    }

    // draw + 5s 超时
    const drawPromise = new Promise((res, rej) => {
      ctx.draw(false, () => {
        log('04', 'draw callback')
        res()
      })
    })

    withTimeout(drawPromise, 6000, 'draw timeout')
      .then(() => {
        log('05', 'export start')
        return new Promise((res, rej) => {
          wx.canvasToTempFilePath({
            canvasId,
            x: 0, y: 0,
            width: canvasW, height: canvasH,
            destWidth: canvasW * 2, destHeight: canvasH * 2,
            success: (r) => {
              log('06', 'export ok')
              if (!r || !r.tempFilePath) {
                rej(new Error('tempFilePath empty'))
              } else {
                res(r.tempFilePath)
              }
            },
            fail: (e) => {
              log('06', 'export fail: ' + (e && e.errMsg ? e.errMsg : JSON.stringify(e)))
              rej(e || new Error('export fail'))
            },
          }, page)
        })
      })
      // export 8s 超时
      .then(path => withTimeout(Promise.resolve(path), 10000, 'export timeout').then(p => resolve(p)).catch(e => reject(e)))
      .catch(e => reject(e))
  })
}

// ═══ 保存到相册 ═══
function _saveToAlbum(tempPath, page) {
  return new Promise((resolve, reject) => {
    log('07', 'save start')

    // 先检查权限
    wx.getSetting({
      success: (setting) => {
        const auth = setting.authSetting['scope.writePhotosAlbum']

        if (auth === false) {
          // 用户拒绝过 → 直接 reject 带 auth 标记
          reject(_createAuthError(tempPath))
          return
        }

        // 未询问或已授权 → 走 authorize
        _doAuthorizeAndSave(tempPath, page, resolve, reject)
      },
      fail: () => {
        // getSetting 失败 → 直接尝试保存
        _doAuthorizeAndSave(tempPath, page, resolve, reject)
      },
    })
  })
}

function _doAuthorizeAndSave(tempPath, page, resolve, reject) {
  wx.authorize({
    scope: 'scope.writePhotosAlbum',
    success: () => {
      log('08', 'auth ok')
      wx.saveImageToPhotosAlbum({
        filePath: tempPath,
        success: () => {
          log('09', 'saved to album')
          resolve()
        },
        fail: (e) => {
          log('09', 'save fail: ' + (e && e.errMsg || JSON.stringify(e)))
          if (e && e.errMsg && e.errMsg.includes('auth')) {
            reject(_createAuthError(tempPath))
          } else {
            // 保存失败 → 预览回退
            const err = new Error('save fail')
            err._tempPath = tempPath
            reject(err)
          }
        },
      })
    },
    fail: (e) => {
      log('08', 'auth denied: ' + (e && e.errMsg || ''))
      reject(_createAuthError(tempPath))
    },
  })
}

function _createAuthError(tempPath) {
  const err = new Error('auth denied')
  err._tempPath = tempPath
  return err
}

/**
 * 直接保存到相册（传入已导出的临时路径）
 * 返回 Promise，每个分支都有明确的 resolve/reject。
 * @param {string} tempPath
 * @param {string} type - 海报类型标识
 * @returns {Promise<void>}
 */
function saveToAlbum(tempPath, type) {
  log('SA', 'start type=' + type)

  const doSave = () => {
    return new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({
        filePath: tempPath,
        success: () => {
          log('SA', 'saved ok')
          wx.showToast({ title: '海报已保存到手机相册', icon: 'success', duration: 2000 })
          try { analytics.track('poster_saved', { type: type || '' }) } catch (_) {}
          resolve()
        },
        fail: (e) => {
          log('SA', 'save fail: ' + (e && e.errMsg || ''))
          if (e && e.errMsg && (e.errMsg.includes('auth') || e.errMsg.includes('deny') || e.errMsg.includes('denied'))) {
            reject(new Error('相册权限未开启'))
          } else {
            // 保存失败 → 回退预览
            wx.previewImage({ current: tempPath, urls: [tempPath] })
            resolve() // 预览已作为回退，不算完全失败
          }
        },
      })
    })
  }

  return new Promise((resolve, reject) => {
    wx.getSetting({
      success: (s) => {
        if (s.authSetting['scope.writePhotosAlbum'] === false) {
          wx.showModal({
            title: '需要相册权限',
            content: '请前往设置开启「保存到相册」权限',
            confirmText: '去设置',
            cancelText: '取消',
            success: (r) => {
              if (r.confirm) {
                wx.openSetting({
                  success: (ss) => {
                    if (ss.authSetting['scope.writePhotosAlbum']) {
                      doSave().then(resolve).catch(reject)
                    } else {
                      reject(new Error('相册权限未开启'))
                    }
                  },
                  fail: () => { reject(new Error('打开设置失败')) },
                })
              } else {
                reject(new Error('相册权限未开启'))
              }
            },
            fail: () => { reject(new Error('相册权限未开启')) },
          })
        } else {
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success: () => { doSave().then(resolve).catch(reject) },
            fail: () => {
              wx.showModal({
                title: '需要相册权限',
                content: '请前往设置开启「保存到相册」权限',
                confirmText: '去设置',
                cancelText: '取消',
                success: (r) => {
                  if (r.confirm) {
                    wx.openSetting({
                      success: (ss) => {
                        if (ss.authSetting['scope.writePhotosAlbum']) {
                          doSave().then(resolve).catch(reject)
                        } else {
                          reject(new Error('相册权限未开启'))
                        }
                      },
                      fail: () => { reject(new Error('打开设置失败')) },
                    })
                  } else {
                    reject(new Error('相册权限未开启'))
                  }
                },
                fail: () => { reject(new Error('相册权限未开启')) },
              })
            },
          })
        }
      },
      fail: () => { doSave().then(resolve).catch(reject) },
    })
  })
}

module.exports = { save, saveToAlbum }
