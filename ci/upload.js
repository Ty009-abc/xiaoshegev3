#!/usr/bin/env node
/**
 * ci/upload.js — 珠澳小事哥 v3.0 CI 2.0 上传脚本
 *
 * 安全原则：
 *   - 密钥路径从环境变量 WX_PRIVATE_KEY_PATH 读取
 *   - AppID 从环境变量 WX_APPID 读取
 *   - 绝不硬编码任何私密信息
 *
 * 使用方式：
 *   source .env.ci
 *   node ci/upload.js                          # 默认：开发版
 *   node ci/upload.js --preview                # 预览版（生成二维码）
 *   node ci/upload.js --experience             # 体验版
 *   node ci/upload.js --experience --ver 6.5.1 --desc "fix: footer"
 */

const ci = require('miniprogram-ci');
const path = require('path');
const fs = require('fs');

// ═══════════════ 环境变量读取（安全） ═══════════════
const PROJECT_PATH = path.resolve(__dirname, '..');
const APPID = process.env.WX_APPID;
const PRIVATE_KEY_PATH = process.env.WX_PRIVATE_KEY_PATH;

if (!APPID) {
  console.error('\n❌ 缺少环境变量 WX_APPID');
  console.error('   请执行: source .env.ci\n');
  process.exit(1);
}
if (!PRIVATE_KEY_PATH) {
  console.error('\n❌ 缺少环境变量 WX_PRIVATE_KEY_PATH');
  console.error('   请执行: source .env.ci\n');
  process.exit(1);
}
if (!fs.existsSync(PRIVATE_KEY_PATH)) {
  console.error(`\n❌ 私钥文件不存在: ${PRIVATE_KEY_PATH}`);
  console.error('   请检查 WX_PRIVATE_KEY_PATH 是否正确\n');
  process.exit(1);
}

// ═══════════════ 参数解析 ═══════════════
const DATE = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const DEFAULT_VERSION = `${DATE.slice(0,4)}.${DATE.slice(4,6)}.${DATE.slice(6,8)}`;

const args = process.argv.slice(2);
const VERSION_PREFIX = process.env.WX_VERSION_PREFIX || '';
const opts = {
  experience: args.includes('--experience'),
  preview:    args.includes('--preview'),
  dev:        args.includes('--dev'),
  ver:        (() => {
    const i = args.indexOf('--ver');
    if (i !== -1 && args[i + 1]) return args[i + 1];
    const prefix = VERSION_PREFIX ? VERSION_PREFIX + '.' : '';
    return prefix + DEFAULT_VERSION;
  })(),
  desc:       (() => {
    const i = args.indexOf('--desc');
    if (i !== -1 && args[i + 1]) return args[i + 1];
    return process.env.WX_DEFAULT_DESC
      || `CI 自动上传 - ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
  })(),
};

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
    'ci/**/*',
    '.env.ci*',
    'private*.key',
    'world_rules_import.json',
    'cloudfunctions/**/*',
    'backup/**/*',
    'miniprogram_npm/**/*',
    'tests/**/*',
    'scripts/**/*',
    '.audit-reports/**/*',
  ],
});

// ═══════════════ 核心逻辑 ═══════════════
async function main() {
  const mode = opts.preview ? '预览(Preview)' : opts.experience ? '体验版(Experience)' : '开发版(Dev)';

  console.log(`\n🚀 珠澳小事哥 CI 2.0 上传`);
  console.log(`   模式:   ${mode}`);
  console.log(`   版本:   ${opts.ver}`);
  console.log(`   描述:   ${opts.desc}`);
  console.log(`   AppID:  ${APPID}`);
  console.log(`   项目:   ${PROJECT_PATH}\n`);

  try {
    if (opts.preview) {
      const qrPath = path.join(PROJECT_PATH, `preview-${new Date().toISOString().replace(/[:.]/g, '-')}.png`);
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
        qrcodeOutputDest: qrPath,
        onProgressUpdate: (task) => {
          if (task.status === 'done') console.log(`  ✅ ${task._msg || '完成'}`);
          else if (task._msg) console.log(`  ⏳ ${task._msg}`);
        },
      });

      console.log(`\n✅ 预览二维码已生成`);
      console.log(`   文件: ${qrPath}`);
      console.log(`   有效时间: 约 25 分钟\n`);
      console.log(`   📱 扫码即可预览\n`);

    } else {
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
          if (task.status === 'done') console.log(`  ✅ ${task._msg || '完成'}`);
          else if (task._msg) console.log(`  ⏳ ${task._msg}`);
        },
      });

      console.log(`\n✅ 上传成功!`);
      console.log(`   版本号: ${opts.ver}`);

      if (opts.experience) {
        console.log(`\n📱 设为体验版:`);
        console.log(`   1. 打开 https://mp.weixin.qq.com`);
        console.log(`   2. 进入「管理」→「版本管理」`);
        console.log(`   3. 找到版本 ${opts.ver}，点击「选为体验版」`);
      } else {
        console.log(`\n📱 预览方式:`);
        console.log(`   微信开发者工具 →「版本管理」→ 扫码预览\n`);
      }
    }

  } catch (err) {
    console.error(`\n❌ 上传失败: ${err.message}`);
    if (err.code === 10006) {
      console.error('   → private.key 无效或已过期，请重新生成密钥');
    }
    process.exit(1);
  }
}

main();
