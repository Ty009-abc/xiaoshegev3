#!/usr/bin/env node
/**
 * RC8_14_D12_R5B — generate a FRESH preview QR for the INDEPENDENT staging
 * test-client (rc814-staging/staging-infra/test-client), AppID wxd441fbf3b9f10aa3.
 *
 * Preview only (no upload, no release, no production). The QR is written under
 * the git-ignored test-client/local/ directory. No secrets are printed.
 *
 *   node rc814-staging/staging-infra/preview-test-client.js
 */
const ci = require('miniprogram-ci')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const REPO = '/home/ubuntu/rc88-6q-refoundation'
const PROJECT_PATH = path.join(REPO, 'rc814-staging/staging-infra/test-client')
const APPID = 'wxd441fbf3b9f10aa3'
const PRIVATE_KEY = '/home/ubuntu/xiaoshige-v3/private.key'
const OUT_DIR = path.join(PROJECT_PATH, 'local')
const QR_PATH = path.join(OUT_DIR, 'preview-test-client.png')

if (!fs.existsSync(PRIVATE_KEY)) {
  console.error('missing CI private key at ' + PRIVATE_KEY)
  process.exit(1)
}
fs.mkdirSync(OUT_DIR, { recursive: true })

;(async () => {
  const project = new ci.Project({
    appid: APPID,
    type: 'miniProgram',
    projectPath: PROJECT_PATH,
    privateKeyPath: PRIVATE_KEY,
    ignores: ['node_modules/**/*', 'local/**/*', 'tests/**/*', '*.md'],
  })
  const commit = require('child_process').execSync('git -C ' + REPO + ' rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  const branch = require('child_process').execSync('git -C ' + REPO + ' rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()
  const result = await ci.preview({
    project,
    version: 'rc8.14-d12-r5b-test-client-' + commit,
    desc: 'RC8_14_D12_R5B staging test-client preview (login onboarding only)',
    setting: { es6: true, es7: true, minify: true, autoPrefixWXSS: true },
    qrcodeFormat: 'image',
    qrcodeOutputDest: QR_PATH,
    onProgressUpdate: (t) => { if (t && t._msg) process.stdout.write('  · ' + t._msg + '\n') },
  })
  const meta = {
    mode: 'preview', appid: APPID, appidMasked: APPID.slice(0, 4) + '****' + APPID.slice(-4),
    branch, commit, projectPath: PROJECT_PATH,
    qrcodePath: QR_PATH, miniprogramCiVersion: require('miniprogram-ci/package.json').version,
    generatedAt: new Date().toISOString(),
  }
  fs.writeFileSync(path.join(OUT_DIR, 'preview-test-client.json'), JSON.stringify(meta, null, 2))
  console.log('PREVIEW_OK qrcode=' + QR_PATH + ' commit=' + commit)
  console.log('sha256=' + crypto.createHash('sha256').update(fs.readFileSync(QR_PATH)).digest('hex'))
  if (result && result.subPackageInfo) console.log('size(bytes)=' + result.subPackageInfo.reduce((s, p) => s + (p.size || 0), 0))
})().catch((e) => {
  console.error('PREVIEW_FAIL ' + (e && e.message ? e.message : e))
  process.exit(1)
})
