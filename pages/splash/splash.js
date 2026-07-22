/**
 * pages/splash - 启动页
 * 黑底 + Logo 淡入 → 1.8s → 判断首次用户 → onboarding 或 home
 */
const app = getApp()
Page({
  onLoad() {
    // 设置状态栏为白色（暗底页面）
    wx.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: '#0d0b1d'
    })
    // 2.5s 后判断跳转（延长等待确保 App 完全初始化）
    this._splashTimer = setTimeout(() => {
      const hasOnboarded = wx.getStorageSync('onboarded')
      if (hasOnboarded) {
        // home 是 tabBar 页，必须用 switchTab
        wx.switchTab({
          url: '/pages/home/home',
          fail() { wx.reLaunch({ url: '/pages/home/home' }) }
        })
      } else {
        // onboarding 不是 tabBar 页，用 reLaunch
        wx.reLaunch({ url: '/pages/onboarding/onboarding' })
      }
    }, 2500)
  },
  onUnload() {
    if (this._splashTimer) { clearTimeout(this._splashTimer); this._splashTimer = null }
  },
})
