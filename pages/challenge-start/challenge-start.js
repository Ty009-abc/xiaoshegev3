// pages/challenge-start/challenge-start.js
// v3.8.0 — 统一 30 天认知大挑战云端链路
const challengeService = require('../../services/challengeService')

Page({
  data: { loading: false, _starting: false },

  async onStartChallenge() {
    if (this.data._starting) return
    this.setData({ _starting: true, loading: true })
    wx.showLoading({ title: '正在建立挑战档案', mask: true })

    try {
      const res = await challengeService.startChallenge()
      if (!res || res.code !== 0 || !res.data || !res.data.recordId) {
        throw new Error(res?.message || '挑战创建失败：未返回有效 recordId')
      }

      const { recordId, scoringVersion, rawScores, completed, destination } = res.data
      console.log('[ChallengeV2Start]', { recordId, scoringVersion, hasRawScores: Boolean(rawScores), choicesLength: 0, completed, destination })

      // R6: titled owner with a FINISHED record → route straight to the result page
      // with the SAME recordId. Never re-enter the 3-question trial gate or paywall.
      if (completed === true || destination === 'challenge_result') {
        wx.navigateTo({
          url: '/pages/challenge-result/challenge-result?recordId=' + encodeURIComponent(recordId),
          fail: (err) => {
            console.error('[ChallengeV2Start] navigateTo result fail:', err)
            wx.showToast({ title: '页面跳转失败，请重试', icon: 'none', duration: 2500 })
          },
        })
        return
      }

      wx.navigateTo({
        url: '/pages/challenge-play/challenge-play?mode=challenge&recordId=' + encodeURIComponent(recordId),
        fail: (err) => {
          console.error('[ChallengeV2Start] navigateTo fail:', err)
          wx.showToast({ title: '页面跳转失败，请重试', icon: 'none', duration: 2500 })
        }
      })
    } catch (err) {
      console.error('[ChallengeV2Start] startChallenge fail:', err)
      wx.showToast({ title: err.message || '挑战启动失败，请重试', icon: 'none', duration: 2500 })
    } finally {
      this.setData({ _starting: false, loading: false })
      wx.hideLoading()
    }
  },
})
