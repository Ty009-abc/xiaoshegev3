/**
 * cognitive-shock-detail v1.3 — RC5.5 TaskId-based Poster Pipeline
 *
 * 改动：
 *   - async/await Promise 链：QR→Canvas→绘制→导出→保存→finally
 *   - taskId 任务取消机制
 *   - Timer 全量管理
 *   - 不再允许无二维码自动生成海报
 */

const { getTodayStrike } = require('../../utils/cognitionStrike.js')
const StrikeRenderer = require('../../share/CognitiveStrikePosterRenderer.js')
const PService = require('../../share/PosterService.js')

Page({
  data: {
    strike: null, dateId: '', displayDate: '',
    loading: true,
    totalNavHeight: 0, statusBarHeight: 0,
    showPoster: false, posterGenerating: false, posterPath: '', posterHeight: 0,
    qrPath: '', qrStatus: 'idle',
    isCollected: false,
    _canvasH: 0,
  },

  _destroyed: false,
  _posterTaskId: 0,
  _timers: [],

  onLoad(opt) {
    this._initNavBar()
    const strike = getTodayStrike()
    if (!strike || !strike.core_strike) {
      this.setData({ loading: false })
      return
    }
    const dateStr = String(strike.id || '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1/$2/$3')
    this.setData({
      strike, dateId: strike.id || '', displayDate: dateStr, loading: false,
      isCollected: this._checkCollected(strike.id),
    })
    this._ensureQrCode()
  },

  onUnload() {
    this._destroyed = true
    this._posterTaskId = (this._posterTaskId || 0) + 1
    ;(this._timers || []).forEach(clearTimeout)
    this._timers = []
    wx.hideLoading()
  },

  safeSetData(obj) { if (this._destroyed) return; try { this.setData(obj) } catch (_) {} },

  _initNavBar() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const sbh = info.statusBarHeight || 0
    const nbh = menu ? (menu.bottom - sbh) + (menu.top - sbh) : 44
    this.setData({ statusBarHeight: sbh, totalNavHeight: sbh + nbh })
  },

  _checkCollected(id) {
    try { const saved = wx.getStorageSync('strike_collection') || []; return !!saved.find(item => item.id === id) } catch (_) { return false }
  },

  /* ═══════════════════════════════
   * 小程序码懒加载
   * ═══════════════════════════════ */
  _ensureQrCode() {
    if (this._qrFetching || this.data.qrStatus === 'ready' || this.data.qrStatus === 'loading') return
    this._qrFetching = true
    this.setData({ qrStatus: 'loading' })
    console.log('[StrikeQR] fetch start scene=' + (this.data.dateId || 'shock'))
    wx.cloud.callFunction({
      name: 'getUnlimitedQR',
      data: { scene: this.data.dateId || 'shock', page: 'subpkg-ai/cognitive-shock-detail/cognitive-shock-detail' },
      success: (res) => {
        const result = res.result || {}
        const fileID = (result.data && result.data.fileID) || result.fileID || ''
        console.log('[StrikeQR] fileID=' + (fileID ? 'ok' : 'empty'))
        if (fileID) {
          wx.cloud.downloadFile({
            fileID,
            success: (dfRes) => {
              this.setData({ qrPath: dfRes.tempFilePath, qrStatus: 'ready' })
              this._qrFetching = false
            },
            fail: () => { this.setData({ qrPath: '', qrStatus: 'error' }); this._qrFetching = false },
          })
        } else {
          this.setData({ qrPath: '', qrStatus: 'error' })
          this._qrFetching = false
        }
      },
      fail: () => { this.setData({ qrPath: '', qrStatus: 'error' }); this._qrFetching = false },
    })
  },

  // ═══ 基础交互 ═══
  onBack() { wx.navigateBack({ delta: 1 }) },
  onCollect() {
    const s = this.data.strike; if (!s) return
    wx.showActionSheet({
      itemList: ['收藏到本地', '分享给朋友'],
      success: (res) => {
        if (res.tapIndex === 0) {
          try {
            const saved = wx.getStorageSync('strike_collection') || []
            if (!saved.find(item => item.id === s.id)) { saved.unshift({ id: s.id, title: s.core_strike, time: new Date().toISOString() }); wx.setStorageSync('strike_collection', saved.slice(0, 50)) }
            this.setData({ isCollected: true })
            wx.showToast({ title: '已收藏', icon: 'success' })
          } catch (e) { wx.showToast({ title: '收藏失败', icon: 'none' }) }
        } else { wx.showToast({ title: '请点击右上角分享', icon: 'none', duration: 2000 }) }
      },
    })
  },

  onGo() {
    const app = getApp()
    const strike = this.data.strike
    const personalityModes = require('../../utils/personalityModes.js')
    const personality = personalityModes.getRandomPersonality()
    app.globalData._quickAskTopic = strike.core_strike
    app.globalData._quickAskPersonality = personality
    wx.switchTab({ url: '/pages/ai-chat/ai-chat' })
  },

  onClosePoster() { this.setData({ showPoster: false }) },
  preventMove() {},

  onShareAppMessage() {
    const s = this.data.strike || {}
    return {
      title: s.core_strike ? s.core_strike.substring(0, 30) + '...' : '今日认知暴击',
      path: '/subpkg-ai/cognitive-shock-detail/cognitive-shock-detail',
      imageUrl: this.data.posterPath || undefined,
    }
  },

  // ═══════════════════════════════
  // 海报管线：taskId 保证最后一次点击生效
  // ═══════════════════════════════
  async onSaveShockPoster() {
    if (this.data.posterGenerating) {
      console.log('[StrikePoster] blocked: already generating')
      return
    }

    const taskId = (this._posterTaskId || 0) + 1
    this._posterTaskId = taskId
    this.safeSetData({ posterGenerating: true })
    wx.showLoading({ title: '正在生成海报...', mask: true })

    try {
      const strike = this.data.strike
      if (!strike) {
        throw new Error('认知暴击数据未加载')
      }
      console.log('[StrikePoster] 01 validate success')

      // 等待二维码
      const qrPath = await this._resolveShockQrPath(taskId)
      this._assertPosterTask(taskId)
      console.log('[StrikePoster] 02 QR ready')

      // 计算高度
      const tempCtx = wx.createCanvasContext('strikePosterCanvas', this)
      const height = StrikeRenderer.calcHeight(strike, tempCtx)
      if (!Number.isFinite(height) || height <= 0) {
        throw new Error(`海报高度异常: ${height}`)
      }

      await this._setDataAsync({ _canvasH: height })
      await this._nextTickAsync()
      this._assertPosterTask(taskId)
      console.log('[StrikePoster] 03 canvas ready', 750, height)

      // 绘制
      await this._drawShockPoster({ strike, qrPath, height, taskId })
      console.log('[StrikePoster] 04 draw complete')

      // 导出
      const tempFilePath = await this._exportShockPoster({ height, taskId })
      console.log('[StrikePoster] 05 export success', tempFilePath.substring(0, 40))
      this._assertPosterTask(taskId)

      // 保存相册
      await this._withTimeout(PService.saveToAlbum(tempFilePath, 'cognitiveStrike'), 10000, '保存到相册超时')
      this._assertPosterTask(taskId)

      this.safeSetData({ posterPath: tempFilePath })
      wx.showToast({ title: '海报已保存到手机相册', icon: 'success' })
      console.log('[StrikePoster] 06 album saved')
    } catch (error) {
      if (error && error.code === 'POSTER_TASK_CANCELLED') {
        return
      }
      console.error('[StrikePoster] failed:', error)
      wx.showToast({ title: (error && error.message) || '海报保存失败，请重试', icon: 'none' })
    } finally {
      if (taskId === this._posterTaskId) {
        this.safeSetData({ posterGenerating: false })
      }
      wx.hideLoading()
      console.log('[StrikePoster] 99 finally reset')
    }
  },

  /* ═══ 二维码等待（不允许无二维码生成） ═══ */
  async _resolveShockQrPath(taskId) {
    if (this.data.qrStatus === 'ready' && this.data.qrPath) {
      return this.data.qrPath
    }
    if (this.data.qrStatus === 'loading') {
      return this._waitForShockQr(taskId)
    }
    throw new Error('小程序码未生成，请稍后重试')
  },

  _waitForShockQr(taskId) {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now()
      const check = () => {
        try {
          this._assertPosterTask(taskId)
          if (this.data.qrStatus === 'ready' && this.data.qrPath) {
            resolve(this.data.qrPath)
            return
          }
          if (this.data.qrStatus === 'error') {
            reject(new Error('小程序码加载失败'))
            return
          }
          if (Date.now() - startedAt >= 15000) {
            reject(new Error('小程序码加载超时'))
            return
          }
          const timer = setTimeout(check, 300)
          this._timers = this._timers || []
          this._timers.push(timer)
        } catch (error) {
          reject(error)
        }
      }
      check()
    })
  },

  /* ═══ Canvas绘制Promise ═══ */
  _drawShockPoster({ strike, qrPath, height, taskId }) {
    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (fn, value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        fn(value)
      }
      const timer = setTimeout(() => {
        finish(reject, new Error('Canvas绘制超时'))
      }, 8000)
      this._timers.push(timer)

      try {
        this._assertPosterTask(taskId)
        const ctx = wx.createCanvasContext('strikePosterCanvas', this)
        StrikeRenderer.draw(ctx, strike, qrPath, height)
        ctx.draw(false, () => {
          try {
            this._assertPosterTask(taskId)
            finish(resolve)
          } catch (error) {
            finish(reject, error)
          }
        })
      } catch (error) {
        finish(reject, error)
      }
    })
  },

  /* ═══ Canvas导出Promise ═══ */
  _exportShockPoster({ height, taskId }) {
    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (fn, value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        fn(value)
      }
      const timer = setTimeout(() => {
        finish(reject, new Error('海报导出超时'))
      }, 10000)
      this._timers.push(timer)

      try {
        this._assertPosterTask(taskId)
        wx.canvasToTempFilePath({
          canvasId: 'strikePosterCanvas',
          x: 0, y: 0, width: 750, height,
          destWidth: 1500, destHeight: height * 2,
          success: (res) => {
            if (!res.tempFilePath) {
              finish(reject, new Error('海报导出路径为空'))
              return
            }
            finish(resolve, res.tempFilePath)
          },
          fail: (error) => {
            finish(reject, new Error((error && error.errMsg) || '海报导出失败'))
          },
        }, this)
      } catch (error) {
        finish(reject, error)
      }
    })
  },

  /* ═══ 通用辅助 ═══ */
  _setDataAsync(data) {
    return new Promise((resolve, reject) => {
      if (this._destroyed) {
        reject(new Error('页面已销毁'))
        return
      }
      this.setData(data, resolve)
    })
  },

  _nextTickAsync() {
    return new Promise((resolve) => { wx.nextTick(resolve) })
  },

  _withTimeout(promise, timeoutMs, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        const timer = setTimeout(() => { reject(new Error(message)) }, timeoutMs)
        this._timers = this._timers || []
        this._timers.push(timer)
      }),
    ])
  },

  _assertPosterTask(taskId) {
    if (this._destroyed || taskId !== this._posterTaskId) {
      const error = new Error('海报任务已取消')
      error.code = 'POSTER_TASK_CANCELLED'
      throw error
    }
  },
})
