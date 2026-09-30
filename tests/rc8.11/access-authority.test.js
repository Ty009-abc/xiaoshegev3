#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.11/access-authority.test.js
 *
 * RC8_11_STAGE1 — canonical membership/legacy access resolver.
 *
 * 覆盖 TEST_MATRIX A–D（访问判定部分）+ 关键 forbids：
 *   A new monthly → report + challenge access true
 *   B annual → core rights true + year exclusives preserved
 *   C legacy report_9_9 owner (no membership) → report true, challenge only if owned
 *   D legacy challenge_39_9 owner (no membership) → challenge true, report only if owned
 *   E membership expires → membership rights gone, legacy expiresAt:0 retained
 *   forbids: generic 'full_report' must NOT grant legacy report access;
 *            challenge_39_9 must NOT unlock report; report_9_9 must NOT unlock challenge.
 *
 * 无网络 / 无真实 DB / 无支付。
 */

const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..', '..')
const AA = path.join(ROOT, 'cloudfunctions', 'common', 'accessAuthority.js')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

const A = require(AA)
const NOW = 1790773000000

console.log('RC8_11_STAGE1 canonical access authority')

// ── §1 module shape ────────────────────────────────────────────────────────
{
  ok(typeof A.resolveAccess === 'function', 'exports resolveAccess')
  ok(typeof A.rightsForProduct === 'function', 'exports rightsForProduct')
  ok(typeof A.isRetiredNewSale === 'function', 'exports isRetiredNewSale')
  eq(A.LEGACY_REPORT_PRODUCT, 'report_9_9', 'legacy report product')
  eq(A.LEGACY_CHALLENGE_PRODUCT, 'challenge_39_9', 'legacy challenge product')
  eq(A.FREE_AI_DAILY_LIMIT, 3, 'free ai daily limit = 3')
}

// ── §2 A: new monthly membership → report + challenge true ─────────────────
{
  const month = { status: 'active', expiredAt: NOW + 30 * 86400000, memberType: 'vip_month_39_9' }
  const r = A.resolveAccess({ membership: month, sources: [], now: NOW })
  eq(r.membership.active, true, 'A membership active')
  eq(r.report.allowed, true, 'A report access true')
  eq(r.report.source, 'MEMBERSHIP', 'A report source MEMBERSHIP')
  eq(r.challenge.allowed, true, 'A challenge access true')
  eq(r.challenge.source, 'MEMBERSHIP', 'A challenge source MEMBERSHIP')
  eq(r.memory.allowed, true, 'A memory_member true')
  eq(r.scenario.allowed, true, 'A scenario_member true')
  eq(r.ai.allowed, true, 'A ai_member true')
}

// ── §3 B: annual → core + year exclusives ──────────────────────────────────
{
  const year = { status: 'active', expiredAt: NOW + 365 * 86400000, memberType: 'vip_year_299' }
  const rights = A.rightsForProduct('vip_year_299')
  ok(rights.includes('report_member') && rights.includes('challenge_member'), 'B core rights')
  ok(rights.includes('hard_truth_mode') && rights.includes('advanced_reports') && rights.includes('priority_model'), 'B year exclusives preserved')
  const r = A.resolveAccess({ membership: year, sources: [], now: NOW })
  eq(r.membership.level, 'yearly', 'B level yearly')
  eq(r.report.allowed, true, 'B report true')
  eq(r.challenge.allowed, true, 'B challenge true')
}

// ── §4 C: legacy report_9_9 only (no membership) ───────────────────────────
{
  const sources = [{ productId: 'report_9_9', expiresAt: 0 }]
  const r = A.resolveAccess({ membership: null, sources, now: NOW })
  eq(r.report.allowed, true, 'C report access true')
  eq(r.report.source, 'LEGACY_REPORT_9_9', 'C report source LEGACY_REPORT_9_9')
  eq(r.challenge.allowed, false, 'C challenge false (not owned)')
  eq(r.membership.active, false, 'C no membership')
}

// ── §5 D: legacy challenge_39_9 only (no membership) ───────────────────────
{
  const sources = [{ productId: 'challenge_39_9', expiresAt: 0 }]
  const r = A.resolveAccess({ membership: null, sources, now: NOW })
  eq(r.challenge.allowed, true, 'D challenge access true')
  eq(r.challenge.source, 'LEGACY_CHALLENGE_39_9', 'D challenge source LEGACY')
  eq(r.report.allowed, false, 'D report false — challenge_39_9 must NOT unlock report')
  eq(r.report.source, 'NONE', 'D report source NONE')
}

// ── §6 forbids: no cross-leak via shared 'full_report' ─────────────────────
{
  // A user whose entitlements.permissions contains generic 'full_report'
  // (from challenge_39_9) but whose SOURCES are challenge-only → report denied.
  const r = A.resolveAccess({ membership: null, sources: [{ productId: 'challenge_39_9', expiresAt: 0 }], now: NOW })
  eq(r.report.allowed, false, 'forbid: generic full_report (via challenge source) does NOT grant report')
  // report_9_9 source alone must not unlock challenge
  const r2 = A.resolveAccess({ membership: null, sources: [{ productId: 'report_9_9', expiresAt: 0 }], now: NOW })
  eq(r2.challenge.allowed, false, 'forbid: report_9_9 does NOT unlock challenge')
}

// ── §7 report.isPaid is authoritative ──────────────────────────────────────
{
  const r = A.resolveAccess({ membership: null, sources: [], report: { isPaid: true }, now: NOW })
  eq(r.report.allowed, true, 'report.isPaid true → report access')
  eq(r.report.source, 'REPORT_IS_PAID', 'source REPORT_IS_PAID')
}

// ── §8 E: membership expires → membership rights gone, legacy retained ──────
{
  const expired = { status: 'active', expiredAt: NOW - 1, memberType: 'vip_month_39_9' }
  const sources = [{ productId: 'report_9_9', expiresAt: 0 }]
  const r = A.resolveAccess({ membership: expired, sources, now: NOW })
  eq(r.membership.active, false, 'E expired membership inactive')
  eq(r.report.allowed, true, 'E legacy report retained')
  eq(r.report.source, 'LEGACY_REPORT_9_9', 'E report from legacy source')
  eq(r.challenge.allowed, false, 'E membership-derived challenge gone')
}

// ── §9 source expiry semantics ─────────────────────────────────────────────
{
  const r = A.resolveAccess({ membership: null, sources: [{ productId: 'report_9_9', expiresAt: NOW - 1 }], now: NOW })
  eq(r.report.allowed, false, 'expired legacy source → no access')
  const r2 = A.resolveAccess({ membership: null, sources: [], now: NOW })
  eq(r2.report.allowed, false, 'no source → fail-closed')
}

// ── §10 legacy permissions normalization (existing monthly memberships) ─────
{
  const legacyMonth = { status: 'active', expiredAt: NOW + 86400000, memberType: 'vip_month_99', permissions: ['full_report', 'report_history', 'challenge_full', 'unlimited_ai', 'growth_review'] }
  const r = A.resolveAccess({ membership: legacyMonth, sources: [], now: NOW })
  eq(r.report.allowed, true, 'legacy vip_month_99 permissions → report')
  eq(r.challenge.allowed, true, 'legacy vip_month_99 permissions → challenge')
}

// ── §11 retirement flags ───────────────────────────────────────────────────
{
  ok(A.isRetiredNewSale('report_9_9'), 'report_9_9 retired from new sale')
  ok(A.isRetiredNewSale('challenge_39_9'), 'challenge_39_9 retired from new sale')
  ok(A.isRetiredNewSale('vip_month_99'), 'vip_month_99 retired from new sale')
  ok(!A.isRetiredNewSale('vip_month_39_9'), 'vip_month_39_9 NOT retired')
  ok(!A.isRetiredNewSale('vip_year_299'), 'vip_year_299 NOT retired')
}

// ── §12 product catalog source ─────────────────────────────────────────────
{
  const { DEFAULT_PRODUCTS } = require(path.join(ROOT, 'cloudfunctions', 'initDatabase', 'data', 'products.js'))
  const byId = {}
  DEFAULT_PRODUCTS.forEach((p) => { byId[p.productId] = p })
  ok(byId.vip_month_39_9, 'catalog has vip_month_39_9')
  eq(byId.vip_month_39_9.price, 3990, 'vip_month_39_9 price 3990')
  eq(byId.vip_month_39_9.durationDays, 30, 'vip_month_39_9 30d')
  eq(byId.vip_month_39_9.type, 'membership', 'vip_month_39_9 membership')
  eq(byId.vip_year_299.price, 29900, 'vip_year_299 price 29900')
  eq(byId.vip_year_299.durationDays, 365, 'vip_year_299 365d')
  eq(byId.report_9_9.notNewSale, true, 'report_9_9 notNewSale')
  eq(byId.challenge_39_9.notNewSale, true, 'challenge_39_9 notNewSale')
  eq(byId.vip_month_99.notNewSale, true, 'vip_month_99 notNewSale')
  eq(byId.vip_year_299.notNewSale, false, 'vip_year_299 saleable')
  // all old products preserved
  ;['report_9_9', 'challenge_39_9', 'vip_month_99', 'vip_year_299'].forEach((id) => ok(!!byId[id], 'preserved ' + id))
}

console.log(`\naccess-authority_TEST pass=*** fail=${fail}`)
process.exit(fail ? 1 : 0)
