/**
 * cloudfunctions/runEvolutionCycle/index.js
 * 进化周期云函数 — 可由定时触发器调用
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const { runEvolutionCycle } = require('./lib/evolutionEngine.js')

exports.main = async (event) => {
  try {
    return await runEvolutionCycle(event)
  } catch (e) {
    return { code: -1, message: e.message }
  }
}
