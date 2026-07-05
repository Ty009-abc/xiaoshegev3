// pages/challenge-start/challenge-start.js
// v3.7.1 — 合龙 30 天认知大挑战入口，直通九维博弈引擎
Page({
  data: { loading: false },

  async startChallenge() {
    this.setData({ loading: true })
    wx.navigateTo({
      url: '/pages/challenge/challenge',
      fail: (err) => {
        wx.showToast({
          title: '九维引擎加载失败，请重启小程序重试',
          icon: 'none',
          duration: 2500
        })
        console.error('[challenge-start] navigateTo fail:', err)
      },
      complete: () => {
        this.setData({ loading: false })
      }
    })
  },
})
