'use strict'
/**
 * tests/rc8.13/_harness.js — in-memory CloudBase-like DB for virtual-payment tests.
 * Node built-ins only. No network, no real DB, no real payment.
 *
 * Supports what finalizePaidOrder / entitlementService need:
 *   collection(n).where(q).limit(n).get()
 *   collection(n).where(q).update({data})
 *   collection(n).add({data})          // enforces UNIQUE constraints
 *   collection(n).doc(id).update({data})
 *   command: in / gt / gte / lt / lte / set / inc / neq
 * Uniqueness: payments.transactionId, entitlement_grants.orderId  (mirrors prod indexes)
 */
function makeDb () {
  const store = {}
  const uniques = { payments: ['transactionId'], entitlement_grants: ['orderId'] }
  const tick = () => new Promise((r) => setImmediate(r))
  const command = {
    in: (a) => ({ __op: 'in', v: a }),
    gt: (n) => ({ __op: 'gt', v: n }),
    gte: (n) => ({ __op: 'gte', v: n }),
    lt: (n) => ({ __op: 'lt', v: n }),
    lte: (n) => ({ __op: 'lte', v: n }),
    neq: (v) => ({ __op: 'neq', v }),
    set: (v) => ({ __op: 'set', v }),
    inc: (n) => ({ __op: 'inc', v: n }),
  }
  function values (doc, key) {
    const parts = key.split('.')
    let cur = [doc]
    for (const p of parts) {
      const next = []
      for (const node of cur) {
        if (node == null) continue
        if (Array.isArray(node)) node.forEach((n) => { if (n && n[p] !== undefined) next.push(n[p]) })
        else if (node[p] !== undefined) next.push(node[p])
      }
      cur = next
    }
    return cur
  }
  const matchOne = (doc, k, c) => {
    const vals = values(doc, k)
    if (c && typeof c === 'object' && c.__op) {
      if (c.__op === 'in') return vals.some((v) => c.v.includes(v))
      if (c.__op === 'neq') return vals.every((v) => v !== c.v)
      if (c.__op === 'gt') return vals.some((v) => v > c.v)
      if (c.__op === 'gte') return vals.some((v) => v >= c.v)
      if (c.__op === 'lt') return vals.some((v) => v < c.v)
      if (c.__op === 'lte') return vals.some((v) => v <= c.v)
      return false
    }
    return vals.some((v) => v === c)
  }
  const match = (doc, q) => Object.keys(q).every((k) => matchOne(doc, k, q[k]))
  function applyPatch (target, data) {
    for (const k of Object.keys(data)) {
      const c = data[k]
      if (c && typeof c === 'object' && c.__op) {
        if (c.__op === 'inc') target[k] = Number(target[k] || 0) + c.v
        else if (c.__op === 'set') target[k] = c.v
        else target[k] = c.v
      } else {
        target[k] = c
      }
    }
  }
  function collection (name) {
    if (!store[name]) store[name] = []
    const api = {
      where (q) {
        const rows = () => store[name].filter((d) => match(d, q))
        return {
          limit () { return this },
          orderBy () { return this },
          async get () { await tick(); return { data: rows().map((d) => JSON.parse(JSON.stringify(d))) } },
          async update ({ data }) { await tick(); const rs = rows(); rs.forEach((d) => applyPatch(d, data)); return { stats: { updated: rs.length } } },
          async remove () { await tick(); return { stats: { removed: 0 } } },
        }
      },
      async add ({ data }) {
        await tick()
        const cons = uniques[name] || []
        for (const key of cons) {
          if (store[name].some((d) => d[key] !== undefined && d[key] === data[key])) {
            const err = new Error('duplicate key error E11000')
            err.errCode = -502001
            throw err
          }
        }
        const doc = Object.assign({ _id: name + '_' + (store[name].length + 1) }, data)
        store[name].push(doc)
        return { _id: doc._id }
      },
      doc (id) {
        return {
          async update ({ data }) {
            await tick()
            const d = store[name].find((x) => x._id === id)
            if (d) applyPatch(d, data)
            return { stats: { updated: d ? 1 : 0 } }
          },
          async get () { await tick(); const d = store[name].find((x) => x._id === id); return { data: d ? [JSON.parse(JSON.stringify(d))] : [] } },
        }
      },
    }
    return api
  }
  return { collection, command, _store: store }
}
const seed = (db, name, doc) => { if (!db._store[name]) db._store[name] = []; db._store[name].push(Object.assign({ _id: name + '_' + (db._store[name].length + 1) }, doc)) }
module.exports = { makeDb, seed }
