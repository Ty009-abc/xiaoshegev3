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
 *
 * Evidence classification (for WorkBuddy): every finding is tagged with exactly
 * one of:
 *   OBSERVED_FROM_SOURCE   — static source read, no execution
 *   VERIFIED_BY_LOCAL_TEST — executed locally against pure Node module
 *   NOT_EXECUTABLE         — requires DB/network/WeChat runtime (declared, not faked)
 *   UNKNOWN                — cannot be determined without live evidence
 */

'use strict'

// ── Evidence classes ──
var E = {
  OBSERVED_FROM_SOURCE: 'OBSERVED_FROM_SOURCE',
  VERIFIED_BY_LOCAL_TEST: 'VERIFIED_BY_LOCAL_TEST',
  NOT_EXECUTABLE: 'NOT_EXECUTABLE',
  UNKNOWN: 'UNKNOWN',
}

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

// ── Mock semantics: comment vs runtime ──
var COMMENT_SEMANTICS = 'common/payment.js header claims "不再静默 fallback 到 mock 模式" (no silent mock fallback)'
var ACTUAL_RUNTIME_SEMANTICS = 'getConfig() sets isMock = !mchid; jsapiOrder returns success:true + _mock:true when isMock; queryOrder returns tradeState=SUCCESS + MOCK_TXN_ when isMock'

// ── Mock escalation chain (static trace) ──
var MOCK_SUCCESS_RETURNED_BY = 'common/payment.js jsapiOrder (success:true, _mock:true) AND queryOrder (success:true, tradeState:SUCCESS, MOCK_TXN_)'
var MOCK_SUCCESS_CONSUMED_BY = 'verifyPayment/index.js: queryOrder().tradeState === SUCCESS -> mark order paid + grantEntitlements'
var MOCK_FLAG_CHECKED_UPSTREAM = 'PARTIAL'
//   - frontend services/paymentService.js requestPayment() checks paymentParams._mock
//     and returns {success:true, mock:true} WITHOUT calling verifyPayment.
//   - BUT verifyPayment cloud function has NO _mock / MOCK_TXN_ prefix guard; if it is
//     invoked (direct call, restorePendingOrder, or a client that skips the frontend
//     mock short-circuit) in a mock-configured environment, it will treat mock SUCCESS
//     as real payment success.
var ORDER_MARKED_PAID_ON_MOCK = 'YES' // verifyPayment sets order.status=paid on queryOrder SUCCESS (mock returns SUCCESS)
var ENTITLEMENT_GRANTED_ON_MOCK = 'YES' // verifyPayment calls grantEntitlements on the same path

var PAYMENT_MOCK_SUCCESS_ESCALATION_RISK = true
var P1_CANDIDATE = true // per Batch4 rule §4: mock success can reach paid + entitlement without _mock guard in verifyPayment

// ── Amount authority ──
var CLIENT_SUBMITTED_AMOUNT = 'PRESENT (clientPrice field, optional, VALIDATED not authoritative)'
var SERVER_RECOMPUTED_AMOUNT = 'PRESENT (createOrder: totalAmount = product.price from products DB)'
var PAYMENT_PROVIDER_AMOUNT = 'PRESENT (jsapiOrder body amount.total = totalAmount from server)'
var CALLBACK_VERIFIED_AMOUNT = 'PRESENT (payCallback: amount.total !== order.totalAmount -> log + _ok, no entitlement)'
var AMOUNT_AUTHORITY = 'SERVER_AUTHORITATIVE' // DB product.price authoritative; clientPrice only validated
var CLIENT_CONTROLLED_AMOUNT = false

// ── Payment mode classification ──
var PAYMENT_INTEGRATION_MODE = 'MOCK_FALLBACK' // mock when mchid absent; real-capable code path exists but untested live

var MOCK_SUCCESS_IS_NOT_PAYMENT_SUCCESS = true // invariant (the mock path MUST be distinguishable)
var MOCK_MARKERS = ['_mock', 'MOCK_PREPAY_', 'MOCK_SIGN', 'MOCK_TXN_']

// ── Order lifecycle (code evidence) ──
var ORDER_LIFECYCLE = {
  orderIdGeneration: 'PRESENT', // generateOrderId (ts + random)
  idempotencyCreate: 'PRESENT', // checkDuplicateOrder (antiFraud)
  orderStates: 'PRESENT', // created/pending_payment/paid/failed/refunded/closed
  expirePending: 'PRESENT', // 30min auto-close
  amountValidation: 'PRESENT', // checkPrice (DB vs client)
  transactionIdIdempotency: 'PRESENT', // payments table dedup (payCallback + verifyPayment)
}

// ── Callback chain (independent items, enum only) ──
var CALLBACK_HANDLER = 'PRESENT' // payCallback/index.js
var SIGNATURE_VERIFICATION = 'PRESENT' // RSA-SHA256 + Wechatpay-Serial + timestamp window (5min)
var ORDER_LOOKUP = 'PRESENT'
var AMOUNT_MATCH = 'PRESENT' // amount.total !== order.totalAmount -> log + _ok (no entitlement)
var IDEMPOTENCY = 'PRESENT' // transactionId dedup in payments table
var STATUS_TRANSITION = 'PRESENT' // -> paid only on trade_state=SUCCESS
var ENTITLEMENT_UPDATE = 'PRESENT' // grantEntitlements

var ENTITLEMENT = {
  update: 'PRESENT', // grantEntitlements / entitlementService
  duplicateProtection: 'PARTIAL', // transactionId dedup prevents double-grant; membership renewal extends instead of duplicate
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

// ── Adversarial cases (P1..P10) with evidence classification ──
var ADVERSARIAL = {
  P1_MISSING_MCHID: { result: 'PASS', evidence: E.VERIFIED_BY_LOCAL_TEST, note: 'mock fallback confirmed: isMock=true, success:true, _mock:true, queryOrder SUCCESS' },
  P2_MALFORMED_AMOUNT: { result: 'NOT_EXECUTABLE_FROM_CURRENT_ARCHITECTURE', evidence: E.NOT_EXECUTABLE, note: 'requires products DB + createOrder cloud fn' },
  P3_CLIENT_AMOUNT_TAMPERING: { result: 'NOT_EXECUTABLE_FROM_CURRENT_ARCHITECTURE', evidence: E.OBSERVED_FROM_SOURCE, note: 'server-authoritative (DB price); clientPrice only validated' },
  P4_DUPLICATE_ORDER_CALLBACK: { result: 'NOT_EXECUTABLE_FROM_CURRENT_ARCHITECTURE', evidence: E.OBSERVED_FROM_SOURCE, note: 'checkDuplicateOrder + transactionId idempotency present in source' },
  P5_MISSING_SIGNATURE: { result: 'NOT_EXECUTABLE_FROM_CURRENT_ARCHITECTURE', evidence: E.OBSERVED_FROM_SOURCE, note: 'payCallback requires 4 wechatpay headers; missing -> 400 MISSING_HEADERS (source)' },
  P6_INVALID_SIGNATURE: { result: 'NOT_EXECUTABLE_FROM_CURRENT_ARCHITECTURE', evidence: E.OBSERVED_FROM_SOURCE, note: 'RSA-SHA256 verify present; requires platform cert env' },
  P7_CALLBACK_AMOUNT_MISMATCH: { result: 'NOT_EXECUTABLE_FROM_CURRENT_ARCHITECTURE', evidence: E.OBSERVED_FROM_SOURCE, note: 'amount.total !== order.totalAmount -> log + _ok (no entitlement)' },
  P8_PAYMENT_API_EXCEPTION: { result: 'NOT_EXECUTABLE_FROM_CURRENT_ARCHITECTURE', evidence: E.NOT_EXECUTABLE, note: 'requires network to api.mch.weixin.qq.com' },
  P9_TIMEOUT: { result: 'NOT_EXECUTABLE_FROM_CURRENT_ARCHITECTURE', evidence: E.NOT_EXECUTABLE, note: 'requires network; axios timeout 15000/10000 present in source' },
  P10_DUPLICATE_ENTITLEMENT: { result: 'NOT_EXECUTABLE_FROM_CURRENT_ARCHITECTURE', evidence: E.OBSERVED_FROM_SOURCE, note: 'transactionId idempotency present; membership renewal extends' },
}

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
      credentials: JSON.parse(JSON.stringify(CREDENTIAL_SOURCES)),
      rawCredentialExported: false,
      evidence: E.OBSERVED_FROM_SOURCE,
    },
    mockSemantics: {
      commentSemantics: COMMENT_SEMANTICS,
      actualRuntimeSemantics: ACTUAL_RUNTIME_SEMANTICS,
      mockSuccessReturnedBy: MOCK_SUCCESS_RETURNED_BY,
      mockSuccessConsumedBy: MOCK_SUCCESS_CONSUMED_BY,
      mockFlagCheckedUpstream: MOCK_FLAG_CHECKED_UPSTREAM,
      orderMarkedPaidOnMock: ORDER_MARKED_PAID_ON_MOCK,
      entitlementGrantedOnMock: ENTITLEMENT_GRANTED_ON_MOCK,
      evidence: E.OBSERVED_FROM_SOURCE,
    },
    mockFallbackPresent: true,
    mockSuccessIsNotPaymentSuccess: MOCK_SUCCESS_IS_NOT_PAYMENT_SUCCESS,
    mockMarkers: MOCK_MARKERS.slice(),
    paymentMockSuccessEscalationRisk: PAYMENT_MOCK_SUCCESS_ESCALATION_RISK,
    p1Candidate: P1_CANDIDATE,
    amountAuthority: {
      classification: AMOUNT_AUTHORITY,
      clientSubmittedAmount: CLIENT_SUBMITTED_AMOUNT,
      serverRecomputedAmount: SERVER_RECOMPUTED_AMOUNT,
      paymentProviderAmount: PAYMENT_PROVIDER_AMOUNT,
      callbackVerifiedAmount: CALLBACK_VERIFIED_AMOUNT,
      clientControlledAmount: CLIENT_CONTROLLED_AMOUNT,
      evidence: E.OBSERVED_FROM_SOURCE,
    },
    orderLifecycle: JSON.parse(JSON.stringify(ORDER_LIFECYCLE)),
    callbackChain: {
      callbackHandler: CALLBACK_HANDLER,
      signatureVerification: SIGNATURE_VERIFICATION,
      orderLookup: ORDER_LOOKUP,
      amountMatch: AMOUNT_MATCH,
      idempotency: IDEMPOTENCY,
      statusTransition: STATUS_TRANSITION,
      entitlementUpdate: ENTITLEMENT_UPDATE,
      evidence: E.OBSERVED_FROM_SOURCE,
    },
    entitlement: JSON.parse(JSON.stringify(ENTITLEMENT)),
    refundRealApi: REFUND_REAL_API,
    entrypoints: JSON.parse(JSON.stringify(PAYMENT_ENTRYPOINTS)),
    adversarial: JSON.parse(JSON.stringify(ADVERSARIAL)),
    amountUnit: 'FEN (分) — totalAmount in fen; DAILY_AI_BUDGET_FEN=50000 分=¥500',
    releaseReadiness: {
      codePresent: true,
      architectureUnderstood: true,
      releaseReady: false,
    },
  }
}

module.exports = {
  E: E,
  CREDENTIAL_SOURCES: CREDENTIAL_SOURCES,
  AMOUNT_AUTHORITY: AMOUNT_AUTHORITY,
  CLIENT_CONTROLLED_AMOUNT: CLIENT_CONTROLLED_AMOUNT,
  PAYMENT_INTEGRATION_MODE: PAYMENT_INTEGRATION_MODE,
  MOCK_SUCCESS_IS_NOT_PAYMENT_SUCCESS: MOCK_SUCCESS_IS_NOT_PAYMENT_SUCCESS,
  MOCK_MARKERS: MOCK_MARKERS,
  MOCK_FLAG_CHECKED_UPSTREAM: MOCK_FLAG_CHECKED_UPSTREAM,
  ORDER_MARKED_PAID_ON_MOCK: ORDER_MARKED_PAID_ON_MOCK,
  ENTITLEMENT_GRANTED_ON_MOCK: ENTITLEMENT_GRANTED_ON_MOCK,
  PAYMENT_MOCK_SUCCESS_ESCALATION_RISK: PAYMENT_MOCK_SUCCESS_ESCALATION_RISK,
  P1_CANDIDATE: P1_CANDIDATE,
  ORDER_LIFECYCLE: ORDER_LIFECYCLE,
  CALLBACK_HANDLER: CALLBACK_HANDLER,
  SIGNATURE_VERIFICATION: SIGNATURE_VERIFICATION,
  ORDER_LOOKUP: ORDER_LOOKUP,
  AMOUNT_MATCH: AMOUNT_MATCH,
  IDEMPOTENCY: IDEMPOTENCY,
  STATUS_TRANSITION: STATUS_TRANSITION,
  ENTITLEMENT_UPDATE: ENTITLEMENT_UPDATE,
  ENTITLEMENT: ENTITLEMENT,
  PAYMENT_ENTRYPOINTS: PAYMENT_ENTRYPOINTS,
  REFUND_REAL_API: REFUND_REAL_API,
  ADVERSARIAL: ADVERSARIAL,
  evaluatePaymentReleaseReadinessGate: evaluatePaymentReleaseReadinessGate,
  buildPaymentDiscovery: buildPaymentDiscovery,
}
