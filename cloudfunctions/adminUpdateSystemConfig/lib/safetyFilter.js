/**
 * common/safetyFilter.js - 安全过滤器
 *
 * 防止 AI 输出：赌博建议、非法套利、灰产路径、金融承诺
 */

const BLOCK_PATTERNS = [
  // 非法金融
  { pattern: /内幕交易/g,         replacement: '合规信息' },
  { pattern: /洗钱/g,             replacement: '资金管理' },
  { pattern: /非法集资/g,         replacement: '合规集资' },
  { pattern: /传销/g,             replacement: '直销' },

  // 赌博相关
  { pattern: /套利漏洞/g,         replacement: '该内容不予提供' },
  { pattern: /赌场漏洞/g,         replacement: '该内容不予提供' },
  { pattern: /稳赢策略/g,         replacement: '该内容不予提供' },
  { pattern: /包赢/g,             replacement: '风险提示：不存在稳赢' },
  { pattern: /必赚/g,             replacement: '风险提示：不存在必赚' },
  { pattern: /稳赚不赔/g,         replacement: '风险提示：投资有风险' },

  // 灰产
  { pattern: /刷单/g,             replacement: '该操作可能违规' },
  { pattern: /薅羊毛漏洞/g,       replacement: '该内容不予提供' },
  { pattern: /灰色收入/g,         replacement: '合法收入' },
  { pattern: /黑产/g,             replacement: '该内容不予提供' },

  // 金融承诺
  { pattern: /保证赚钱/g,         replacement: '无法保证收益' },
  { pattern: /月入.*万/g,         replacement: '收入受多种因素影响' },
  { pattern: /年化.*保证/g,       replacement: '收益不保证' },
  { pattern: /无风险.*收益/g,     replacement: '投资存在风险' },
  { pattern: /绝对安全/g,         replacement: '不存在绝对安全' },

  // 敏感
  { pattern: /银行卡.*出售/g,     replacement: '该行为违法' },
  { pattern: /身份.*代持/g,       replacement: '该内容不予提供' },
  { pattern: /避税.*漏洞/g,       replacement: '请依法纳税' },
]

// 额外的强制拦截词（整个响应都不允许出现）
const BLOCK_ENTIRE_RESPONSE = [
  '如何制造',
  '破解方法',
  '绕过监管',
  '跑分平台',
  '现金贷',
]

/**
 * 过滤单段文本
 * @param {string} text
 * @returns {{ safe: boolean, filtered: string, blocked: boolean }}
 */
function filterText(text) {
  if (!text || typeof text !== 'string') return { safe: true, filtered: text || '', blocked: false }

  let filtered = text
  let blocked = false

  for (const rule of BLOCK_PATTERNS) {
    if (rule.pattern.test(filtered)) {
      filtered = filtered.replace(rule.pattern, rule.replacement)
      if (rule.replacement === '该内容不予提供') {
        blocked = true
      }
    }
  }

  // 检查是否触发整条响应拦截
  for (const word of BLOCK_ENTIRE_RESPONSE) {
    if (filtered.includes(word)) {
      return { safe: false, filtered: '该内容不予提供。', blocked: true }
    }
  }

  return { safe: true, filtered, blocked }
}

/**
 * 过滤整个响应对象（处理 content 对象和纯文本）
 * @param {object|string} response - AI 返回的原始内容
 * @returns {{ safe: boolean, output: object|string, flagged: boolean }}
 */
function safetyFilter(response) {
  if (typeof response === 'string') {
    const result = filterText(response)
    return {
      safe: result.safe,
      output: result.filtered,
      flagged: !result.safe || result.blocked,
    }
  }

  if (response && typeof response === 'object') {
    let flagged = false
    const output = {}

    for (const [key, value] of Object.entries(response)) {
      if (typeof value === 'string') {
        const result = filterText(value)
        output[key] = result.filtered
        if (result.blocked) flagged = true
      } else if (Array.isArray(value)) {
        output[key] = value.map(v => {
          if (typeof v === 'string') {
            const r = filterText(v)
            if (r.blocked) flagged = true
            return r.filtered
          }
          return v
        })
      } else {
        output[key] = value
      }
    }

    return { safe: true, output, flagged }
  }

  return { safe: true, output: response, flagged: false }
}

module.exports = { filterText, safetyFilter, BLOCK_PATTERNS, BLOCK_ENTIRE_RESPONSE }
