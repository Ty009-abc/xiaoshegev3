/**
 * pages/legacy6q-thinking/legacy6q-thinking.js
 *
 * RC8.8_STAGE2_R5_LEGACY_THINKING_PAGE_REVIVAL — dedicated full-screen LIGHT
 * "推演等待页" restored from the proven 2026-08-30 15:39 experience
 * (canonical 55453bb → pages/report-detail/report-detail.* `v5-loading-screen`).
 *
 * PRESENTATION LAYER ONLY. It carries the completed five-field report from the
 * ONE Stage2 model call to the result page. It restores nothing from the
 * abandoned 10Q / world-model architecture — no cashflow, safety-boundary,
 * ability-score or risk-tolerance copy.
 *
 * Flow (§3):
 *   Q6 submit → (questionnaire) → legacy6q-thinking → ONE AI request
 *   → store result → legacy6q-report (07/11 five-card result, READY content).
 *
 * §11 DOUBLE-CALL PROTECTION: one submission → one requestId → one model call.
 * The in-flight guard is module-scoped so it survives page re-entry.
 *
 * @version legacy_thinking_0830
 */

'use strict'

const legacy6q = require('../../services/legacy6qReportService.js')
const reportHistory = require('../../utils/reportHistory.js')

const app = getApp()
const QUESTIONNAIRE_ROUTE = '/pages/turnaround-6q-questionnaire/turnaround-6q-questionnaire'
const REPORT_ROUTE = '/pages/legacy6q-report/legacy6q-report'
const DIAGNOSTIC_VERSION = 'turnaround_strategy_6q_v1'

/* §6 — main title (unchanged). §16 — no abandoned-architecture terms. */
const MAIN_TITLE = '小事哥正在推演你的翻身路径'
const BRAND = '珠澳小事哥 · 认知翻身策略'
const SLOGAN = '翻身从来不是拼命，而是看懂规则。'

/* §5 — five thinking stages. Exact required copy (no 10Q-specific text). */
const THINKING_STEPS = [
  {
    title: '正在读取你的现实底牌',
    body: '从年龄、职业、收入和学历里，\n看清你现在站在哪里。',
  },
  {
    title: '正在拆解你真正卡住的地方',
    body: '对照你的焦虑与自我判断，\n寻找表象下面的问题。',
  },
  {
    title: '正在推演困住你的系统',
    body: '看清你为什么努力了，\n却仍然停在原来的位置。',
  },
  {
    title: '正在生成你的翻身路径',
    body: '从现有条件出发，\n寻找最值得验证的突破口。',
  },
  {
    title: '正在收敛你的行动建议',
    body: '把判断压缩成下一步\n真正能执行的动作。',
  },
]

/* §7 — visual schedule (cumulative). These are UX progress, NOT backend milestones. */
const STEP_TIMES = [0, 1400, 2800, 4200, 5600]
/* §8 — minimum presentation time (5500–6000 band). */
const MIN_DISPLAY_MS = 5800
/* §7 — after STEP5, subtle animation until the AI returns. */
const FINALIZING_TEXT = '正在完成最后推演...'

/* §11 — module-scoped in-flight registry: one requestId → one model call. */
const _ACTIVE_THINKING = {}

function markInFlight (requestId) { if (requestId) _ACTIVE_THINKING[requestId] = true }
function isInFlight (requestId) { return !!_ACTIVE_THINKING[requestId] }
function releaseInFlight (requestId) { if (requestId) delete _ACTIVE_THINKING[requestId] }

function buildSteps (current) {
  return THINKING_STEPS.map(function (s, i) {
    return { id: i, title: s.title, body: s.body, active: i <= current }
  })
}

Page({
  data: {
    title: MAIN_TITLE,
    brand: BRAND,
    slogan: SLOGAN,
    steps: buildSteps(0),
    stepIndex: 1,
    subtitle: THINKING_STEPS[0].title,
    stageBody: THINKING_STEPS[0].body,
    finalizing: false,
    failed: false,
  },

  onLoad (opt) {
    this._timers = []
    this._finishTimer = null
    this._done = false
    this._unloaded = false
    this._startedAt = 0
    this._aiState = 'pending'
    this._report = null

    const handoff = app.globalData._legacy6qThinkingRequest
    if (handoff) app.globalData._legacy6qThinkingRequest = null // consume (§12 temp handoff)
    this._handoff = handoff
    this._requestId = (opt && opt.requestId) || (handoff && handoff.requestId) || ''

    // No validated answers → nothing to reason about. No second call.
    if (!handoff) {
      wx.redirectTo({ url: QUESTIONNAIRE_ROUTE })
      return
    }

    // §11 — re-entry / back-forward / double open must NOT start a second call.
    if (isInFlight(handoff.requestId)) return

    this._requestId = handoff.requestId
    markInFlight(this._requestId)
    this._run()
  },

  /* §11 — page re-show (back/forward) is a no-op: the call only ever starts in onLoad. */
  onShow () {
    if (this._done || this._startedAt) return
    // If the handoff was already consumed but no call is in flight, do nothing —
    // never issue a model call from onShow.
  },

  _run () {
    this._startedAt = Date.now()
    this._startStageSchedule()
    this._callModelOnce()
  },

  /* §7 — advance the UX stages on the visual schedule. */
  _startStageSchedule () {
    const self = this
    STEP_TIMES.forEach(function (t, i) {
      self._timers.push(setTimeout(function () {
        if (self._unloaded || self._done) return
        const isLast = i === THINKING_STEPS.length - 1
        self.setData({
          steps: buildSteps(i),
          stepIndex: i + 1,
          subtitle: THINKING_STEPS[i].title,
          stageBody: isLast ? FINALIZING_TEXT : THINKING_STEPS[i].body,
          finalizing: isLast,
        })
        if (isLast) self._maybeFinish()
      }, t))
    })
  },

  /* §3 — exactly ONE model call per submission. */
  _callModelOnce () {
    const self = this
    const h = this._handoff || {}
    const p = h.personality || {}
    legacy6q.generateLegacy6QReport({
      answers: h.answers,
      personality: (p && p.name) || '',
      personalityEmoji: (p && p.emoji) || '',
      personalityStyle: (p && p.style) || '',
    }).then(function (r) {
      if (self._unloaded || self._done) return
      if (r && r.code === 0 && r.data) {
        self._aiState = 'ok'
        self._report = r.data
      } else {
        self._aiState = 'fail'
      }
      self._maybeFinish()
    }).catch(function (e) {
      console.error('[6q-thinking] AI 生成失败:', e)
      if (self._unloaded || self._done) return
      self._aiState = 'fail'
      self._maybeFinish()
    })
  },

  /* §8 — transition only when BOTH the AI result is ready AND the minimum
     presentation window has elapsed. If the AI is still running, stay on STEP5. */
  _maybeFinish () {
    if (this._unloaded || this._done) return
    const wait = Math.max(0, MIN_DISPLAY_MS - (Date.now() - this._startedAt))
    if (wait > 0) {
      const self = this
      if (!this._finishTimer) {
        this._finishTimer = setTimeout(function () {
          self._finishTimer = null
          self._maybeFinish()
        }, wait)
      }
      return
    }
    if (this._aiState === 'pending') {
      // AI still running → stay on STEP5 with the finalizing animation.
      if (!this.data.finalizing) this.setData({ finalizing: true, stageBody: FINALIZING_TEXT })
      return
    }
    if (this._aiState === 'ok') this._transition()
    else this._showFailure()
  },

  /* §9 — hand the READY report to the result page. */
  _transition () {
    if (this._done) return
    this._done = true
    this._clearTimers()
    releaseInFlight(this._requestId)
    // P0 D2 — persist ONE report-history item for ONE successful submission.
    // Never stores fallback/error results (reportHistory.record ignores empties).
    try { reportHistory.record(this._report, this._handoff) } catch (_) {}
    app.globalData._legacy6qReport = this._report
    app.globalData._legacy6qReportRequestId = this._requestId
    app.globalData._legacy6qReportAt = Date.now()
    wx.redirectTo({ url: REPORT_ROUTE + '?mode=diagnostic&requestId=' + encodeURIComponent(this._requestId || '') })
  },

  /* §10 — failure stays on the thinking page. Never navigate to five empty cards. */
  _showFailure () {
    if (this._done) return
    this._done = true
    this._clearTimers()
    releaseInFlight(this._requestId)
    this.setData({ failed: true, finalizing: false })
  },

  /* §10 — retry creates exactly ONE new request. */
  onRetryThinking () {
    if (!this._handoff) { wx.redirectTo({ url: QUESTIONNAIRE_ROUTE }); return }
    const newId = String(this._handoff.requestId || 'r6q') + '_r' + Date.now()
    this._handoff.requestId = newId
    this._requestId = newId
    markInFlight(newId)

    this._timers = []
    if (this._finishTimer) { clearTimeout(this._finishTimer); this._finishTimer = null }
    this._done = false
    this._aiState = 'pending'
    this._report = null

    this.setData({
      failed: false,
      finalizing: false,
      steps: buildSteps(0),
      stepIndex: 1,
      subtitle: THINKING_STEPS[0].title,
      stageBody: THINKING_STEPS[0].body,
    })
    this._run()
  },

  /* §10 — return to the questionnaire to edit answers. */
  onBackEdit () {
    wx.redirectTo({ url: QUESTIONNAIRE_ROUTE })
  },

  _clearTimers () {
    (this._timers || []).forEach(function (t) { clearTimeout(t) })
    this._timers = []
  },

  onUnload () {
    this._unloaded = true
    this._clearTimers()
    if (this._finishTimer) { clearTimeout(this._finishTimer); this._finishTimer = null }
    if (this._done) releaseInFlight(this._requestId)
  },
})
