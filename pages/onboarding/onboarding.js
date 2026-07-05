/**
 * pages/onboarding - 首次引导（4页滑屏）
 */
Page({
  data: {
    current: 0,
    pages: [
      {
        emoji: '🤔',
        title: '你为什么翻不了身？',
        body: '不是因为你不够努力。\n\n真正的原因，藏在你理解世界的方式里。',
        color: '#0a84ff',
      },
      {
        emoji: '🌍',
        title: '你用什么方式理解世界？',
        body: '你的每个决定，都来自你的「世界模型」。\n\n错误模型 → 错误决策 → 错误人生。',
        color: '#f0ad4e',
      },
      {
        emoji: '🔍',
        title: '你的世界模型可能是错的',
        body: '大多数人带着出厂设置活了30年。\n\n是时候升级了。',
        color: '#ff6b6b',
      },
      {
        emoji: '🚀',
        title: '准备好了吗？',
        body: '30天，重新安装你的操作系统。\n\n不是鸡汤，是认知诊断。',
        color: '#2ecc71',
        isLast: true,
      },
    ],
  },

  onSwiperChange(e) {
    this.setData({ current: e.detail.current })
  },

  onStart() {
    console.log('[onboarding] onStart 触发')
    try {
      wx.setStorageSync('onboarded', true)
      console.log('[onboarding] onboarded=true 写入成功')
    } catch (e) {
      console.error('[onboarding] setStorageSync 失败:', e)
    }
    console.log('[onboarding] 开始跳转 /pages/home/home')
    wx.switchTab({
      url: '/pages/home/home',
      success() {
        console.log('[onboarding] ✅ switchTab 成功')
      },
      fail(err) {
        console.error('[onboarding] ❌ switchTab 失败:', JSON.stringify(err))
        // fallback: reLaunch 也能到达 home（tabBar 页兼容）
        wx.reLaunch({
          url: '/pages/home/home',
          success() {
            console.log('[onboarding] ✅ fallback reLaunch 成功')
          },
          fail(err2) {
            console.error('[onboarding] ❌ reLaunch 也失败:', JSON.stringify(err2))
          }
        })
      },
      complete() {
        console.log('[onboarding] switchTab complete 已触发')
      }
    })
  },
})
