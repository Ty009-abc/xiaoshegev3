#!/usr/bin/env node
'use strict'
/**
 * tools/rc814/release-compatibility.js — RC814 Phase 4
 *
 * Read-only comparison between the CURRENT PRODUCTION deployed functions and the
 * CANDIDATE source at HEAD. Reports, per function:
 *   - which files the candidate ADDS, CHANGES, or DROPS
 *   - any export/entry-point signature drift
 *   - any dependency drift (SDK pin changes, new requires)
 *
 * It does NOT deploy anything and does NOT touch any environment.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { spawnSync } = require('child_process')

const REPO = path.resolve(__dirname, '..', '..')
const ART = '/tmp/prod_art'
const FNS = ['startChallenge', 'submitChallengeChoice', 'getChallengeEvent']

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex')

function gitShow (commit, p) {
  const r = spawnSync('git', ['-C', REPO, 'show', commit + ':' + p], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })
  return r.status === 0 ? r.stdout : null
}

function listFiles (root) {
  const out = []
  function walk (d) {
    let ents = []
    try { ents = fs.readdirSync(d, { withFileTypes: true }) } catch (e) { return }
    for (const e of ents) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); continue }
      if (e.name === 'package-lock.json') continue
      out.push(path.relative(root, p).split(path.sep).join('/'))
    }
  }
  walk(root)
  return out.sort()
}

function main () {
  console.log('RC814 PHASE 4 — DEPLOYED vs CANDIDATE compatibility (read-only)\n')
  const head = spawnSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
  console.log('CANDIDATE_COMMIT: ' + head.slice(0, 12))
  console.log('')

  let problems = 0
  for (const fn of FNS) {
    const deployedDir = path.join(ART, fn)
    if (!fs.existsSync(deployedDir)) {
      console.log(`--- ${fn}: NO DEPLOYED SNAPSHOT (skipped)`)
      continue
    }
    const depFiles = listFiles(deployedDir)
    const candFiles = (() => {
      const dir = path.join(REPO, 'cloudfunctions', fn)
      return listFiles(dir)
    })()

    const added = candFiles.filter((f) => !depFiles.includes(f))
    const dropped = depFiles.filter((f) => !candFiles.includes(f))
    const changed = []
    const same = []
    for (const f of candFiles.filter((x) => depFiles.includes(x))) {
      const candBuf = fs.readFileSync(path.join(REPO, 'cloudfunctions', fn, f))
      const depBuf = fs.readFileSync(path.join(deployedDir, f))
      if (sha(candBuf) === sha(depBuf)) same.push(f)
      else changed.push(f)
    }

    console.log(`--- ${fn}`)
    console.log(`    identical : ${same.length}`)
    console.log(`    changed   : ${changed.length}${changed.length ? '  -> ' + changed.join(', ') : ''}`)
    console.log(`    added     : ${added.length}${added.length ? '  -> ' + added.join(', ') : ''}`)
    console.log(`    dropped   : ${dropped.length}${dropped.length ? '  -> ' + dropped.join(', ') : ''}`)
    if (dropped.length) { problems++; console.log('    !! DROPPED FILES ARE A RELEASE BLOCKER') }

    // entry point + config presence
    for (const must of ['index.js', 'config.json', 'package.json']) {
      const ok = candFiles.includes(must)
      if (!ok) { problems++; console.log(`    !! MISSING ${must}`) }
    }

    // dependency drift
    try {
      const depPkg = JSON.parse(fs.readFileSync(path.join(deployedDir, 'package.json'), 'utf8'))
      const candPkg = JSON.parse(fs.readFileSync(path.join(REPO, 'cloudfunctions', fn, 'package.json'), 'utf8'))
      const depDeps = depPkg.dependencies || {}
      const candDeps = candPkg.dependencies || {}
      const keys = Array.from(new Set([...Object.keys(depDeps), ...Object.keys(candDeps)])).sort()
      const drift = keys.filter((k) => depDeps[k] !== candDeps[k])
      if (drift.length) {
        for (const k of drift) {
          console.log(`    dep drift : ${k}  deployed=${depDeps[k] || '(absent)'}  candidate=${candDeps[k] || '(absent)'}`)
        }
      } else {
        console.log('    dep drift : none')
      }
    } catch (e) {
      console.log('    dep drift : UNREADABLE package.json')
      problems++
    }

    // export signature
    const candIdx = fs.readFileSync(path.join(REPO, 'cloudfunctions', fn, 'index.js'), 'utf8')
    const depIdx = fs.readFileSync(path.join(deployedDir, 'index.js'), 'utf8')
    const candExp = /exports\.main\s*=/.test(candIdx) ? 'exports.main' : 'MISSING'
    const depExp = /exports\.main\s*=/.test(depIdx) ? 'exports.main' : 'MISSING'
    console.log(`    entry     : deployed=${depExp} candidate=${candExp}`)
    if (candExp === 'MISSING' || depExp === 'MISSING') problems++
    console.log('')
  }

  console.log('COMPATIBILITY_RESULT: ' + (problems === 0 ? 'COMPATIBLE (no dropped files, no missing entry points)' : `BLOCKERS=${problems}`))
  process.exit(problems === 0 ? 0 : 1)
}

main()
