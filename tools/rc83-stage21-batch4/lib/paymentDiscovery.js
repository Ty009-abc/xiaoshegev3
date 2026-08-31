/**
 * tools/rc83-stage21-batch4/lib/paymentDiscovery.js
 *
 * W12 — Payment Integration Verification Discovery (READ-ONLY).
 *
 * Encapsulates the architecture-discovery findings from the canonical source at
 * 0874254ede490d7fef6c20942ff663c0970a445c. This module performs NO payment
 * request, NO charge, NO refund, NO credential export. It classifies capability
 * strictly from code evidence and, where a live DB/network is required, reports
 * NOT_EXECUTABLE_FROM_CURRENT_ARCHITECTURE rather than fabricating a PASS.
 *
 * Secret/identity policy: getConfig() in common/payment.js returns raw mchid and
 * privateKey, so this discovery layer NEVER surfaces those raw values. It only
 * emits PRESENT / ABSENT / UNKNOWN + source class (ENV|CONFIG|CODE|SECRET_STORE).
 */

'use strict'

var path = require('path')

// ── Fixed findings (from canonical source inspection) ──
var CREDENTIAL_SOURCES = {
  WXPAY_MCHID: { state: 'ENV', sourceClass: 'ENV' },
  WXPAY_APPID: { state: 'ENV', sourceClass: 'ENV' },
  WXPAY_SERIAL_NO: { state: 'ENV', sourceClass: 'ENV' },
  WXPAY_PRIVATE_KEY: { state: 'ENV_OR_FILE', sourceClass: 'ENV' },
  WXPAY_PRIVATE_KEY_PATH: { state: 'ENV_OR_FILE', sourceClass: 'ENV' },
  WXPAY_API_V3_KEY: { state: 'ENV', sourceClass: 'ENV' },
  WXPAY_NOTIFY_URL: { state: 'ENV', sourceClass: 'ENV' },
  WXPAY_PLATFORM_CERT: { state: 'ENV', sourceClass: 'ENV' },
}

// Amount authority (from createOrder/index.js + antiFraud.js):
//   totalAmount = product.price (DB); clientPrice is VALIDATED, never authoritative.
var AMOUNT_AUTHORITY = 'SERVER_AUTHORITATIVE_AMOUNT' // DB product.price is authoritative
var CLIENT_CONTROLLED_AMOUNT = false // clientPrice only validated; final amount = DB price

// Payment mode classification (from common/payment.js getConfig):
//   isMock = !mchid → mock fallback returns success:true with _mock:true.
//   With mchid set but missing private key/appid → fail-closed error.
var PAYMENT_INTEGRATION_MODE = 'MOCK_FALLBACK' // mock when mchid absent; real-capable code path exists but untested live

var MOCK_SUCCESS_IS_NOT_PAYMENT_SUCCESS = true
var MOCK_MARKERS = ['_mock', 'MOCK_PREPAY_', 'MOCK_SIGN', 'MOCK_TXN_']

// Order lifecycle (code evidence)
var ORDER_LIFECYCLE = {
  orderIdGeneration: 'PRESENT', // generateOrderId (ts + random)
  idempotencyCreate: 'PRESENT', // checkDuplicateOrder (antiFraud)
  orderStates: 'PRESENT', // created/pending_payment/paid/failed/refunded/closed
  expirePending: 'PRESENT', // 30min auto-close
  amountValidation: 'PRESENT', // checkPrice (DB vs client)
  transactionIdIdempotency: 'PRESENT', // payments table dedup (payCallback + verifyPayment)
}

var CALLBACK_HANDLER = {
  present: 'PRESENT', // payCallback/index.js
  signatureVerification: 'PRESENT', // RSA-SHA256 + Wechatpay-Serial + timestamp window
  orderLookup: 'PRESENT',
  amountVerification: 'PRESENT', // amount.total !== order.totalAmount -> log + _ok (no entitlement)
  statusTransition: 'PRESENT', // -> paid only on trade_state=SUCCESS
  idempotency: 'PRESENT', // transactionId dedup in payments table
}

var ENTITLEMENT = {
  update: 'PRESENT', // grantEntitlements / entitlementService
  duplicateProtection: 'PARTIAL', // transactionId dedup prevents double-grant on callback/verify; membership renewal extends instead of duplicates
  revokeOnRefund: 'PRESENT', // revokeEntitlements (refundOrder + entitlementService)
}

var PAYMENT_ENTRYPOINTS = [
  { name: 'createOrder', path: 'cloudfunctions/createOrder/index.js', role: 'order creation + JSAPI prepay' },
  { name: 'payCallback', path: 'cloudfunctions/payCallback/index.js', role: 'wechatpay notify + signature verify + grant' },
  { name: 'verifyPayment', path: 'cloudfunctions/verifyPayment/index.js', role: 'client-side poll verify + grant' },
  { name: 'getPaymentResult', path: 'cloudfunctions/getPaymentResult/index.js', role: 'order status poll' },
  { name: 'refundOrder', path: 'cloudfunctions/refundOrder/index.js', role: 'refund (mock/TODO real API)' },
  { name: 'getProductList', path: 'cloudfunctions/getProductList/index.js', role: 'product catalog + tier' },
  { name: 'getMembership', path: 'cloudfunctions/getMembership/index.js', role: 'membership state read' },
  { name: 'paymentService', path: 'services/paymentService.js', role: 'frontend payment facade (wx.requestPayment)' },
]

// Refund: _processRefund has a TODO — no real refund API call, returns success in
// both mock and "real" branches. This is a discovery finding (not fixed here).
var REFUND_REAL_API = 'NOT_PRESENT' // _processRefund: TODO 接入微信退款 API; returns success without real API

// Adversarial cases that CANNOT be executed locally (require DB/network/WeChat).
var NOT_EXECUTABLE_ADVERSARIAL = [
  'P2_MALFORMED_AMOUNT',
  'P3_CLIENT_AMOUNT_TAMPERING',
  'P4_DUPLICATE_ORDER_CALLBACK',
  'P6_INVALID_SIGNATURE',
  'P7_CALLBACK_AMOUNT_MISMATCH',
  'P8_PAYMENT_API_EXCEPTION',
  'P9_TIMEOUT',
  'P10_DUPLICATE_ENTITLEMENT',
]

// Payment release readiness gate — fail-closed on any UNKNOWN.
function evaluatePaymentReleaseReadinessGate(d) {
  d = d || {}
  var required = [
    'credentialStateKnown',
    'realVsMockSemanticsKnown',
    'amountAuthorityKnown',
    'callbackVerificationKnown',
    'orderLifecycleKnown',
    'entitlementUpdateKnown',
    'idempotencyKnown',
    'failureBehaviorKnown',
  ]
  var unknown = []
  required.forEach(function (k) {
    if (d[k] !== true) unknown.push(k)
  })
  var ready = unknown.length === 0
  return { ready: ready, unknownRequired: unknown, gate: ready ? 'PASS' : 'BLOCKED' }
}

function buildPaymentDiscovery() {
  return {
    artifactType: 'PAYMENT_INTEGRATION_DISCOVERY',
    baseCanonicalSha: '0874254ede490d7fef6c20942ff663c0970a445c',
    paymentCodePresent: true,
    paymentPrimaryEntrypoint: 'createOrder (JSAPI prepay)',
    paymentIntegrationMode: PAYMENT_INTEGRATION_MODE,
    credentialState: {
      summary: 'ENV_CONFIGURED_OR_MOCK',
      // Only state + source class; NEVER raw values.
      credentials: JSON.parse(JSON.stringify(CREDENTIAL_SOURCES)),
      rawCredentialExported: false,
    },
    mockFallbackPresent: true,
    mockSuccessIsNotPaymentSuccess: MOCK_SUCCESS_IS_NOT_PAYMENT_SUCCESS,
    mockMarkers: MOCK_MARKERS.slice(),
    amountAuthority: AMOUNT_AUTHORITY,
    clientControlledAmount: CLIENT_CONTROLLED_AMOUNT,
    orderLifecycle: JSON.parse(JSON.stringify(ORDER_LIFECYCLE)),
    callbackHandler: JSON.parse(JSON.stringify(CALLBACK_HANDLER)),
    entitlement: JSON.parse(JSON.stringify(ENTITLEMENT)),
    refundRealApi: REFUND_REAL_API,
    entrypoints: JSON.parse(JSON.stringify(PAYMENT_ENTRYPOINTS)),
    notExecutableAdversarial: NOT_EXECUTABLE_ADVERSARIAL.slice(),
    amountUnit: 'FEN (分) — totalAmount in fen; DAILY_AI_BUDGET_FEN=50000 分=¥500',
    releaseReadiness: {
      codePresent: true,
      architectureUnderstood: true,
      releaseReady: false,
    },
  }
}

module.exports = {
  CREDENTIAL_SOURCES: CREDENTIAL_SOURCES,
  AMOUNT_AUTHORITY: AMOUNT_AUTHORITY,
  PAYMENT_INTEGRATION_MODE: PAYMENT_INTEGRATION_MODE,
  MOCK_SUCCESS_IS_NOT_PAYMENT_SUCCESS: MOCK_SUCCESS_IS_NOT_PAYMENT_SUCCESS,
  MOCK_MARKERS: MOCK_MARKERS,
  ORDER_LIFECYCLE: ORDER_LIFECYCLE,
  CALLBACK_HANDLER: CALLBACK_HANDLER,
  ENTITLEMENT: ENTITLEMENT,
  PAYMENT_ENTRYPOINTS: PAYMENT_ENTRYPOINTS,
  REFUND_REAL_API: REFUND_REAL_API,
  NOT_EXECUTABLE_ADVERSARIAL: NOT_EXECUTABLE_ADVERSARIAL,
  evaluatePaymentReleaseReadinessGate: evaluatePaymentReleaseReadinessGate,
  buildPaymentDiscovery: buildPaymentDiscovery,
}
