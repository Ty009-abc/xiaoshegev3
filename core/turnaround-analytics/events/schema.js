/**
 * core/turnaround-analytics/events/schema.js
 *
 * V6.5 Gate A — 统一事件模型
 *
 * 所有事件遵循此 Schema。
 *
 * @version 6.5.0
 */

const EVENT_CATEGORIES = [
  'SESSION',
  'NAVIGATION',
  'QUESTIONNAIRE',
  'AI_GENERATION',
  'CARD_VIEW',
  'CARD_INTERACTION',
  'SHARING',
  'PAYMENT',
  'FEEDBACK',
  'SYSTEM',
]

const EVENT_META_KEYS = [
  'eventId',
  'userId',
  'sessionId',
  'timestamp',
  'duration',
  'metadata',
]

function createEvent({ eventId, userId, sessionId, category, action, timestamp, duration, metadata }) {
  if (!eventId) throw new Error('Event: eventId required')
  if (!userId) throw new Error('Event: userId required')
  if (!sessionId) throw new Error('Event: sessionId required')
  if (!category || !EVENT_CATEGORIES.includes(category)) throw new Error(`Event: invalid category "${category}"`)
  if (!action) throw new Error('Event: action required')
  if (!timestamp) throw new Error('Event: timestamp required')

  return Object.freeze({
    eventId,
    userId,
    sessionId,
    category,
    action,
    timestamp: typeof timestamp === 'number' ? new Date(timestamp).toISOString() : timestamp,
    duration: duration || 0,
    metadata: metadata ? Object.freeze({ ...metadata }) : Object.freeze({}),
    version: '6.5.0',
  })
}

module.exports = { createEvent, EVENT_CATEGORIES, EVENT_META_KEYS }
