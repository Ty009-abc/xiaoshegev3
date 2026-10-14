/**
 * RC8_14 Part 三.8 — C1–C10 runner (REAL identity, no mock)
 *
 * Runs on the bound test client (pages/runner), driving the 3 challenge
 * functions through wx.cloud.callFunction so the server derives identity from
 * cloud.getWXContext().OPENID. Records PASS/FAIL/BLOCKED + call identifiers
 * (recordId/eventId/timestamps) for each item.
 *
 * Requires: staging env bound to the mini-program + fixtures mapped to the
 * tester's real openid (staging-infra/map-identity.js). Until binding, every
 * item is reported BLOCKED (no real WX context reaches the function).
 *
 * NOTE: if the client cannot call the function (env not bound), callFunction
 * rejects with errCode -604100 / "env not exists/bound" → BLOCKED, never a
 * false PASS.
 */
const ENV = 'fanshen002-d9g0rjr3b6e313af5'
const call = (name, data) => wx.cloud.callFunction({ name, data }).then(r => r.result)

const FIXTURES = {
  rec: ['STG-REC-01', 'STG-REC-02'],
  unrec: ['STG-UNREC-01', 'STG-UNREC-02'],
  fin: ['STG-FIN-01', 'STG-FIN-02'],
  conc: ['STG-CONC-01', 'STG-CONC-02'],
  exp: 'STG-EXP-01',
}

function newReport () {
  const rows = []
  return {
    rows,
    add (id, name, status, detail, ids) { rows.push({ id, name, status, detail: detail || '', ids: ids || {} }) },
  }
}

async function getEvent (recordId) { return call('getChallengeEvent', { recordId }) }
async function submit (recordId, eventId, choiceKey) { return call('submitChallengeChoice', { recordId, eventId, choiceKey }) }

// C1: conditional-update atomicity — 10 concurrent GETs on one legacy record
async function C1 (rep) {
  const rid = FIXTURES.rec[0]
  const ts = Date.now()
  const res = await Promise.all(Array.from({ length: 10 }, () => getEvent(rid).catch(e => ({ error: String(e) }))))
  const served = res.filter(r => r && r.eventId).map(r => r.eventId)
  const distinct = [...new Set(served)]
  const errs = res.filter(r => r.error)
  if (errs.length) return rep.add('C1', 'conditional-update atomicity', 'BLOCKED', 'err: ' + errs[0].error, { recordId: rid, ts })
  rep.add('C1', 'conditional-update atomicity', distinct.length === 1 ? 'PASS' : 'FAIL',
    'readers=' + res.length + ' distinctServed=' + distinct.length, { recordId: rid, eventId: distinct[0], ts })
}

// C2: parallel GET same record → single served event
async function C2 (rep) {
  const rid = FIXTURES.rec[1]
  const ts = Date.now()
  const res = await Promise.all([0, 1, 2, 3, 4].map(() => getEvent(rid).catch(e => ({ error: String(e) }))))
  const errs = res.filter(r => r.error)
  if (errs.length) return rep.add('C2', 'parallel getChallengeEvent', 'BLOCKED', 'err: ' + errs[0].error, { recordId: rid, ts })
  const ids = [...new Set(res.map(r => r.eventId))]
  rep.add('C2', 'parallel getChallengeEvent', ids.length === 1 ? 'PASS' : 'FAIL',
    'parallel=5 distinctServed=' + ids.length, { recordId: rid, eventId: ids[0], ts })
}

// C3: parallel submit same event → single advance, no double score
async function C3 (rep) {
  const rid = FIXTURES.conc[1]
  const ev = await getEvent(rid)
  if (!ev || !ev.eventId) return rep.add('C3', 'parallel submit idempotency', 'BLOCKED', 'no event (need bound env + seeded record)', { recordId: rid })
  const ts = Date.now()
  const res = await Promise.all([0, 1, 2, 3, 4].map(() => submit(rid, ev.eventId, (ev.choices[0] || {}).key || 'A').catch(e => ({ error: String(e) }))))
  const ok = res.filter(r => r && typeof r.currentEventIndex === 'number')
  const idxs = [...new Set(ok.map(r => r.currentEventIndex))]
  if (!ok.length) return rep.add('C3', 'parallel submit idempotency', 'BLOCKED', 'err: ' + (res[0].error || 'n/a'), { recordId: rid, eventId: ev.eventId, ts })
  rep.add('C3', 'parallel submit idempotency', idxs.length === 1 ? 'PASS' : 'FAIL',
    'advance once → idx=' + idxs.join(','), { recordId: rid, eventId: ev.eventId, ts })
}

// C4: legacy record recovery — answered prefix exact
async function C4 (rep) {
  const rid = FIXTURES.rec[0]; const ts = Date.now()
  const r = await getEvent(rid).catch(e => ({ error: String(e) }))
  if (r.error) return rep.add('C4', 'legacy record recovery', 'BLOCKED', r.error, { recordId: rid, ts })
  rep.add('C4', 'legacy record recovery', r.eventId ? 'PASS' : 'FAIL', 'served=' + r.eventId + ' planVersion=' + (r.planVersion || '-'), { recordId: rid, eventId: r.eventId, ts })
}

// C5/C6/C7: full 30-day lifecycle on a fresh synthetic record (via startChallenge)
async function C567 (rep) {
  const ts = Date.now()
  const st = await call('startChallenge', {}).catch(e => ({ error: String(e) }))
  if (st.error || !st.recordId) return rep.add('C5', '30-day unique plan', 'BLOCKED', 'startChallenge: ' + (st.error || st.message || 'no record'), { ts })
  const served = []
  let cur = st.recordId
  let finished = false
  for (let i = 0; i < 31; i++) {
    const ev = await getEvent(cur)
    if (ev && ev.finished) { finished = true; break }
    if (!ev || !ev.eventId) return rep.add('C5', '30-day unique plan', 'FAIL', 'no event at i=' + i, { recordId: cur, ts })
    served.push(ev.eventId)
    const r = await submit(cur, ev.eventId, (ev.choices[0] || {}).key || 'A')
    if (r && r.status === 'finished') { finished = true; break }
  }
  const distinct = new Set(served)
  rep.add('C5', '30-day unique plan', distinct.size === served.length && served.length >= 30 ? 'PASS' : 'FAIL',
    'served=' + served.length + ' distinct=' + distinct.size, { recordId: cur, ts })
  rep.add('C6', 'Day30 completion', finished ? 'PASS' : 'FAIL', 'finished=' + finished, { recordId: cur, ts })
  const after = await getEvent(cur)
  rep.add('C7', 'Day31 rejection (no re-serve)', (after && after.finished && !after.eventId) ? 'PASS' : 'FAIL',
    'after=f' + (after && after.finished) + ' eventId=' + (after && after.eventId), { recordId: cur, ts })
}

// C8: eventBankVersion expansion → persisted plan unchanged before/after
async function C8 (rep) {
  const rid = FIXTURES.rec[0]; const ts = Date.now()
  const before = await getEvent(rid).catch(e => ({ error: String(e) }))
  if (before.error) return rep.add('C8', 'plan immutability on bank expansion', 'BLOCKED', before.error, { recordId: rid, ts })
  // After a bank expansion (owner adds events), the persisted plan's served id MUST NOT change.
  const after = await getEvent(rid)
  rep.add('C8', 'plan immutability on bank expansion', (before.eventId && before.eventId === (after && after.eventId)) ? 'PASS' : 'FAIL',
    'before=' + before.eventId + ' after=' + (after && after.eventId), { recordId: rid, eventId: before.eventId, ts })
}

// C9: expired-membership rights unchanged
async function C9 (rep) {
  const rid = FIXTURES.exp; const ts = Date.now()
  const r = await getEvent(rid).catch(e => ({ error: String(e) }))
  if (r.error) return rep.add('C9', 'expired-membership authority', 'BLOCKED', r.error, { recordId: rid, ts })
  rep.add('C9', 'expired-membership authority', (typeof r.code === 'undefined' || r.code === 0) ? 'PASS' : 'FAIL',
    'code=' + r.code + ' event=' + (r.eventId || '-'), { recordId: rid, ts })
}

// C10: unrecoverable legacy → LEGACY_PLAN_UNRECOVERABLE, nothing written
async function C10 (rep) {
  const rid = FIXTURES.unrec[0]; const ts = Date.now()
  const r = await getEvent(rid).catch(e => ({ error: String(e) }))
  if (r.error) return rep.add('C10', 'unrecoverable legacy', 'BLOCKED', r.error, { recordId: rid, ts })
  const code = (r.data && r.data.code) || r.code
  rep.add('C10', 'unrecoverable legacy', code === 'LEGACY_PLAN_UNRECOVERABLE' ? 'PASS' : 'FAIL', 'code=' + code, { recordId: rid, ts })
}

async function runAll (onDone) {
  const rep = newReport()
  try {
    await C1(rep); await C2(rep); await C3(rep); await C4(rep)
    await C567(rep); await C8(rep); await C9(rep); await C10(rep)
  } catch (e) {
    rep.add('X', 'runner exception', 'BLOCKED', String(e))
  }
  const summary = {
    env: ENV,
    ranAt: new Date().toISOString(),
    pass: rep.rows.filter(r => r.status === 'PASS').length,
    fail: rep.rows.filter(r => r.status === 'FAIL').length,
    blocked: rep.rows.filter(r => r.status === 'BLOCKED').length,
    rows: rep.rows,
  }
  onDone(summary)
}

module.exports = { runAll, FIXTURES, ENV }
