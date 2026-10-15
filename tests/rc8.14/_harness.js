'use strict'
/**
 * tests/rc8.14/_harness.js — in-memory CloudBase-like DB + wx-server-sdk stub.
 * Node built-ins only. No network, no real DB, no real payment.
 *
 * Supports: collection(n).where(q).orderBy(k,dir).skip(n).limit(n).get()/count()/update()/remove()
 *           collection(n).add({data}) / .doc(id).get()/update()/set()/remove()
 *           command(): eq neq in nin gt gte lt lte inc (and matches real SDK semantics)
 *
 * RC8_14_D12 additions (atomicity proof):
 *   - add({data:{_id}}) HONORS an explicit _id and THROWS on duplicate (mirrors
 *     MongoDB `_id` uniqueness, the primitive sessionClaim relies on).
 *   - doc(id).set({data}) is an UPSERT (returns stats.created / stats.updated).
 *   - chain.remove() and doc(id).remove() for claim release.
 */
const Module = require('module')

function makeDb () {
  const store = {}
  const tick = () => new Promise((r) => setImmediate(r))

  function matchOne (doc, k, c) {
    const v = doc[k]
    if (c && typeof c === 'object' && c.__op) {
      if (c.__op === 'in') return c.v.includes(v)
      if (c.__op === 'nin') return !c.v.includes(v)
      if (c.__op === 'neq') return v !== c.v
      if (c.__op === 'eq') return v === c.v
      if (c.__op === 'gt') return v > c.v
      if (c.__op === 'gte') return v >= c.v
      if (c.__op === 'lt') return v < c.v
      if (c.__op === 'lte') return v <= c.v
      return false
    }
    return v === c
  }
  const match = (doc, q) => Object.keys(q || {}).every((k) => matchOne(doc, k, q[k]))
  function applyPatch (t, data) {
    for (const k of Object.keys(data)) {
      const c = data[k]
      if (c && typeof c === 'object' && c.__op) {
        if (c.__op === 'inc') t[k] = Number(t[k] || 0) + c.v
        else t[k] = c.v
      } else t[k] = c
    }
  }
  let autoSeq = 0
  function collection (name) {
    if (!store[name]) store[name] = []
    const chain = (q) => {
      let _skip = 0, _limit = Infinity
      const rowsNow = () => (api._rows || (api._rows = store[name].filter((d) => match(d, q))))
      const api = {
        orderBy (k, dir) {
          const arr = rowsNow()
          arr.sort((a, b) => (dir === 'desc' ? (b[k] > a[k] ? 1 : b[k] < a[k] ? -1 : 0) : (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0)))
          return api
        },
        skip (n) { _skip = n; return api },
        limit (n) { _limit = n; return api },
        async get () {
          await tick()
          let rows = rowsNow()
          rows = rows.slice(_skip, _skip + _limit)
          return { data: rows.map((d) => JSON.parse(JSON.stringify(d))) }
        },
        async count () { await tick(); return { total: rowsNow().length } },
        async update ({ data }) {
          await tick()
          const rs = store[name].filter((d) => match(d, q))
          rs.forEach((d) => applyPatch(d, data))
          return { stats: { updated: rs.length } }
        },
        async remove () {
          await tick()
          const keep = store[name].filter((d) => !match(d, q))
          const removed = store[name].length - keep.length
          store[name] = keep
          return { stats: { removed } }
        },
      }
      return api
    }
    return {
      where: (q) => chain(q),
      orderBy (k, dir) { return chain({}).orderBy(k, dir) },
      limit (n) { return chain({}).limit(n) },
      async get () { await tick(); return { data: store[name].map((d) => JSON.parse(JSON.stringify(d))) } },
      async count () { await tick(); return { total: store[name].length } },
      async add ({ data }) {
        await tick()
        const provided = data && data._id
        const id = provided || (name + '_auto' + (++autoSeq))
        if (store[name].some((d) => d._id === id)) {
          // mirror MongoDB duplicate `_id` (E11000)
          const err = new Error('E11000 duplicate key error collection: ' + name + ' index: _id_ dup key: { _id: "' + id + '" }')
          err.errCode = -502001
          throw err
        }
        const doc = Object.assign({ _id: id }, data)
        store[name].push(doc)
        return { _id: id }
      },
      doc (id) {
        return {
          async get () {
            await tick()
            const d = store[name].find((x) => x._id === id)
            if (!d) { const e = new Error('document with _id ' + id + ' does not exist'); e.errCode = -502002; throw e }
            return { data: JSON.parse(JSON.stringify(d)) }
          },
          async update ({ data }) { await tick(); const d = store[name].find((x) => x._id === id); if (d) applyPatch(d, data); return { stats: { updated: d ? 1 : 0 } } },
          async set ({ data }) {
            await tick()
            let d = store[name].find((x) => x._id === id)
            const created = !d
            if (!d) { d = { _id: id }; store[name].push(d) }
            for (const k of Object.keys(data)) d[k] = data[k]
            return { _id: id, stats: { created: created ? 1 : 0, updated: created ? 0 : 1 } }
          },
          async remove () {
            await tick()
            const before = store[name].length
            store[name] = store[name].filter((x) => x._id !== id)
            return { stats: { removed: before - store[name].length } }
          },
        }
      },
    }
  }
  return { collection, _store: store, command: command() }
}

/** Minimal db.command with query operators the plan authority + claim need. */
function command () {
  return {
    eq: (v) => ({ __op: 'eq', v }),
    neq: (v) => ({ __op: 'neq', v }),
    in: (v) => ({ __op: 'in', v }),
    nin: (v) => ({ __op: 'nin', v }),
    gt: (v) => ({ __op: 'gt', v }),
    gte: (v) => ({ __op: 'gte', v }),
    lt: (v) => ({ __op: 'lt', v }),
    lte: (v) => ({ __op: 'lte', v }),
    inc: (v) => ({ __op: 'inc', v }),
  }
}

function seed (db, name, doc) {
  if (!db._store[name]) db._store[name] = []
  if (!doc._id) doc = Object.assign({ _id: name + '_' + (db._store[name].length + 1) }, doc)
  db._store[name].push(doc)
}

/** Stub wx-server-sdk before loading a cloud function. Returns a restore fn. */
function stubCloud (getOpenid, db) {
  const fake = {
    DYNAMIC_CURRENT_ENV: 'test-env',
    init () {},
    getWXContext: () => ({ OPENID: typeof getOpenid === 'function' ? getOpenid() : getOpenid }),
    database: () => db,
  }
  const orig = Module._load
  Module._load = function (request) {
    if (request === 'wx-server-sdk') return fake
    return orig.apply(this, arguments)
  }
  return () => { Module._load = orig }
}

/** Build a synthetic active bank of N events CE001..CEnnn (unique). */
function makeBank (n) {
  const out = []
  for (let i = 1; i <= n; i++) {
    const id = 'CE' + String(i).padStart(3, '0')
    out.push({
      eventId: id, day: i, difficulty: 1,
      title: 'Q' + i, description: 'D' + i, status: 'active',
      choices: [
        { key: 'A', text: 'a', effects: { systemThinking: 5, longTermism: 4 }, tags: ['t1'] },
        { key: 'B', text: 'b', effects: { riskAwareness: -6, longTermism: -3 }, tags: ['t2'] },
      ],
    })
  }
  return out
}

module.exports = { makeDb, seed, stubCloud, makeBank }
