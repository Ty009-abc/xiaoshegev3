#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/admin-ui.test.js
 *
 * RC8.9A — Admin Console light UI contract (read-only).
 *
 *  1. admin page json uses a light navigation bar / background
 *  2. no admin wxss leaves a dark fullscreen background
 *  3. every admin page imports the shared light theme OR is self-light
 *  4. dashboard exposes loading + error states and clears loading
 *  5. pull-to-refresh stops on all terminal paths
 *  6. masked OpenID helper present (privacy default)
 *
 * Node built-ins only. Runnable from repo root.
 */

const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..', '..')
const ADMIN = path.join(ROOT, 'pages', 'admin')
const DARK = ['#0a0a14', '#12122a', '#0f1120', '#0c0e18', '#1a1a2e', '#070817']

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

function read(p) { return fs.readFileSync(p, 'utf8') }
function pages() {
  return fs.readdirSync(ADMIN).filter(d => fs.statSync(path.join(ADMIN, d)).isDirectory())
}

console.log('RC8.9A admin console light UI')

const allPages = pages()
ok(allPages.length >= 10, `admin pages discovered (${allPages.length})`)

// ── 1 + 2: no dark navigation / background, no dark fullscreen bg ──────────
let darkJson = 0, darkWxss = 0
for (const pg of allPages) {
  const j = path.join(ADMIN, pg, `${pg}.json`)
  if (fs.existsSync(j)) {
    const s = read(j)
    if (DARK.some(d => s.includes(d))) darkJson++
  }
  const w = path.join(ADMIN, pg, `${pg}.wxss`)
  if (fs.existsSync(w)) {
    const s = read(w)
    // a dark hex used as a page/background is a leak; flag only background usages
    const lines = s.split('\n').filter(l => /background/.test(l) && DARK.some(d => l.includes(d)))
    if (lines.length) { darkWxss += lines.length; console.log('    dark bg: ' + pg + ' -> ' + lines.join(' | ')) }
  }
}
ok(darkJson === 0, `no dark navigation/background in admin json (${darkJson})`)
ok(darkWxss === 0, `no dark fullscreen background in admin wxss (${darkWxss})`)

// ── 3: shared light theme imported by rebuilt pages ────────────────────────
for (const pg of ['dashboard', 'users', 'orders', 'content', 'ai-logs', 'settings']) {
  const w = path.join(ADMIN, pg, `${pg}.wxss`)
  ok(fs.existsSync(w) && read(w).includes('styles/admin.wxss'), `${pg} imports shared admin theme`)
}
ok(fs.existsSync(path.join(ROOT, 'styles', 'admin.wxss')), 'shared styles/admin.wxss exists')
const theme = read(path.join(ROOT, 'styles', 'admin.wxss'))
ok(theme.includes('#F5F7FA'), 'theme uses light page background #F5F7FA')
ok(theme.includes('#E5484D'), 'theme keeps brand accent #E5484D')
ok(theme.includes('--text: #111827'), 'theme defines light text alias')

// ── 4 + 5: dashboard loading/error + pull refresh ──────────────────────────
const djs = read(path.join(ADMIN, 'dashboard', 'dashboard.js'))
ok(/error:/.test(djs), 'dashboard has error state field')
ok(/finally/.test(djs) && /loading: false/.test(djs), 'dashboard clears loading in finally')
ok(/onPullDownRefresh/.test(djs) && /stopPullDownRefresh/.test(djs), 'dashboard stops pull-down refresh')
const dwxml = read(path.join(ADMIN, 'dashboard', 'dashboard.wxml'))
ok(/wx:if="\{\{loading/.test(dwxml) || /adm-skeleton/.test(dwxml), 'dashboard has loading UI')
ok(/adm-error/.test(dwxml) && /重新加载/.test(dwxml), 'dashboard has error UI + retry')
ok(/今日概览/.test(dwxml) && /用户趋势/.test(dwxml) && /核心漏斗/.test(dwxml), 'dashboard IA sections present')

// ── 6: privacy masking ─────────────────────────────────────────────────────
ok(/maskOpenid/.test(read(path.join(ADMIN, 'users', 'users.js'))), 'users masks openid')
ok(/maskOpenid/.test(read(path.join(ADMIN, 'orders', 'orders.js'))), 'orders masks openid')

console.log(`  _TEST pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
