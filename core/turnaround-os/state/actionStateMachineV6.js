/**
 * core/turnaround-os/state/actionStateMachineV6.js
 *
 * V6 Action State Machine
 *
 * 管理 ActionExecution 的状态迁移，所有迁移必须经过合法检查。
 * 禁止在外层直接修改 execution.status。
 *
 * @version 6.0.0
 * @status CHECKPOINT_5
 */

var {
  ACTION_STATUS,
  VALID_TRANSITIONS,
  createActionExecution,
} = require('../schemas/actionContractV6')

var STATUS = ACTION_STATUS

// ═══════════════════════════════════════
// 状态迁移事件类型
// ═══════════════════════════════════════

var EVENTS = {
  START: 'START',
  COMPLETE: 'COMPLETE',
  FAIL: 'FAIL',
  BLOCK: 'BLOCK',
  UNBLOCK: 'UNBLOCK',
  SKIP: 'SKIP',
  CANCEL: 'CANCEL',
  RETRY: 'RETRY',
  FALLBACK_TRIGGER: 'FALLBACK_TRIGGER',
}

// ═══════════════════════════════════════
// transitionActionState — 唯一状态迁移入口
// ═══════════════════════════════════════

/**
 * transitionActionState
 *
 * @param {Object} params
 * @param {Object} params.execution — ActionExecution (will be mutated)
 * @param {string} params.event       — EVENTS 枚举
 * @param {Object} [params.payload]   — 事件载荷
 * @returns {{ ok: boolean, errorCode: string|null, execution: Object }}
 */
function transitionActionState(params) {
  var execution = params.execution
  var event = params.event
  var payload = params.payload || {}

  if (!execution || typeof execution !== 'object') {
    return { ok: false, errorCode: 'E_MISSING_EXECUTION', details: 'execution is null or not an object', execution: null }
  }

  if (Object.values(EVENTS).indexOf(event) < 0) {
    return { ok: false, errorCode: 'E_UNKNOWN_EVENT', details: 'Unknown event: ' + event, execution: execution }
  }

  var current = execution.status
  if (!current || !VALID_TRANSITIONS[current]) {
    return { ok: false, errorCode: 'E_INVALID_CURRENT_STATE', details: 'Invalid or missing current state: ' + current, execution: execution }
  }

  var target = eventToTarget(event, execution, payload)
  if (!target) {
    // 提供更具体的错误码
    if (event === EVENTS.RETRY && execution.status === STATUS.FAILED) {
      var max = execution.maxAttempts || 3
      var attempts = execution.attemptCount || 0
      return {
        ok: false,
        errorCode: 'E_RETRY_EXHAUSTED',
        details: 'Retry limit exceeded: ' + attempts + '/' + max + ' attempts used',
        execution: execution,
      }
    }
    if (event === EVENTS.RETRY && execution.status === STATUS.BLOCKED) {
      return {
        ok: false,
        errorCode: 'E_ILLEGAL_RETRY',
        details: 'Cannot RETRY from BLOCKED — use UNBLOCK event instead',
        execution: execution,
      }
    }
    return { ok: false, errorCode: 'E_UNMAPPABLE_EVENT', details: 'Event ' + event + ' cannot be mapped from state ' + execution.status, execution: execution }
  }

  var allowed = VALID_TRANSITIONS[current]
  var transitionIndex = allowed.indexOf(target)
  if (transitionIndex < 0) {
    return {
      ok: false,
      errorCode: 'E_ILLEGAL_TRANSITION',
      details: 'Cannot transition ' + current + ' -> ' + target + '. Allowed: ' + JSON.stringify(allowed),
      execution: execution,
    }
  }

  // 执行迁移
  applyTransition(execution, current, target, event, payload)

  return { ok: true, errorCode: null, execution: execution }
}

// ═══════════════════════════════════════
// event → target status mapping
// ═══════════════════════════════════════

function eventToTarget(event, execution, payload) {
  switch (event) {
    case EVENTS.START:             return STATUS.IN_PROGRESS
    case EVENTS.COMPLETE:          return STATUS.COMPLETED
    case EVENTS.FAIL:              return STATUS.FAILED
    case EVENTS.BLOCK:             return STATUS.BLOCKED
    case EVENTS.UNBLOCK:           return STATUS.READY
    case EVENTS.SKIP:              return STATUS.SKIPPED
    case EVENTS.CANCEL:            return STATUS.CANCELLED
    case EVENTS.RETRY:
      // RETRY: 仅允许从 FAILED / SKIPPED → READY
      if (execution.status === STATUS.FAILED) {
        // FAILED → READY 必须满足 retry 条件
        var max = execution.maxAttempts || 3
        var attempts = execution.attemptCount || 0
        if (attempts >= max) {
          return null // 超出重试上限
        }
        return STATUS.READY
      }
      if (execution.status === STATUS.SKIPPED) return STATUS.READY
      // RETRY 不可用于 BLOCKED → READY (BLOCKED 必须用 UNBLOCK)
      return null
    case EVENTS.FALLBACK_TRIGGER:
      // fallback 触发 → 根据 fallback type 决定
      var fb = payload.fallback
      if (!fb || !fb.type) return STATUS.READY
      if (fb.type === 'ALTERNATE_ACTION' || fb.type === 'REGENERATE') return STATUS.SKIPPED
      if (fb.type === 'REASSESS') return STATUS.BLOCKED
      return STATUS.READY // RETRY default
    default:
      return null
  }
}

// ═══════════════════════════════════════
// transition application
// ═══════════════════════════════════════

function applyTransition(execution, from, to, event, payload) {
  execution.status = to

  switch (to) {
    case STATUS.IN_PROGRESS:
      execution.startedAt = payload.timestamp || null
      execution.attemptCount = (execution.attemptCount || 0) + 1
      execution.progress = 10
      break

    case STATUS.COMPLETED:
      execution.completedAt = payload.timestamp || null
      execution.progress = 100
      if (payload.proof) {
        var proof = execution.submittedProof || []
        execution.submittedProof = proof.concat(
          Array.isArray(payload.proof) ? payload.proof : [payload.proof]
        )
      }
      break

    case STATUS.FAILED:
      execution.lastFailureReason = payload.reason || 'unknown'
      // 检查是否超过最大尝试次数
      if (execution.attemptCount >= (execution.maxAttempts || 3)) {
        execution.nextEligibleAt = null
      } else {
        execution.nextEligibleAt = payload.retryAfter || null
      }
      break

    case STATUS.BLOCKED:
      execution.lastFailureReason = payload.reason || 'blocked_by_dependency'
      break

    case STATUS.READY:
      // 从 BLOCKED/FAILED 恢复
      if (from === STATUS.BLOCKED) {
        execution.lastFailureReason = null
      }
      if (from === STATUS.FAILED) {
        execution.nextEligibleAt = null
      }
      break

    case STATUS.SKIPPED:
      execution.lastFailureReason = payload.reason || 'skipped'
      break

    case STATUS.CANCELLED:
      execution.lastFailureReason = payload.reason || 'cancelled'
      execution.progress = 0
      break

    default:
      break
  }
}

// ═══════════════════════════════════════
// 批量迁移辅助
// ═══════════════════════════════════════

/**
 * canTransition — 检查是否合法（不执行）
 */
function canTransition(execution, event) {
  var result = transitionActionState({
    execution: JSON.parse(JSON.stringify(execution)),
    event: event,
  })
  return result.ok
}

/**
 * getAllowedTransitions — 获取当前状态可用的目标状态列表
 */
function getAllowedTransitions(execution) {
  if (!execution || !execution.status) return []
  var current = execution.status
  return (VALID_TRANSITIONS[current] || []).slice()
}

module.exports = {
  EVENTS,
  transitionActionState,
  canTransition,
  getAllowedTransitions,
}
