#!/usr/bin/env node
/**
 * upload-ci.js — 珠澳小事哥 v3.0 自动化构建上传
 * 
 * 用途：将小程序源码上传到微信后台作为体验版/开发版
 * 
 * ===== 一、前置条件（仅需操作一次） =====
 * 
 * 1. 在微信小程序后台生成 CI 上传密钥：
 *    登录 https://mp.weixin.qq.com
 *    → 左侧菜单「开发管理」→「开发设置」
 *    → 滚动到「小程序代码上传密钥」→ 点击「生成」
 *    → 下载 private.xxxxxxxx.key 文件
 *    → 放到本项目的 private.key（已在 .gitignore 中排除，不会提交）
 * 
 * 2. 在微信小程序后台添加 CI 白名单 IP（非必须，但推荐）：
 *    同样在「开发设置」→「小程序代码上传密钥」下方
 *    →「IP 白名单」添加本服务器的出口 IP
 * 
 * ===== 二、使用方式 =====
 * 
 *   # 上传开发版（默认，仅上传者可扫码预览）
 *   node upload-ci.js
 * 
 *   # 上传体验版（上传后设为体验版，可用于查看链接分享）
 *   node upload-ci.js --experience
 * 
 *   # 指定版本号与描述
 *   node upload-ci.js --ver 3.0.1 --desc "修复首页白屏"
 * 
 *   # 上传开发版 + 自定义版本号
 *   node upload-ci.js --dev --ver 3.0.1-dev
 * 
 *   # 预览模式（生成本地二维码，不占用上传次数）
 *   node upload-ci.js --preview
 * 
 * ===== 三、在 OpenClaw 中给 009 发指令即可 =====
 * 
 *   「009，上传体验版 v3.6.1，备注：修复诊断报告JSON清洗」
 * 
 *   009 会自动执行：node upload-ci.js --experience --ver 3.6.1 --desc "修复诊断报告JSON清洗"
 */

const ci = require('miniprogram-ci')
const path = require('path')
const fs = require('fs')

// ═══════════════ 配置区 ═══════════════
const PROJECT_PATH = path.resolve(__dirname)
const APPID = 'wxd441fbf3b9f10aa3'
const PRIVATE_KEY_PATH = path.join(PROJECT_PATH, 'private.key')

// 默认版本号格式: 年月日.序号 (如 20260702.1)
const DATE = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const DEFAULT_VERSION = `${DATE.slice(0,4)}.${DATE.slice(4,6)}.${DATE.slice(6,8)}`

// ═══════════════ 参数解析 ═══════════════
const args = process.argv.slice(2)
const opts = {
  experience: args.includes('--experience'),
  preview:    args.includes('--preview'),
  dev:        args.includes('--dev'),
  ver:        args.find((_, i) => args[i] === '--ver' && args[i + 1] ? (() => true)() : false)
                ? args[args.indexOf('--ver') + 1] : DEFAULT_VERSION,
  desc:       args.find((_, i) => args[i] === '--desc' && args[i + 1] ? (() => true)() : false)
                ? args[args.indexOf('--desc') + 1] : `CI 自动上传 - ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
}

// ═══════════════ 前置检查 ═══════════════
if (!fs.existsSync(PRIVATE_KEY_PATH)) {
  console.error(
    '\n❌ 缺少上传密钥文件: private.key\n'
    + '\n请按以下步骤获取：\n'
    + '  1. 登录 https://mp.weixin.qq.com\n'
    + '  2. 左侧菜单「开发管理」→「开发设置」\n'
    + '  3. 滚动到「小程序代码上传密钥」→ 点击「生成」\n'
    + '  4. 下载密钥文件，改名为 private.key 放到本目录\n'
    + '\n⚠️  private.key 已在 .gitignore 中排除，不会被提交到 Git。\n'
  )
  process.exit(1)
}

// ═══════════════ 创建项目实例 ═══════════════
const project = new ci.Project({
  appid: APPID,
  type: 'miniProgram',
  projectPath: PROJECT_PATH,
  privateKeyPath: PRIVATE_KEY_PATH,
  ignores: [
    'node_modules/**/*',
    '.git/**/*',
    '*.md',
    '.DS_Store',
    'upload-ci.js',
    'private.key',
    'world_rules_import.json',
    'cloudfunctions/**/*',
  ],
})

// ═══════════════ 核心逻辑 ═══════════════
async function main() {
  const mode = opts.preview
    ? '预览'
    : opts.experience
      ? '体验版'
      : '开发版'

  console.log(`\n🚀 珠澳小事哥 v3.0 CI 上传`)
  console.log(`   模式: ${mode}`)
  console.log(`   版本: ${opts.ver}`)
  console.log(`   描述: ${opts.desc}`)
  console.log(`   AppID: ${APPID}\n`)

  try {
    if (opts.preview) {
      // ── 预览模式：生成二维码图片 ──
      console.log('📦 正在打包...')
      const previewResult = await ci.preview({
        project,
        version: opts.ver,
        desc: opts.desc,
        setting: {
          es6: true,
          es7: true,
          minify: true,
          autoPrefixWXSS: true,
        },
        qrcodeFormat: 'image',
        qrcodeOutputDest: path.join(PROJECT_PATH, 'preview-qrcode.png'),
        onProgressUpdate: (task) => {
          if (task.status === 'done') {
            console.log(`  ✅ ${task._msg || '打包完成'}`)
          } else if (task._msg) {
            console.log(`  ⏳ ${task._msg}`)
          }
        },
      })

      console.log(`\n✅ 预览二维码已生成: preview-qrcode.png\n`)
      console.log(`   扫码即可预览，有效时间约 25 分钟。\n`)

    } else {
      // ── 上传模式（开发版 / 体验版）──
      console.log('📦 正在打包上传...')

      const uploadResult = await ci.upload({
        project,
        version: opts.ver,
        desc: opts.desc,
        setting: {
          es6: true,
          es7: true,
          minify: true,
          autoPrefixWXSS: true,
        },
        onProgressUpdate: (task) => {
          if (task.status === 'done') {
            console.log(`  ✅ ${task._msg || '上传完成'}`)
          } else if (task._msg) {
            console.log(`  ⏳ ${task._msg}`)
          }
        },
      })

      console.log(`\n✅ 上传成功!`)
      console.log(`   版本号: ${opts.ver}`)
      console.log(`   大小:   ${(uploadResult.subPackageInfo?.reduce((s, p) => s + (p.size || 0), 0) / 1024 || 0).toFixed(1)} KB`)

      if (opts.experience) {
        console.log(`\n📱 设为体验版：`)
        console.log(`   1. 打开 https://mp.weixin.qq.com`)
        console.log(`   2. 进入「管理」→「版本管理」`)
        console.log(`   3. 找到版本 ${opts.ver}，点击「选为体验版」`)
        console.log(`   4. 扫码或复制链接分发给测试人员`)
      } else {
        console.log(`\n📱 预览方式：`)
        console.log(`   在微信开发者工具中 →「版本管理」→ 找到此版本 → 扫码预览\n`)
      }
    }

  } catch (err) {
    console.error(`\n❌ 上传失败: ${err.message}`)
    if (err.code === 10006) {
      console.error('   → 可能是 private.key 无效或已过期，请重新生成密钥')
    }
    if (err.message.includes('ENOENT')) {
      console.error('   → 文件路径错误，请检查 PROJECT_PATH 和 PRIVATE_KEY_PATH')
    }
    process.exit(1)
  }
}

main()
