'use strict'
/**
 * tests/rc8.14/_harness.js — in-memory CloudBase-like DB + wx-server-sdk stub.
 * Node built-ins only. No network, no real DB, no real payment.
 *
 * Supports: collection(n).where(q).orderBy(k,dir).skip(n).limit(n).get()/count()
 *           collection(n).add({data}) / .doc(id).update({data}) / .doc(id).get()
 */
const Module = require('module')

function makeDb () {
  const store = {}
  const tick = () => new Promise((r) => setImmediate(r))

  function matchOne (doc, k, c) {
    const v = doc[k]
    if (c && typeof c === 'object' && c.__op) {
      if (c.__op === 'in') return c.v.includes(v)
      if (c.__op === 'neq') return v !== c.v
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
  function collection (name) {
    if (!store[name]) store[name] = []
    const chain = (q) => {
      let _skip = 0, _limit = Infinity
      const api = {
        orderBy (k, dir) {
          const arr = api._rows || (api._rows = store[name].filter((d) => match(d, q)))
          arr.sort((a, b) => (dir === 'desc' ? (b[k] > a[k] ? 1 : b[k] < a[k] ? -1 : 0) : (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0)))
          return api
        },
        skip (n) { _skip = n; return api },
        limit (n) { _limit = n; return api },
        async get () {
          await tick()
          let rows = store[name].filter((d) => match(d, q))
          if (api._rows) rows = api._rows
          rows = rows.slice(_skip, _skip + _limit)
          return { data: rows.map((d) => JSON.parse(JSON.stringify(d))) }
        },
        async count () { await tick(); return { total: store[name].filter((d) => match(d, q)).length } },
        async update ({ data }) { await tick(); const rs = store[name].filter((d) => match(d, q)); rs.forEach((d) => applyPatch(d, data)); return { stats: { updated: rs.length } } },
      }
      return api
    }
    return {
      where: (q) => chain(q),
      orderBy (k, dir) { return chain({}).orderBy(k, dir) },
      limit (n) { return chain({}).limit(n) },
      async get () { await tick(); return { data: store[name].map((d) => JSON.parse(JSON.stringify(d))) } },
      async count () { await tick(); return { total: store[name].length } },
      async add ({ data }) { await tick(); const doc = Object.assign({ _id: name + '_' + (store[name].length + 1) }, data); store[name].push(doc); return { _id: doc._id } },
      doc (id) {
        return {
          async update ({ data }) { await tick(); const d = store[name].find((x) => x._id === id); if (d) applyPatch(d, data); return { stats: { updated: d ? 1 : 0 } } },
          async get () { await tick(); const d = store[name].find((x) => x._id === id); return { data: d ? [JSON.parse(JSON.stringify(d))] : [] } },
        }
      },
    }
  }
  return { collection, _store: store, command: command() }
}

/** Minimal db.command with query operators the plan authority needs. */
function command () {
  return {
    neq: (v) => ({ __op: 'neq', v }),
    eq: (v) => ({ __op: 'eq', v }),
    in: (v) => ({ __op: 'in', v }),
    gt: (v) => ({ __op: 'gt', v }),
    gte: (v) => ({ __op: 'gte', v }),
    lt: (v) => ({ __op: 'lt', v }),
    lte: (v) => ({ __op: 'lte', v }),
    inc: (v) => ({ __op: 'inc', v }),
  }
}

function seed (db, name, doc) {
  if (!db._store[name]) db._store[name] = []
  db._store[name].push(Object.assign({ _id: name + '_' + (db._store[name].length + 1) }, doc))
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
