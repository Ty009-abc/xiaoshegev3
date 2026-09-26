'use strict'
/**
 * tests/ui/part-b/onboarding-content-visibility.test.js
 *
 * RC8.8_ONBOARDING_P0_CONTENT_VISIBILITY_RECOVERY — visibility guard.
 *
 * Proves the SAFE-VISIBILITY invariant for the onboarding page:
 *   A. content base state is visible WITHOUT animation
 *   B. if animation rules are removed/ignored, content stays visible
 *   C. page 1 initial state -> content visible
 *   D. page 2 active state  -> content visible
 *   E. footer (pagination/CTA) unchanged + visible
 *
 * Node built-ins only — no jsdom / miniprogram-simulate.
 *
 * Note: real per-pixel visibility on device is additionally proven by the
 * animation-stripped CDP render in the recovery report; this test guards the
 * CSS/logic contract that makes that outcome guaranteed.
 *
 * Run: node --test tests/ui/part-b/onboarding-content-visibility.test.js
 */

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const REPO = path.resolve(__dirname, '..', '..', '..')
const WXSS = path.join(REPO, 'pages', 'onboarding', 'onboarding.wxss')
const WXML = path.join(REPO, 'pages', 'onboarding', 'onboarding.wxml')
const JS = path.join(REPO, 'pages', 'onboarding', 'onboarding.js')

const wxss = fs.readFileSync(WXSS, 'utf8')
const wxml = fs.readFileSync(WXML, 'utf8')

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')
// remove @keyframes blocks (incl. one level of nested from/to) so their
// opacity:0 keyframe values are not mistaken for base-state declarations
const stripKeyframes = (s) => {
  let prev
  do {
    prev = s
    s = s.replace(/@keyframes\s*[^{]+\{(?:[^{}]|\{[^{}]*\})*\}/g, '')
  } while (s !== prev)
  return s
}
const css = stripKeyframes(stripComments(wxss))

// Split the stylesheet into rule blocks: { selector, body, raw }
function rules(source) {
  const out = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(source)) !== null) {
    const selector = m[1].replace(/\s+/g, ' ').trim()
    if (selector.startsWith('@')) continue
    out.push({ selector, body: m[2] })
  }
  return out
}
const RULES = rules(css)

function declsFor(selectorIncludes, opts = {}) {
  const hits = RULES.filter((r) => r.selector.includes(selectorIncludes) &&
    (opts.exact ? r.selector === selectorIncludes : true))
  return hits
}
function hasDecl(rule, prop, valRe) {
  const re = new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*' + valRe + '\\s*(?:;|$)')
  return re.test(rule.body)
}

// ─────────────────────────────────────────────────────────────
// A. base content visible without animation
// ─────────────────────────────────────────────────────────────
test('VIS-A: content base state has NO hidden opacity / is explicitly visible', () => {
  for (const sel of ['.visual-emoji', '.slide-title', '.slide-body']) {
    // every base rule (selector contains the class, no .is-active) must not hide
    for (const r of RULES) {
      if (!r.selector.includes(sel)) continue
      if (r.selector.includes('is-active')) continue
      if (r.selector.includes('keyframes')) continue
      // skip rules that belong to other elements (.visual-emoji is exact class)
      assert.ok(!/(?:^|;)\s*opacity\s*:\s*0(?![.\d])/.test(r.body),
        `${sel} base rule must not set opacity:0 -> ${r.selector}{${r.body.trim()}}`)
      assert.ok(!/(?:^|;)\s*visibility\s*:\s*hidden/.test(r.body),
        `${sel} base rule must not set visibility:hidden`)
      assert.ok(!/(?:^|;)\s*display\s*:\s*none/.test(r.body),
        `${sel} base rule must not set display:none`)
    }
  }
  // explicit safe default block
  const safe = RULES.find((r) => r.selector.includes('.slide .visual-emoji') &&
    r.selector.includes('.slide .slide-title') && r.selector.includes('.slide .slide-body'))
  assert.ok(safe, 'expected an explicit safe-default content block')
  assert.ok(hasDecl(safe, 'opacity', '1'), 'safe default must set opacity:1')
  assert.ok(hasDecl(safe, 'visibility', 'visible'), 'safe default must set visibility:visible')
  assert.ok(hasDecl(safe, 'transform', 'none'), 'safe default must set transform:none')
})

// ─────────────────────────────────────────────────────────────
// B. animation stripped -> content still visible
//    (no base opacity:0; no var() in animation/transition)
// ─────────────────────────────────────────────────────────────
test('VIS-B: animation is enhancement-only (no var() in animation/transition, first page safe)', () => {
  const decls = css.match(/(?:animation|transition)\s*:[^;}]*/g) || []
  assert.ok(decls.length > 0, 'expected animation/transition declarations')
  for (const d of decls) {
    assert.ok(!/var\s*\(/.test(d),
      `animation/transition must not use var() (drop risk): ${d.trim()}`)
  }
  // content animation must be gated on .is-active only
  for (const key of ['obEmoji', 'obTitle', 'obBody']) {
    for (const r of RULES) {
      if (!new RegExp('animation:\\s*' + key).test(r.body)) continue
      assert.ok(/is-active/.test(r.selector),
        `${key} must apply only under .is-active -> ${r.selector}`)
    }
  }
  // keyframes may start hidden — that is the only place opacity:0 lives
  for (const r of RULES) {
    if (/(?:^|;)\s*opacity\s*:\s*0(?![.\d])/.test(r.body) && !r.selector.includes('is-active')) {
      // only allowed for non-content decorative nodes (.deco base, etc.)
      assert.ok(/\.deco|\.bg-glow|\.orbit|\.lens-tint/.test(r.selector),
        `unexpected non-decor node with base opacity:0 -> ${r.selector}`)
    }
  }
})

// ─────────────────────────────────────────────────────────────
// Shared page sandbox (records real wx calls so onStart sees them)
// ─────────────────────────────────────────────────────────────
function loadPage() {
  const src = fs.readFileSync(JS, 'utf8')
  const rec = { switchTab: 0, reLaunch: 0, vibrate: 0, storage: 0 }
  const wx = {
    setStorageSync() { rec.storage++ },
    switchTab(o) { rec.switchTab++; o && o.success && o.success({}) },
    reLaunch(o) { rec.reLaunch++; o && o.success && o.success({}) },
    vibrateShort() { rec.vibrate++ },
  }
  let def = null
  // eslint-disable-next-line no-new-func
  const fn = new Function('Page', 'wx', 'console', src)
  fn((o) => { def = o }, wx, console)
  return { def, wx, rec }
}

// ─────────────────────────────────────────────────────────────
// C. page 1 initial state -> content visible
// ─────────────────────────────────────────────────────────────
test('VIS-C: page1 initial — current=0, is-active on first frame, content nodes bound', () => {
  const { def } = loadPage()
  assert.strictEqual(def.data.current, 0, 'current must start at 0 (page1 active first frame)')
  assert.ok(/class="slide \{\{current === index \? 'is-active' : ''\}\}"/.test(wxml),
    'page1 receives is-active when current === index === 0, before any swiper event')
  assert.ok(/class="visual-emoji"/.test(wxml) && /class="slide-title"/.test(wxml) &&
    /class="slide-body"/.test(wxml), 'emoji/title/body nodes must be present on first frame')
  assert.ok(/\{\{item\.emoji\}\}/.test(wxml) && /\{\{item\.title\}\}/.test(wxml),
    'emoji + title bindings must be present')
})

// ─────────────────────────────────────────────────────────────
// D. page 2 active state -> content visible (structure identical; only index changes)
// ─────────────────────────────────────────────────────────────
test('VIS-D: page2 active — swiper change advances current, is-active tracks index, 4 pages', () => {
  const { def } = loadPage()
  assert.strictEqual(def.data.pages.length, 4, 'PAGE_COUNT must be 4')
  const inst = Object.assign({}, def)
  inst.data = JSON.parse(JSON.stringify(def.data))
  inst.setData = (patch) => Object.assign(inst.data, patch)
  // simulate swiper change to page 2
  inst.onSwiperChange({ detail: { current: 1, source: 'touch' } })
  assert.strictEqual(inst.data.current, 1, 'swiper change must advance current to index 1 (page2)')
  // content is data-driven and identical in structure for every page
  for (const p of def.data.pages) {
    assert.ok(p.emoji && p.title && (p.body || (p.paras && p.paras.length)),
      'each page must carry emoji/title/body (data-driven content)')
  }
})

// ─────────────────────────────────────────────────────────────
// E. footer unchanged + page logic intact
// ─────────────────────────────────────────────────────────────
test('VIS-E: footer unchanged — pagination/skip/CTA + skip->P4 + nav, frozen copy/accents', () => {
  const { def, rec } = loadPage()
  assert.deepStrictEqual(def.data.pages.map((p) => p.color),
    ['#2583FF', '#F2A93B', '#FF5B68', '#31C978'], 'page accents frozen')

  // footer unchanged: pagination dots + skip(1..3)/cta(4)
  assert.ok(/class="pager"/.test(wxml) && /class="dot /.test(wxml), 'pager dots present')
  assert.ok(/wx:if="\{\{current < 3\}\}" bindtap="onSkip"/.test(wxml), 'skip shows on pages 1-3')
  assert.ok(/wx:if="\{\{current === 3\}\}" bindtap="onStart"/.test(wxml), 'CTA shows on page 4')
  assert.ok(/跳过/.test(wxml) && /开始认知诊断 →/.test(wxml), 'frozen CTA copy must remain')

  const inst = Object.assign({}, def)
  inst.data = JSON.parse(JSON.stringify(def.data))
  inst.setData = (patch) => Object.assign(inst.data, patch)
  inst._vibrateLight = def._vibrateLight

  // skip -> page 4 (index 3), NOT the questionnaire
  inst.onSkip()
  assert.strictEqual(inst.data.current, 3, 'onSkip must move to page 4 (index 3)')

  // onStart navigates to home (shared wx closure now correctly observed)
  inst.onStart()
  assert.strictEqual(rec.switchTab + rec.reLaunch, 1, 'onStart must trigger exactly one navigation')
  assert.ok(rec.storage >= 1, 'onStart must persist the onboarded flag')
})
