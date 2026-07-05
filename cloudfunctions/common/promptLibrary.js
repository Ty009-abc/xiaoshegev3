/**
 * common/promptLibrary.js — Prompt 库注册中心
 *
 * 四册 Part 2：Prompt Library
 *
 * 职责：
 *   1. 加载 Prompt 模块（knowledge/prompts/ 目录）
 *   2. 变量注入（{{variable}} 模板引擎）
 *   3. buildPrompt() — 组装 SYSTEM_CORE + Scene Prompt + Variables
 *   4. 版本管理（每个 Prompt 带 version 字段）
 *
 * Prompt 构造公式：
 *   Final = SYSTEM_CORE + Scene Prompt + Variables + Context + Output Rules
 */

const SYSTEM_CORE = require('../../knowledge/prompts/system/SYSTEM_CORE.js')
const CHAT_V1 = require('../../knowledge/prompts/chat/CHAT_V1.js')
const REPORT_V1 = require('../../knowledge/prompts/report/REPORT_V1.js')
const CHALLENGE_V1 = require('../../knowledge/prompts/challenge/CHALLENGE_V1.js')
const INSIGHT_V1 = require('../../knowledge/prompts/insight/INSIGHT_V1.js')
const COACHING_V1 = require('../../knowledge/prompts/coaching/COACHING_V1.js')
const ADMIN_V1 = require('../../knowledge/prompts/admin/ADMIN_V1.js')

// ═══════════════════════════════════════
// 1. Prompt Registry（带版本号）
// ═══════════════════════════════════════
const PROMPT_REGISTRY = {
  SYSTEM_CORE,
  CHAT_V1,
  REPORT_V1,
  CHALLENGE_V1,
  INSIGHT_V1,
  COACHING_V1,
  ADMIN_V1,
}

// 场景 → Prompt 映射
const SCENE_TO_PROMPT = {
  ai_chat:              { key: 'CHAT_V1',      version: 'v1' },
  daily_insight:        { key: 'INSIGHT_V1',   version: 'v1' },
  report_generation:    { key: 'REPORT_V1',    version: 'v1' },
  world_model_analysis: { key: 'CHAT_V1',      version: 'v1' },
  challenge_summary:    { key: 'CHALLENGE_V1', version: 'v1' },
  coaching:             { key: 'COACHING_V1',  version: 'v1' },
  admin_analysis:       { key: 'ADMIN_V1',     version: 'v1' },
}

// ═══════════════════════════════════════
// 2. 变量注入引擎
// ═══════════════════════════════════════

/**
 * injectVariables(template, vars)
 * 支持两种注入语法：
 *   {{variable}}         — 直接替换
 *   {{#if variable}}...{{/if}}  — 条件块（支持嵌套）
 *
 * @param {string} template - 带 {{}} 占位符的模板
 * @param {object} vars     - 键值对
 * @returns {string} 替换后的字符串
 */
function injectVariables(template, vars = {}) {
  let result = template

  // 1. 处理 {{#if variable}}...{{/if}} 条件块（支持嵌套）
  result = _resolveIfBlocks(result, vars)

  // 2. 处理 {{variable}} 占位符
  result = result.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
    const value = vars[varName]
    if (value === undefined || value === null) return ''
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  })

  return result
}

/**
 * _resolveIfBlocks — 解析嵌套 {{#if}}...{{/if}} 条件块
 * 使用栈匹配平衡的 if/endif 对
 */
function _resolveIfBlocks(text, vars) {
  let out = ''
  let i = 0

  while (i < text.length) {
    const ifIdx = text.indexOf('{{#if ', i)
    if (ifIdx === -1) { out += text.slice(i); break }

    out += text.slice(i, ifIdx)

    // 解析变量名
    const varEnd = text.indexOf('}}', ifIdx + 6)
    if (varEnd === -1) { out += text.slice(ifIdx); break }
    const varName = text.slice(ifIdx + 6, varEnd).trim()

    // 找匹配的 {{/if}}，考虑嵌套
    let depth = 1
    let searchFrom = varEnd + 2
    while (depth > 0 && searchFrom < text.length) {
      const nextOpen = text.indexOf('{{#if ', searchFrom)
      const nextClose = text.indexOf('{{/if}}', searchFrom)

      if (nextClose === -1) break // 没找到闭合，放弃

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++
        searchFrom = nextOpen + 1
      } else {
        depth--
        if (depth === 0) {
          const content = text.slice(varEnd + 2, nextClose)
          const value = vars[varName]
          if (Array.isArray(value) ? value.length > 0 : !!value) {
            out += _resolveIfBlocks(content, vars)
          }
          i = nextClose + 7
          break
        }
        searchFrom = nextClose + 7
      }
    }

    if (depth > 0) { out += text.slice(ifIdx); break }
  }

  return out
}

// ═══════════════════════════════════════
// 3. Prompt 加载
// ═══════════════════════════════════════

/**
 * loadPrompt(key) — 加载指定 Prompt 模块
 * @param {string} key - 注册表中的 key（如 'CHAT_V1'）
 * @returns {{ name, version, prompt }} Prompt 模块
 */
function loadPrompt(key) {
  const loaded = PROMPT_REGISTRY[key]
  if (!loaded) throw new Error(`Prompt not found: ${key}`)
  return {
    name: loaded.name,
    version: loaded.version,
    prompt: loaded.prompt,
    variables: loaded.variables || [],
  }
}

/**
 * loadPromptByScene(scene) — 按场景加载 Prompt
 * @param {string} scene - SCENES 场景名
 * @returns {{ name, version, prompt }} Prompt 模块
 */
function loadPromptByScene(scene) {
  const mapping = SCENE_TO_PROMPT[scene]
  if (!mapping) return loadPrompt('CHAT_V1')
  return loadPrompt(mapping.key)
}

// ═══════════════════════════════════════
// 4. buildPrompt — 组装最终 Prompt
// ═══════════════════════════════════════

/**
 * buildPrompt(scene, userInput, options)
 * 
 * 组装公式：
 *   SYSTEM_CORE (注入) + Scene Prompt (注入) + Context + User Input + Output Rules
 *
 * @param {string} scene      - AI 场景
 * @param {string} userInput  - 用户输入/消息
 * @param {object} options    - { context?, variables?, extraRules? }
 * @returns {{ systemPrompt: string, userMessage: string, promptVersion: string }}
 */
function buildPrompt(scene, userInput, options = {}) {
  const { context, variables = {}, extraRules = '' } = options

  // 1. 加载场景 Prompt
  let scenePrompt, promptVersion
  try {
    const loaded = loadPromptByScene(scene)
    scenePrompt = loaded.prompt
    promptVersion = loaded.version || 'v?'
  } catch (_) {
    scenePrompt = PROMPT_REGISTRY.CHAT_V1.prompt
    promptVersion = 'v1'
  }

  // 2. 注入 SYSTEM_CORE
  const systemPromptWithCore = scenePrompt.replace('{{SYSTEM_CORE}}', SYSTEM_CORE.prompt)

  // 3. 注入变量
  const finalSystemPrompt = injectVariables(systemPromptWithCore, variables)

  // 4. 组装 user message
  let userMessage = userInput || ''
  if (context) {
    userMessage += `\n\n【用户上下文】\n${typeof context === 'string' ? context : JSON.stringify(context, null, 2)}`
  }
  if (extraRules) {
    userMessage += `\n\n【附加规则】\n${extraRules}`
  }

  return { systemPrompt: finalSystemPrompt, userMessage, promptVersion }
}

// ═══════════════════════════════════════
// 5. 获取 Prompt 元信息
// ═══════════════════════════════════════

/**
 * getPromptVersion(scene) — 获取场景当前使用的 Prompt 版本
 */
function getPromptVersion(scene) {
  const mapping = SCENE_TO_PROMPT[scene]
  if (!mapping) return 'v?'
  const p = PROMPT_REGISTRY[mapping.key]
  return p ? p.version : 'v?'
}

/**
 * listPrompts() — 列出所有已注册 Prompt
 */
function listPrompts() {
  return Object.entries(PROMPT_REGISTRY).map(([key, p]) => ({
    key,
    name: p.name,
    version: p.version,
    description: p.description,
    variables: p.variables || [],
  }))
}

/**
 * validatePrompt(key) — 校验 Prompt 是否包含必需的基座引用
 */
function validatePrompt(key) {
  const p = PROMPT_REGISTRY[key]
  if (!p) return { valid: false, error: `Prompt not found: ${key}` }

  const issues = []

  // SYSTEM_CORE 是基座本身，不需要引用自己
  if (key !== 'SYSTEM_CORE' && !p.prompt.includes('{{SYSTEM_CORE}}')) {
    issues.push('Prompt 未引用 {{SYSTEM_CORE}} — 人格底座缺失')
  }

  // 检查不合法内容（仅在非禁止上下文中检查）
  // SYSTEM_CORE 中的"鸡汤""兄弟""老铁""灰产"等词出现在禁止声明中，放行
  const dangerousPatterns = [
    { word: '财富自由', desc: '财富承诺' },
    { word: '暴富', desc: '财富承诺' },
    { word: '日赚', desc: '财富承诺' },
    { word: '稳赚', desc: '财富承诺' },
  ]
  for (const { word, desc } of dangerousPatterns) {
    // 只在非禁止/非说明上下文中检查
    const lines = p.prompt.split('\n')
    for (const line of lines) {
      if (line.includes(word) && !line.includes('禁止') && !line.includes('不要') && !line.includes('不')) {
        issues.push(`Prompt 包含 ${desc}: "${word}"`)
        break
      }
    }
  }

  return { valid: issues.length === 0, issues }
}

module.exports = {
  // Registry
  PROMPT_REGISTRY,
  SCENE_TO_PROMPT,

  // Core API
  loadPrompt,
  loadPromptByScene,
  buildPrompt,
  injectVariables,

  // Meta
  getPromptVersion,
  listPrompts,
  validatePrompt,
}
