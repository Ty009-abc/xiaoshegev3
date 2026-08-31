'use strict'
// Local development-only static server for the H5 dashboard. Serves the UI +
// a single /harness/run bridge that shells out to the CLI (read-only, db:null).
//
// SECURITY: binds 127.0.0.1 only, no auth secrets, no cloud keys, no admin
// credentials, no production tokens. The /harness/run endpoint executes the
// LOCAL harness only (never production traffic) and is NOT a public endpoint.
const http = require('http')
const fs = require('fs')
const path = require('path')
const { execFile } = require('child_process')

const HARNESS_ROOT = path.resolve(__dirname, '..')
const UI_DIR = path.join(__dirname)
const CLI = path.join(HARNESS_ROOT, 'cli.js')
const PORT = parseInt(process.env.HARNESS_UI_PORT || '4873', 10)
const HOST = '127.0.0.1'

// Restrict runnable modes (no arbitrary shell, no production reach).
const ALLOWED_MODES = new Set(['run-1', 'run-100', 'negative', 'determinism', 'stress:500'])

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return }
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(data)
  })
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  if (url.pathname === '/' || url.pathname === '/index.html') {
    serveFile(res, path.join(UI_DIR, 'index.html'), 'text/html; charset=utf-8')
    return
  }
  if (url.pathname === '/harness/run') {
    const mode = url.searchParams.get('mode') || 'run-1'
    if (!ALLOWED_MODES.has(mode)) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'disallowed mode' }))
      return
    }
    execFile(process.execPath, [CLI, mode], { cwd: HARNESS_ROOT, maxBuffer: 128 * 1024 * 1024 }, (err, stdout) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      if (err) { res.end(JSON.stringify({ error: err.message })); return }
      try {
        res.end(stdout)
      } catch (e) {
        res.end(JSON.stringify({ raw: String(stdout).slice(0, 4000) }))
      }
    })
    return
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('not found')
})

server.listen(PORT, HOST, () => {
  console.log('harness dashboard (internal): http://' + HOST + ':' + PORT)
})
