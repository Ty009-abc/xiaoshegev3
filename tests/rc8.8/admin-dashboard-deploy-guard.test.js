#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.8/admin-dashboard-deploy-guard.test.js
 *
 * RC8.8_ADMIN_DASHBOARD_DEPLOY_GUARD — reproducible-deploy contract.
 *
 * Guards against the incident class "source-only deploy of a
 * dependency-bearing cloud function":
 *
 *   1. adminGetDashboard/package.json declares wx-server-sdk
 *   2. a package-lock.json is present and pins wx-server-sdk (versioned)
 *   3. the deploy guard script exists and enforces the invariants
 *      (npm ci --omit=dev, require.resolve check, node_modules presence)
 *   4. node_modules is NOT version-controlled
 *
 * Node built-ins only. Runnable from repo root; read-only (never installs).
 */

const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..', '..')
const FN_DIR = path.join(ROOT, 'cloudfunctions', 'adminGetDashboard')
const GUARD = path.join(ROOT, 'scripts', 'deploy-admin-dashboard.sh')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const read = (p) => fs.readFileSync(p, 'utf8')

console.log('RC8.8 admin dashboard deploy guard')

// ── 1. dependency declared ────────────────────────────────────────────────
const pkg = JSON.parse(read(path.join(FN_DIR, 'package.json')))
ok(!!(pkg.dependencies && pkg.dependencies['wx-server-sdk']), 'package.json declares wx-server-sdk')

// ── 2. lockfile pins the dependency ───────────────────────────────────────
const lockPath = path.join(FN_DIR, 'package-lock.json')
ok(fs.existsSync(lockPath), 'package-lock.json present (for reproducible deploys)')
if (fs.existsSync(lockPath)) {
  const lock = JSON.parse(read(lockPath))
  const entry = (lock.packages && lock.packages['node_modules/wx-server-sdk']) || {}
  ok(!!entry.version, `lockfile pins wx-server-sdk@${entry.version}`)
  ok(lock.lockfileVersion >= 2, `lockfileVersion=${lock.lockfileVersion} (>=2, supports npm ci)`)
}

// ── 3. guard script enforces the invariants ───────────────────────────────
ok(fs.existsSync(GUARD), 'deploy guard script present')
if (fs.existsSync(GUARD)) {
  const g = read(GUARD)
  ok(/npm ci --omit=dev/.test(g), 'guard uses npm ci --omit=dev')
  ok(/require\.resolve\(/.test(g), 'guard verifies module resolvability')
  ok(/node_modules\/\$REQUIRED_MODULE|node_modules\/wx-server-sdk/.test(g), 'guard checks node_modules present')
  ok(/package-lock\.json/.test(g), 'guard is lockfile-aware')
}

// ── 4. node_modules must not be versioned ─────────────────────────────────
const gitignore = read(path.join(ROOT, '.gitignore'))
ok(/node_modules\//.test(gitignore), 'node_modules/ is gitignored')

console.log(`  _TEST pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
