/**
 * common/circuitBreaker.js — AI 调用熔断器
 *
 * 防止 LLM API 持续错误打爆系统。
 * 三态: CLOSED (正常) → OPEN (熔断) → HALF_OPEN (探活)
 *
 * 配置:
 *   failThreshold = 5    → 5次连续失败触发熔断
 *   recoveryTimeout = 30s → 30秒后进入半开
 *   halfOpenRequests = 3 → 半开允许3次试探请求
 *
 * 使用:
 *   const breaker = getCircuitBreaker('deepseek-pro')
 *   const result = await breaker.call(async () => await callAI(...))
 *   if (result.rejected) { /* 熔断中,使用降级响应 * / }
 */

const now = () => Date.now()

// ═══════════════════════════════════════
// Configuration
// ═══════════════════════════════════════

const DEFAULT_CONFIG = {
  failThreshold: 5,        // 连续失败几次触发熔断
  recoveryTimeout: 30000,  // 熔断后多久进入半开 (ms)
  halfOpenRequests: 3,     // 半开允许通过多少请求
  windowMs: 60000,         // 滑动窗口 (60s)
}

// ═══════════════════════════════════════
// Circuit Breaker States
// ═══════════════════════════════════════

const STATE = {
  CLOSED: 'CLOSED',           // 正常
  OPEN: 'OPEN',              // 熔断
  HALF_OPEN: 'HALF_OPEN',   // 探活
}

class CircuitBreaker {
  constructor(name, config = {}) {
    this.name = name
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.state = STATE.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.lastFailureTime = 0
    this.openedAt = 0
    this.totalFailures = 0
    this.totalSuccesses = 0
    this.halfOpenPassed = 0
  }

  /**
   * 执行受保护的调用
   * @param {Function} fn - 异步函数
   * @param {Function} fallback - 降级函数 (可选)
   * @returns {{ rejected:boolean, result:any, breakerState:string }}
   */
  async call(fn, fallback = null) {
    // 熔断中 → 检查是否可以进入半开
    if (this.state === STATE.OPEN) {
      const elapsed = now() - this.openedAt
      if (elapsed >= this.config.recoveryTimeout) {
        this.state = STATE.HALF_OPEN
        this.halfOpenPassed = 0
        console.log(`[CircuitBreaker:${this.name}] ⚡ OPEN → HALF_OPEN (${elapsed}ms elapsed)`)
      } else {
        // 仍在熔断
        console.warn(`[CircuitBreaker:${this.name}] 🔴 熔断中, ${Math.ceil((this.config.recoveryTimeout - elapsed)/1000)}s 后尝试恢复`)
        if (fallback) {
          try { return { rejected: true, result: await fallback(), breakerState: this.state, fallback: true } }
          catch (_) { return { rejected: true, result: null, breakerState: this.state, fallback: true, error: '熔断中,降级也失败' } }
        }
        return { rejected: true, result: null, breakerState: this.state, error: '服务暂时不可用，请稍后再试' }
      }
    }

    // 半开 → 限制请求数
    if (this.state === STATE.HALF_OPEN && this.halfOpenPassed >= this.config.halfOpenRequests) {
      console.warn(`[CircuitBreaker:${this.name}] 🟡 半开请求配额耗尽 (${this.halfOpenPassed}/${this.config.halfOpenRequests})`)
      if (fallback) {
        try { return { rejected: true, result: await fallback(), breakerState: this.state, fallback: true } }
        catch (_) { return { rejected: true, result: null, breakerState: this.state, fallback: true } }
      }
      return { rejected: true, result: null, breakerState: this.state, error: '服务恢复中，请稍后再试' }
    }

    // 执行实际调用
    try {
      const result = await fn()
      this.onSuccess()
      return { rejected: false, result, breakerState: this.state }
    } catch (err) {
      this.onFailure(err)
      // 如果刚刚触发熔断，尝试 fallback
      if (this.state === STATE.OPEN && fallback) {
        try { return { rejected: true, result: await fallback(), breakerState: this.state, fallback: true, error: err.message } }
        catch (_) { return { rejected: true, result: null, breakerState: this.state, fallback: true, error: err.message } }
      }
      return { rejected: this.state === STATE.OPEN, result: null, breakerState: this.state, error: err.message }
    }
  }

  /**
   * 调用成功
   */
  onSuccess() {
    this.totalSuccesses++

    if (this.state === STATE.HALF_OPEN) {
      this.halfOpenPassed++
      if (this.halfOpenPassed >= this.config.halfOpenRequests) {
        // 半开请求全部成功 → 恢复
        this.state = STATE.CLOSED
        this.failureCount = 0
        console.log(`[CircuitBreaker:${this.name}] ✅ HALF_OPEN → CLOSED (恢复)`)
      }
    }

    if (this.state === STATE.CLOSED) {
      this.failureCount = 0  // 成功后重置失败计数
    }
  }

  /**
   * 调用失败
   */
  onFailure(err) {
    this.totalFailures++
    this.lastFailureTime = now()

    if (this.state === STATE.HALF_OPEN) {
      // 半开失败 → 立即重新熔断
      this.state = STATE.OPEN
      this.openedAt = now()
      console.error(`[CircuitBreaker:${this.name}] 🔴 HALF_OPEN → OPEN (半开请求失败: ${err.message?.slice(0,60)})`)
      return
    }

    this.failureCount++

    if (this.failureCount >= this.config.failThreshold) {
      this.state = STATE.OPEN
      this.openedAt = now()
      console.error(`[CircuitBreaker:${this.name}] 🔴 CLOSED → OPEN (连续 ${this.failureCount} 次失败: ${err.message?.slice(0,60)})`)
    }
  }

  /**
   * 手动重置
   */
  reset() {
    this.state = STATE.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.halfOpenPassed = 0
    console.log(`[CircuitBreaker:${this.name}] 🔄 手动重置 → CLOSED`)
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      openedAt: this.openedAt,
      lastFailureTime: this.lastFailureTime,
      remainingRecoveryMs: this.state === STATE.OPEN
        ? Math.max(0, this.config.recoveryTimeout - (now() - this.openedAt))
        : 0,
    }
  }
}

// ═══════════════════════════════════════
// Breaker Registry — 按模型分组
// ═══════════════════════════════════════

const breakers = new Map()

/**
 * 获取或创建熔断器
 * @param {string} name - 通常是模型名 (如 'deepseek-pro')
 */
function getCircuitBreaker(name = 'default') {
  if (!breakers.has(name)) {
    breakers.set(name, new CircuitBreaker(name))
  }
  return breakers.get(name)
}

/**
 * 获取所有熔断器状态
 */
function getAllBreakerStatus() {
  const status = {}
  for (const [name, breaker] of breakers) {
    status[name] = breaker.getStatus()
  }
  return status
}

/**
 * 重置所有熔断器
 */
function resetAll() {
  for (const breaker of breakers.values()) {
    breaker.reset()
  }
}

module.exports = {
  CircuitBreaker,
  getCircuitBreaker,
  getAllBreakerStatus,
  resetAll,
  STATE,
}
