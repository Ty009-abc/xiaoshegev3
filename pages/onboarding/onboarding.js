/**
 * pages/onboarding - 首次引导（4页滑屏）
 * UI 规格对齐：仅视觉与交互。文案/页数/跳转目标/存储逻辑保持不变。
 */
Page({
  data: {
    current: 0,
    pages: [
      {
        emoji: '🤔',
        title: '你为什么翻不了身？',
        body: '不是因为你不够努力。\n\n真正的原因，藏在你理解世界的方式里。',
        paras: ['不是因为你不够努力。', '真正的原因，藏在你理解世界的方式里。'],
        color: '#2583FF',
      },
      {
        emoji: '🌍',
        title: '你用什么方式理解世界？',
        body: '你的每个决定，都来自你的「世界模型」。\n\n错误模型 → 错误决策 → 错误人生。',
        paras: ['你的每个决定，都来自你的「世界模型」。', '错误模型 → 错误决策 → 错误人生。'],
        color: '#F2A93B',
      },
      {
        emoji: '🔍',
        title: '你的世界模型可能是错的',
        body: '大多数人带着出厂设置活了30年。\n\n是时候升级了。',
        paras: ['大多数人带着出厂设置活了30年。', '是时候升级了。'],
        color: '#FF5B68',
      },
      {
        emoji: '🚀',
        title: '准备好了吗？',
        body: '30天，重新安装你的操作系统。\n\n不是鸡汤，是认知诊断。',
        paras: ['30天，重新安装你的操作系统。', '不是鸡汤，是认知诊断。'],
        color: '#31C978',
        isLast: true,
      },
    ],
  },

  // 极轻触觉反馈：仅手动完成页面切换时触发（兼容性不稳则静默跳过）
  _vibrateLight() {
    try {
      if (typeof wx !== 'undefined' && typeof wx.vibrateShort === 'function') {
        wx.vibrateShort({ type: 'light' })
      }
    } catch (e) {
      // 忽略：部分机型/版本不支持
    }
  },

  onSwiperChange(e) {
    this.setData({ current: e.detail.current })
    // source === 'touch' 表示用户手动滑动；自动 setData 不震动
    if (e.detail && e.detail.source === 'touch') {
      this._vibrateLight()
    }
  },

  // 跳过：仅跳到第 4 页（不进入问卷）
  onSkip() {
    this.setData({ current: 3 })
  },

  onStart() {
    this._vibrateLight()
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
