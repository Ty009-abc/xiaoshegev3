/**
 * core/turnaround-analytics/gates/betaMetrics.js
 *
 * V6.5 Gate C — Beta 指标 + 灰度分流 + 反馈系统
 *
 * @version 6.5.0
 */

const BETA_ROLLOUT = Object.freeze({
  phases: [
    { phase: 'alpha', users: 100, durationDays: 7,  target: '功能正确性' },
    { phase: 'beta1', users: 300, durationDays: 7,  target: '性能 + 留存' },
    { phase: 'beta2', users: 1000,durationDays: 14, target: '支付 + 分享' },
  ],
})

const BETA_KPI = Object.freeze({
  questionnaireCompletion: { target: '>85%',   threshold: 0.85, weight: 'HIGH' },
  reportCompletion:      { target: '>80%',    threshold: 0.80, weight: 'HIGH' },
  shareRate:             { target: '>20%',    threshold: 0.20, weight: 'MEDIUM' },
  evidenceExpandRate:    { target: '>30%',    threshold: 0.30, weight: 'MEDIUM' },
  paymentRate:           { target: '5%~10%',  threshold: 0.05, weight: 'HIGH' },
  day1Retention:         { target: '>30%',    threshold: 0.30, weight: 'HIGH' },
  day7Retention:         { target: '>15%',    threshold: 0.15, weight: 'MEDIUM' },
})

const FEEDBACK_SYSTEM = Object.freeze({
  enabled: true,
  position: 'END_OF_REPORT',
  prompt: '这份报告帮助到你了吗？',
  options: [
    { type: 'THUMBS_UP',   label: '👍' },
    { type: 'THUMBS_DOWN', label: '👎' },
  ],
  freeText: {
    enabled: true,
    prompt: '有什么想告诉我们的吗？（选填）',
    maxLength: 500,
  },
  thankYouMessage: '感谢你的反馈，我们会持续改进！',
})

function createBetaMetrics({ phase, date, metrics, feedback }) {
  if (!phase) throw new Error('BetaMetrics: phase required')

  const kpiStatus = {}
  for (const [key, spec] of Object.entries(BETA_KPI)) {
    const actual = metrics ? metrics[key] : 0
    kpiStatus[key] = {
      target: spec.target,
      actual: typeof actual === 'number' ? (actual * 100).toFixed(1) + '%' : 'N/A',
      pass: actual >= spec.threshold,
      weight: spec.weight,
    }
  }

  const allHighPass = Object.entries(BETA_KPI)
    .filter(([_, s]) => s.weight === 'HIGH')
    .every(([k]) => kpiStatus[k].pass)

  return Object.freeze({
    version: '6.5.0',
    phase,
    rollout: BETA_ROLLOUT.phases,
    date: date || new Date().toISOString(),
    kpiStatus: Object.freeze(kpiStatus),
    gateDecision: allHighPass ? 'PROMOTE' : 'HOLD',
    feedback: Object.freeze({
      config: FEEDBACK_SYSTEM,
      summary: feedback ? Object.freeze({ ...feedback }) : null,
    }),
  })
}

module.exports = { BETA_ROLLOUT, BETA_KPI, FEEDBACK_SYSTEM, createBetaMetrics }
