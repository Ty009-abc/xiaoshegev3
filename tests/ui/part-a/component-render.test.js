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
// pay-modal
// ─────────────────────────────────────────────────────────────
test('PAY-MODAL default: visible=false, loading=false, anim=false', () => {
  const { comp, instance, loadError } = renderComponent('pay-modal')
  assert.ifError(loadError)
  assert.strictEqual(comp.data.visible, false)
  assert.strictEqual(comp.data.anim, false)
  assert.strictEqual(comp.data.loading, false)
  const events = captureEvents(instance)
  instance.onPay()
  // FIX1: hidden + onPay => NO pay event (guard includes `visible`).
  assert.deepStrictEqual(events.map(e => e.name), [],
    'onPay must no-op when visible=false (FIX1)')
})

test('PAY-MODAL FIX1: visible + !loading => exactly one pay event', () => {
  const { comp, instance, loadError } = renderComponent('pay-modal', { visible: true, loading: false })
  assert.ifError(loadError)
  const events = captureEvents(instance)
  instance.onPay()
  assert.deepStrictEqual(events.map(e => e.name), ['pay'],
    'visible + !loading must emit exactly one pay event')
})

test('PAY-MODAL FIX1: visible + loading => no pay event', () => {
  const { comp, instance, loadError } = renderComponent('pay-modal', { visible: true, loading: true })
  assert.ifError(loadError)
  const events = captureEvents(instance)
  instance.onPay()
  assert.deepStrictEqual(events.map(e => e.name), [],
    'visible + loading must emit no pay event')
})

test('PAY-MODAL visible observer sets anim=true', () => {
  const { comp, instance, loadError } = renderComponent('pay-modal', { visible: true })
  assert.ifError(loadError)
  assert.strictEqual(comp.data.visible, true)
  // observer 'visible' fires on init when true
  assert.strictEqual(comp.data.anim, true)
  assert.ok(instance)
})

test('PAY-MODAL onPay emits "pay" only when not loading', () => {
  const { comp, instance, loadError } = renderComponent('pay-modal', { visible: true, loading: false })
  assert.ifError(loadError)
  const events = captureEvents(instance)
  instance.onPay()
  assert.strictEqual(events.length, 1)
  assert.strictEqual(events[0].name, 'pay')
})

test('PAY-MODAL duplicate-tap guard: loading=true blocks onPay', () => {
  const { comp, instance, loadError } = renderComponent('pay-modal', { visible: true, loading: true })
  assert.ifError(loadError)
  const events = captureEvents(instance)
  instance.onPay()
  instance.onPay()
  assert.deepStrictEqual(events, [], 'loading=true must block pay event')
})

test('PAY-MODAL onClose sets anim=false and emits "close" after 250ms', async () => {
  const { comp, instance, loadError } = renderComponent('pay-modal', { visible: true })
  assert.ifError(loadError)
  const events = captureEvents(instance)
  instance.onClose()
  assert.strictEqual(comp.data.anim, false)
  await new Promise(r => setTimeout(r, 300))
  assert.ok(events.some(e => e.name === 'close'), 'close event emitted after timeout')
})

test('PAY-MODAL FIX3: onClose stores timer handle; detached clears it (no close after detach)', async () => {
  const { comp, instance, loadError } = renderComponent('pay-modal', { visible: true })
  assert.ifError(loadError)
  const events = captureEvents(instance)
  instance.onClose()
  assert.ok(instance._closeTimer != null, 'onClose must store a timer handle')
  comp.triggerLifeTime('detached')
  assert.strictEqual(instance._closeTimer, null, 'detached must clear the close timer')
  await new Promise(r => setTimeout(r, 350))
  assert.deepStrictEqual(events.map(e => e.name), [],
    'no close event must fire after detach (FIX3)')
})

test('PAY-MODAL FIX3: repeated onClose clears previous timer (single pending timer)', () => {
  const { comp, instance, loadError } = renderComponent('pay-modal', { visible: true })
  assert.ifError(loadError)
  instance.onClose()
  const first = instance._closeTimer
  instance.onClose()
  assert.notStrictEqual(instance._closeTimer, first, 'a new timer handle should replace the old one')
  assert.ok(instance._closeTimer != null)
})

test('PAY-MODAL conditional rendering: product fields bind into WXML tree', () => {
  const product = { type: 'membership', name: 'VIP', description: '解锁全部', priceDisplay: '39.90', durationText: '/30天', originalPriceDisplay: '59.90', benefits: ['a', 'b'] }
  const { comp, loadError } = renderComponent('pay-modal', { visible: true, product })
  assert.ifError(loadError)
  assert.strictEqual(comp.data.product.name, 'VIP')
  const json = comp.toJSON()
  const text = JSON.stringify(json)
  assert.ok(text.includes('VIP'))
  assert.ok(text.includes('39.90'))
  assert.ok(text.includes('原价 ¥59.90'))
  assert.ok(text.includes('a') && text.includes('b'))
})

test('PAY-MODEL originalPriceDisplay empty → "原价" line not rendered', () => {
  const product = { type: 'membership', name: 'VIP', description: 'd', priceDisplay: '39.90', durationText: '/30天', originalPriceDisplay: '', benefits: [] }
  const { comp, loadError } = renderComponent('pay-modal', { visible: true, product })
  assert.ifError(loadError)
  const text = JSON.stringify(comp.toJSON())
  assert.ok(!text.includes('原价 ¥'), 'original price must be hidden when empty')
})

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
