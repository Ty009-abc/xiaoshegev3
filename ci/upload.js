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
 *   node ci/upload.js --preview                  # 预览版（生成二维码）
 *   node ci/upload.js --upload --ver 6.5.1 --desc "fix: footer"  # 上传
 */

const ci = require('miniprogram-ci');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

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
  console.error('\n❌ 私钥文件不存在');
  console.error('   请检查 WX_PRIVATE_KEY_PATH 是否正确\n');
  process.exit(1);
}

// ═══════════════ Git 上下文 ═══════════════
function git(cmd) {
  try { return execSync(`git ${cmd}`, { cwd: PROJECT_PATH, encoding: 'utf8' }).trim(); }
  catch { return 'unknown'; }
}
const BRANCH = git('branch --show-current') || 'detached';
const COMMIT = git('rev-parse --short HEAD');
const APPID_MASKED = APPID.slice(0, 4) + '****' + APPID.slice(-4);

// ═══════════════ 参数解析 ═══════════════
const DATE = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const DEFAULT_VERSION = `${DATE.slice(0,4)}.${DATE.slice(4,6)}.${DATE.slice(6,8)}`;

const args = process.argv.slice(2);
const VERSION_PREFIX = process.env.WX_VERSION_PREFIX || '';

// 兼容 --experience 作为 --upload 的别名
let uploadFlag = args.includes('--upload');
if (args.includes('--experience')) {
  console.warn('⚠️  --experience 已弃用，请使用 --upload');
  uploadFlag = true;
}

const opts = {
  upload: uploadFlag,
  preview: args.includes('--preview'),
  dev:     args.includes('--dev'),
  ver:     (() => {
    const i = args.indexOf('--ver');
    if (i !== -1 && args[i + 1]) return args[i + 1];
    const prefix = VERSION_PREFIX ? VERSION_PREFIX + '.' : '';
    return prefix + DEFAULT_VERSION;
  })(),
  desc:    (() => {
    const i = args.indexOf('--desc');
    if (i !== -1 && args[i + 1]) return args[i + 1];
    return `${process.env.WX_DEFAULT_DESC || 'CI 自动上传'} [${BRANCH} @ ${COMMIT}]`;
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
    'docs/**/*',
  ],
});

// ═══════════════ Manifest 记录 ═══════════════
const RELEASE_DIR = path.join(PROJECT_PATH, 'release');
if (!fs.existsSync(RELEASE_DIR)) fs.mkdirSync(RELEASE_DIR, { recursive: true });

function writeManifest(manifest) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  let filename;
  if (manifest.mode === 'preview') {
    filename = `wechat-ci-preview-${COMMIT}.json`;
  } else {
    filename = `wechat-ci-upload-${manifest.version}.json`;
  }
  const manifestPath = path.join(RELEASE_DIR, filename);
  manifest.generatedAt = new Date().toISOString();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return manifestPath;
}

// ═══════════════ 核心逻辑 ═══════════════
async function main() {
  const mode = opts.preview ? 'PREVIEW' : opts.upload ? 'UPLOAD' : 'DEV';

  console.log(`\n🚀 珠澳小事哥 CI 2.0 上传`);
  console.log(`   模式:     ${mode}`);
  console.log(`   版本:     ${opts.ver}`);
  console.log(`   描述:     ${opts.desc}`);
  console.log(`   AppID:    ${APPID_MASKED}`);
  console.log(`   Branch:   ${BRANCH}`);
  console.log(`   Commit:   ${COMMIT}`);
  console.log(`   项目:     ${PROJECT_PATH}\n`);

  try {
    if (opts.preview) {
      // ── 预览模式 ──
      const qrPath = path.join(PROJECT_PATH, `preview-${COMMIT}.png`);
      const result = await ci.preview({
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

      // Manifest
      const manifest = {
        mode: 'preview',
        branch: BRANCH,
        commit: COMMIT,
        appidMasked: APPID_MASKED,
        qrcodePath: qrPath,
        miniprogramCiVersion: (() => { try { return require('miniprogram-ci/package.json').version; } catch { return 'unknown'; } })(),
      };
      const manifestPath = writeManifest(manifest);

      // 输出
      const qrStat = fs.statSync(qrPath);
      console.log(`\n✅ PREVIEW PASS`);
      console.log(`   Branch:       ${BRANCH}`);
      console.log(`   Commit:       ${COMMIT}`);
      console.log(`   AppID:        ${APPID_MASKED}`);
      console.log(`   二维码:       ${qrPath}`);
      console.log(`   文件大小:     ${(qrStat.size / 1024).toFixed(1)} KB`);
      console.log(`   SHA256:       ${execSync(`sha256sum "${qrPath}" | cut -d' ' -f1`, { encoding: 'utf8' }).trim()}`);
      console.log(`   生成时间:     ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
      console.log(`   有效时间:     约 25 分钟`);
      console.log(`   Manifest:     ${manifestPath}`);
      console.log(`\n   📱 扫码即可预览\n`);

    } else {
      // ── 上传模式（开发版 / 体验版）──
      console.log('📦 正在打包上传...');
      const result = await ci.upload({
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

      // Manifest
      const manifest = {
        mode: 'upload',
        version: opts.ver,
        branch: BRANCH,
        commit: COMMIT,
        description: opts.desc,
      };
      const manifestPath = writeManifest(manifest);

      console.log(`\n✅ 上传成功!`);
      console.log(`   版本号:   ${opts.ver}`);
      console.log(`   描述:     ${opts.desc}`);
      console.log(`   Manifest: ${manifestPath}`);
      console.log(`\n⚠️  上传 ≠ 提交审核 ≠ 正式发布`);
      console.log(`   请前往 https://mp.weixin.qq.com 管理版本\n`);
    }

  } catch (err) {
    console.error(`\n❌ 上传失败: ${err.message}`);
    if (err.code === 10006) {
      console.error('   → 私钥无效或已过期，请重新生成密钥');
    }
    process.exit(1);
  }
}

main();
