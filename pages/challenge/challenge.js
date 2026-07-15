// pages/challenge/challenge.js
// LEGACY_RETIRED — v3.8.0 停用旧本地计分链，统一 redirect 到新云端链路
Page({
  onLoad() {
    wx.redirectTo({ url: '/pages/challenge-start/challenge-start' })
  },
})
