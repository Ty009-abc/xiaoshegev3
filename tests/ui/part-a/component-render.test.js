/**
 * PART A — REAL COMPONENT RENDER TEST (miniprogram-simulate)
 *
 * Renders real Component() code. Validates default/loading/disabled/error/empty
 * states, modal open/close, CTA enable/disable, duplicate-tap guards, event
 * emission, prop/data binding, conditional rendering.
 *
 * NOT claimed: real Page rendering / DevTools runtime / device matrix / E2E.
 *
 * @env TEST_ONLY / NON_PRODUCTION / NO REAL PAYMENT
 * Run: NODE_PATH=/tmp/mpspike/node_modules node --test tests/ui/part-a/*.test.js
 */

const test = require('node:test')
const assert = require('node:assert')
const { renderComponent, captureEvents } = require('../helpers/componentRender')

// ─────────────────────────────────────────────────────────────
// xsg-loading
// ─────────────────────────────────────────────────────────────
test('XSG-LOADING renders default text + custom text binding', () => {
  const a = renderComponent('xsg-loading')
  assert.ifError(a.loadError)
  assert.strictEqual(a.comp.data.text, '正在加载...')

  const b = renderComponent('xsg-loading', { text: '分析中...' })
  assert.ifError(b.loadError)
  assert.strictEqual(b.comp.data.text, '分析中...')
  assert.ok(JSON.stringify(b.comp.toJSON()).includes('分析中...'))
})

// ─────────────────────────────────────────────────────────────
// xsg-error
// ─────────────────────────────────────────────────────────────
test('XSG-ERROR default props + retry event', () => {
  const { comp, instance, loadError } = renderComponent('xsg-error')
  assert.ifError(loadError)
  assert.strictEqual(comp.data.title, '系统暂时看不清这个世界')
  assert.strictEqual(comp.data.btnText, '重试')
  const events = captureEvents(instance)
  instance.onRetry()
  assert.strictEqual(events.length, 1)
  assert.strictEqual(events[0].name, 'retry')
})

// ─────────────────────────────────────────────────────────────
// xsg-empty
// ─────────────────────────────────────────────────────────────
test('XSG-EMPTY action button hidden when btnText empty; emits action when present', () => {
  const a = renderComponent('xsg-empty')
  assert.ifError(a.loadError)
  assert.strictEqual(a.comp.data.btnText, '')
  assert.ok(!JSON.stringify(a.comp.toJSON()).includes('empty-btn'))

  const b = renderComponent('xsg-empty', { btnText: '去探索' })
  assert.ifError(b.loadError)
  const events = captureEvents(b.instance)
  b.instance.onBtn()
  assert.strictEqual(events.length, 1)
  assert.strictEqual(events[0].name, 'action')
})

// ─────────────────────────────────────────────────────────────
// xsg-button
// ─────────────────────────────────────────────────────────────
test('XSG-BUTTON tap emits tapbutton; disabled/loading blocks tap', () => {
  const a = renderComponent('xsg-button')
  assert.ifError(a.loadError)
  const ev = captureEvents(a.instance)
  a.instance.onTap()
  assert.strictEqual(ev.length, 1)
  assert.strictEqual(ev[0].name, 'tapbutton')

  const b = renderComponent('xsg-button', { disabled: true })
  assert.ifError(b.loadError)
  const ev2 = captureEvents(b.instance)
  b.instance.onTap()
  assert.deepStrictEqual(ev2, [])

  const c = renderComponent('xsg-button', { loading: true })
  assert.ifError(c.loadError)
  const ev3 = captureEvents(c.instance)
  c.instance.onTap()
  assert.deepStrictEqual(ev3, [])
})

// ─────────────────────────────────────────────────────────────
// membership-card
// ─────────────────────────────────────────────────────────────
test('MEMBERSHIP-CARD select event + recommended/selected flags', () => {
  const { comp, instance, loadError } = renderComponent('membership-card', { recommended: true, selected: true, product: { name: '年度会员', priceDisplay: '99.00', durationText: '/年' } })
  assert.ifError(loadError)
  assert.strictEqual(comp.data.recommended, true)
  assert.strictEqual(comp.data.selected, true)
  const ev = captureEvents(instance)
  instance.onTap()
  assert.strictEqual(ev.length, 1)
  assert.strictEqual(ev[0].name, 'select')
})

// ─────────────────────────────────────────────────────────────
// report-lock-card
// ─────────────────────────────────────────────────────────────
test('REPORT-LOCK-CARD benefits loop + unlock event', () => {
  const { comp, instance, loadError } = renderComponent('report-lock-card', { title: '完整报告', benefits: ['五维分析', '行动路径'], btnText: '立即解锁' })
  assert.ifError(loadError)
  const text = JSON.stringify(comp.toJSON())
  assert.ok(text.includes('五维分析') && text.includes('行动路径'))
  const ev = captureEvents(instance)
  instance.onTap()
  assert.strictEqual(ev.length, 1)
  assert.strictEqual(ev[0].name, 'unlock')
})

// ─────────────────────────────────────────────────────────────
// permission-modal
// ─────────────────────────────────────────────────────────────
test('PERMISSION-MODAL visible conditional render + confirm/cancel events', () => {
  const hidden = renderComponent('permission-modal')
  assert.ifError(hidden.loadError)
  assert.strictEqual(hidden.comp.data.visible, false)

  const { comp, instance, loadError } = renderComponent('permission-modal', { visible: true, benefits: ['b1'] })
  assert.ifError(loadError)
  assert.strictEqual(comp.data.visible, true)
  const ev = captureEvents(instance)
  instance.onConfirm()
  instance.onCancel()
  assert.deepStrictEqual(ev.map(e => e.name), ['confirm', 'cancel'])
})

// ─────────────────────────────────────────────────────────────
// level-up-modal
// ─────────────────────────────────────────────────────────────
test('LEVEL-UP-MODAL visible observer → anim async true; confirm event', async () => {
  const { comp, instance, loadError } = renderComponent('level-up-modal', { visible: true, fromLevel: 1, toLevel: 2 })
  assert.ifError(loadError)
  assert.strictEqual(comp.data.visible, true)
  await new Promise(r => setTimeout(r, 80))
  assert.strictEqual(comp.data.anim, true)
  const ev = captureEvents(instance)
  instance.onConfirm()
  assert.strictEqual(ev.length, 1)
  assert.strictEqual(ev[0].name, 'confirm')
})

// ─────────────────────────────────────────────────────────────
// challenge-choice — duplicate-tap + disabled guard
// ─────────────────────────────────────────────────────────────
test('CHALLENGE-CHOICE select event + submitted/disabled guards', () => {
  const { instance, loadError } = renderComponent('challenge-choice', { choiceKey: 'A', text: '选项', disabled: false, submitted: false })
  assert.ifError(loadError)
  const ev = captureEvents(instance)
  instance.onTap()
  assert.strictEqual(ev.length, 1)
  assert.deepStrictEqual(ev[0].detail, { key: 'A' })

  const d = renderComponent('challenge-choice', { choiceKey: 'A', disabled: true })
  assert.ifError(d.loadError)
  const ev2 = captureEvents(d.instance)
  d.instance.onTap()
  assert.deepStrictEqual(ev2, [])

  const s = renderComponent('challenge-choice', { choiceKey: 'A', submitted: true })
  assert.ifError(s.loadError)
  const ev3 = captureEvents(s.instance)
  s.instance.onTap()
  assert.deepStrictEqual(ev3, [])
})

// ─────────────────────────────────────────────────────────────
// world-rule-card — locked guard
// ─────────────────────────────────────────────────────────────
test('WORLD-RULE-CARD openrule event + locked guard', () => {
  const { instance, loadError } = renderComponent('world-rule-card', { locked: false })
  assert.ifError(loadError)
  const ev = captureEvents(instance)
  instance.onTap()
  assert.strictEqual(ev.length, 1)
  assert.strictEqual(ev[0].name, 'openrule')

  const l = renderComponent('world-rule-card', { locked: true })
  assert.ifError(l.loadError)
  const ev2 = captureEvents(l.instance)
  l.instance.onTap()
  assert.deepStrictEqual(ev2, [])
})

// ─────────────────────────────────────────────────────────────
// xsg-card — clickable guard
// ─────────────────────────────────────────────────────────────
test('XSG-CARD tapcard event + clickable guard', () => {
  const { instance, loadError } = renderComponent('xsg-card')
  assert.ifError(loadError)
  const ev = captureEvents(instance)
  instance.onTap()
  assert.strictEqual(ev.length, 1)

  const c = renderComponent('xsg-card', { clickable: false })
  assert.ifError(c.loadError)
  const ev2 = captureEvents(c.instance)
  c.instance.onTap()
  assert.deepStrictEqual(ev2, [])
})

// ─────────────────────────────────────────────────────────────
// growth-panel — observer computes pct/remain/target
// ─────────────────────────────────────────────────────────────
test('GROWTH-PANEL observer computes progress from cv/level', () => {
  const { comp, loadError } = renderComponent('growth-panel', { cv: 150, level: 2 })
  assert.ifError(loadError)
  assert.strictEqual(comp.data.pct, 50)
  assert.strictEqual(comp.data.remain, 50)
  assert.strictEqual(comp.data.target, 200)
  assert.ok(comp.data.nextTitle)
})
