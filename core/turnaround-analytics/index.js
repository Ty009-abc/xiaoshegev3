/**
 * core/turnaround-analytics/index.js
 *
 * V6.5 Turnaround Analytics — 主入口
 *
 * @version 6.5.0
 */

// Gate A
const eventSchema = require('./events/schema')
const eventCatalog = require('./events/catalog')
const reportAnalytics = require('./dashboards/reportAnalytics')
const qualityDashboard = require('./dashboards/qualityDashboard')
const experimentEngine = require('./experiments/experimentEngine')

// Gate B
const rcChecklist = require('./gates/rcChecklist')

// Gate C
const betaMetrics = require('./gates/betaMetrics')

// Gate D
const stableRelease = require('./gates/stableRelease')

module.exports = {
  version: '6.5.0',

  // Gate A: Analytics
  events: {
    schema: eventSchema,
    catalog: eventCatalog.EVENT_CATALOG,
    eventCount: eventCatalog.EVENT_COUNT,
    categories: eventCatalog.EVENT_BY_CATEGORY,
    EVENT_CATALOG: eventCatalog.EVENT_CATALOG,
    EVENT_CATEGORIES: eventSchema.EVENT_CATEGORIES,
    EVENT_META_KEYS: eventSchema.EVENT_META_KEYS,
    createEvent: eventSchema.createEvent,
  },
  dashboards: {
    reportAnalytics: reportAnalytics.createReportAnalytics,
    qualityDashboard: qualityDashboard.createQualityDashboard,
  },
  experiments: {
    EXPERIMENT_VARIANTS: experimentEngine.EXPERIMENT_VARIANTS,
    createExperiment: experimentEngine.createExperiment,
    createExperimentResult: experimentEngine.createExperimentResult,
  },

  // Gate B: Release Candidate
  rc: {
    RC_GATES: rcChecklist.RC_GATES,
    createRCChecklist: rcChecklist.createRCChecklist,
    validateGateStatus: rcChecklist.validateGateStatus,
  },

  // Gate C: Beta
  beta: {
    BETA_ROLLOUT: betaMetrics.BETA_ROLLOUT,
    BETA_KPI: betaMetrics.BETA_KPI,
    FEEDBACK_SYSTEM: betaMetrics.FEEDBACK_SYSTEM,
    createBetaMetrics: betaMetrics.createBetaMetrics,
  },

  // Gate D: Stable
  stable: {
    STABLE_CHECKLIST: stableRelease.STABLE_CHECKLIST,
    RELEASE_DASHBOARD: stableRelease.RELEASE_DASHBOARD,
    createReleaseDashboard: stableRelease.createReleaseDashboard,
    createStableChecklist: stableRelease.createStableChecklist,
  },
}
