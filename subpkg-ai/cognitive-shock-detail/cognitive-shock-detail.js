/**
 * cognitive-shock-detail v1.0 — 独立详情页
 * 数据源: utils/cognitionStrike.js getTodayStrike()
 * 海报引擎: share/posters/index.js _neonShockPoster (Canvas+权限+预览)
 * 二维码: 懒加载 wx.cloud.callFunction getUnlimitedQR
 */

const { getTodayStrike } = require('../../utils/cognitionStrike.js')
const { installPoster } = require('../../share/posters/index.js')

const pageConfig = {
  data: {
    // 暴击数据
    strike: null,
    dateId: '',
    displayDate: '',

    // 页面
    loading: true,
    totalNavHeight: 0,
    statusBarHeight: 0,

    // 海报
    showPoster: false,
    posterGenerating: false,
    posterPath: '',
    posterHeight: 0,
    qrPath: '',

    // 收藏
    isCollected: false,
  },

  onLoad(opt) {
    this._initNavBar()
    const id = opt.id || opt.date || opt.scene || ''
    const strike = getTodayStrike() // 日期锚定，当天同一条
    if (!strike || !strike.core_strike) {
      this.setData({ loading: false })
      return
    }
    const dateStr = String(strike.id || '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1/$2/$3')
    this.setData({
      strike,
      dateId: strike.id || '',
      displayDate: dateStr,
      loading: false,
      isCollected: this._checkCollected(strike.id),
    })
    // 延迟懒加载小程序码
    this._ensureQrCode()
  },

  _initNavBar() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const sbh = info.statusBarHeight || 0
    const nbh = menu ? (menu.bottom - sbh) + (menu.top - sbh) : 44
    this.setData({ statusBarHeight: sbh, totalNavHeight: sbh + nbh })
  },

  _checkCollected(id) {
    try {
      const saved = wx.getStorageSync('strike_collection') || []
      return !!saved.find(item => item.id === id)
    } catch (_) { return false }
  },

  /* ═══════════ 小程序码懒加载 ═══════════ */
  _ensureQrCode() {
    if (this._qrFetching || this.data.qrPath) return
    this._qrFetching = true
    console.log('[ShockDetail] QR fetch start')
    try {
      wx.cloud.callFunction({
        name: 'getUnlimitedQR',
        data: {
          scene: this.data.dateId || 'shock',
          page: 'subpkg-ai/cognitive-shock-detail/cognitive-shock-detail',
        },
        success: (res) => {
          console.log('[ShockDetail] QR cloud response:', JSON.stringify(res.result))
          const fileID = (res.result && res.result.fileID) || res.result?.data?.fileID || ''
          if (fileID) {
            wx.cloud.downloadFile({
              fileID,
              success: (dfRes) => {
                console.log('[ShockDetail] QR local path:', dfRes.tempFilePath)
                this.setData({ qrPath: dfRes.tempFilePath })
              },
              fail: (err) => {
                console.error('[ShockDetail] QR downloadFile fail:', err)
                this._qrFetching = false
              }
            })
          } else {
            console.log('[ShockDetail] QR: no fileID, using fallback')
            this.setData({ qrPath: '/images/miniprogram-code.jpg' })
          }
        },
        fail: (err) => {
          console.error('[ShockDetail] QR cloudFunc fail:', err)
          this.setData({ qrPath: '/images/miniprogram-code.jpg' })
          this._qrFetching = false
        }
      })
    } catch (e) {
      console.error('[ShockDetail] QR exception:', e)
      this.setData({ qrPath: '/images/miniprogram-code.jpg' })
      this._qrFetching = false
    }
  },

  /* ═══════════ 导航 ═══════ */
  onBack() { wx.navigateBack({ delta: 1 }) },

  /* ═══════════ 收藏 ═══════ */
  onCollect() {
    const s = this.data.strike
    if (!s) return
    wx.showActionSheet({
      itemList: ['收藏到本地', '分享给朋友'],
      success: (res) => {
        if (res.tapIndex === 0) {
          try {
            const saved = wx.getStorageSync('strike_collection') || []
            if (!saved.find(item => item.id === s.id)) {
              saved.unshift({ id: s.id, title: s.core_strike, time: new Date().toISOString() })
              wx.setStorageSync('strike_collection', saved.slice(0, 50))
            }
            this.setData({ isCollected: true })
            wx.showToast({ title: '已收藏 ⭐', icon: 'success' })
          } catch (e) { wx.showToast({ title: '收藏失败', icon: 'none' }) }
        } else {
          wx.showToast({ title: '请点击右上角分享', icon: 'none', duration: 2000 })
        }
      }
    })
  },

  /* ═══════════ 破局推演 ═══════ */
  onGo() {
    const app = getApp()
    const strike = this.data.strike
    const personalityModes = require('../../utils/personalityModes.js')
    const personality = personalityModes.getRandomPersonality()
    app.globalData._quickAskTopic = strike.core_strike
    app.globalData._quickAskPersonality = personality
    wx.switchTab({ url: '/pages/ai-chat/ai-chat' })
  },

  /* ═══════════ 海报 ═══════ */
  onSaveShockPoster() {
    if (this.data.posterGenerating) return
    // 传递当前 strike 数据给海报引擎
    this.setData({ strikeData: this.data.strike, qrPath: this.data.qrPath || '' })
    this._neonShockPoster.call(this)
  },

  onClosePoster() {
    this.setData({ showPoster: false })
  },

  onSaveToAlbum() {
    if (!this.data.posterPath) return
    const path = this.data.posterPath
    const doSave = () => {
      wx.saveImageToPhotosAlbum({
        filePath: path,
        success() { wx.showToast({ title: '海报已保存到相册', icon: 'success' }) },
        fail(err) {
          if (err.errMsg && err.errMsg.indexOf('auth deny') !== -1) {
            wx.showModal({
              title: '需要相册权限',
              content: '保存海报需要相册权限，请在设置中允许',
              confirmText: '去设置',
              success(r) { if (r.confirm) { wx.openSetting({ success(s) { if (s.authSetting['scope.writePhotosAlbum']) doSave() } }) } }
            })
          } else {
            wx.showToast({ title: '海报生成失败，请重试', icon: 'none' })
          }
        }
      })
    }
    doSave()
  },

  preventMove() {},

  /* ═══════════ 分享 ═══════ */
  onShareAppMessage() {
    const s = this.data.strike || {}
    return {
      title: s.core_strike ? `💥 ${s.core_strike.substring(0, 30)}...` : '今日认知暴击',
      path: `/subpkg-ai/cognitive-shock-detail/cognitive-shock-detail`,
      imageUrl: this.data.posterPath || undefined,
    }
  },
}

installPoster(pageConfig)
Page(pageConfig)
