/**
 * tools/rc83-stage21-batch4/index.js
 *
 * Stage21 Batch4 — W11 Real-Device Minimum Smoke Protocol + W12 Payment
 * Integration Verification Discovery.
 *
 * Read-only discovery + local/direct qualification. NO real device smoke
 * execution, NO real payment request, NO production DB write.
 */

'use strict'

var smoke = require('./lib/smokeProtocol.js')
var payment = require('./lib/paymentDiscovery.js')

function run() {
  var smokeProtocol = smoke.buildRealDeviceSmokeProtocol({ candidateSha: process.env.RC83_CANDIDATE_SHA || '' })
  var paymentDiscovery = payment.buildPaymentDiscovery()
  var readinessGate = payment.evaluatePaymentReleaseReadinessGate({
    credentialStateKnown: false, // not verifiable read-only (needs live env)
    realVsMockSemanticsKnown: true,
    amountAuthorityKnown: true,
    callbackVerificationKnown: true,
    orderLifecycleKnown: true,
    entitlementUpdateKnown: true,
    idempotencyKnown: true,
    failureBehaviorKnown: true,
  })

  return {
    smokeProtocol: smokeProtocol,
    paymentDiscovery: paymentDiscovery,
    paymentReleaseReadinessGate: readinessGate,
    realDeviceSmokeExecuted: false,
  }
}

if (require.main === module) {
  var out = run()
  console.log(JSON.stringify(out, null, 2))
}

module.exports = { run, smoke, payment }
