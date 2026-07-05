#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# deploy.sh — 主部署脚本（一键完成全部部署）
# ═══════════════════════════════════════════════════════════════
#
# 用法：
#   bash scripts/deploy.sh              # 交互模式
#   bash scripts/deploy.sh all          # 一键全量部署
#   bash scripts/deploy.sh functions    # 仅部署云函数
#   bash scripts/deploy.sh env          # 仅设置环境变量
#   bash scripts/deploy.sh db           # 仅初始化数据库
#   bash scripts/deploy.sh dry-run      # 预演模式
#
# 首次使用：
#   npm i -g @cloudbase/cli
#   tcb login
#   cp .env.deploy.example .env.deploy
#   编辑 .env.deploy 填入真实值

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "╔══════════════════════════════════════════════════════╗"
echo "║  珠澳小事哥 · 认知操作系统 v3.0                      ║"
echo "║  环境: fanshex-d2g0adgv7dfbc9bdc                     ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── 预检 ──
preflight() {
  local ok=true

  echo "🔍 环境预检..."
  echo ""

  # Node
  if command -v node &>/dev/null; then
    echo "  ✅ Node.js: $(node -v)"
  else
    echo "  ❌ Node.js 未安装"
    ok=false
  fi

  # tcb CLI
  if command -v tcb &>/dev/null; then
    echo "  ✅ tcb CLI: $(tcb --version 2>&1 | head -1 || echo 'OK')"
  else
    echo "  ⚠️  tcb CLI 未安装 → npm i -g @cloudbase/cli"
  fi

  # cloudbaserc.json
  if [ -f "$PROJECT_DIR/cloudbaserc.json" ]; then
    local count=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$PROJECT_DIR/cloudbaserc.json','utf8')).functions.filter(f=>!['common','lib'].includes(f.name)).length)" 2>/dev/null)
    echo "  ✅ cloudbaserc.json: $count 个云函数"
  else
    echo "  ❌ cloudbaserc.json 缺失"
    ok=false
  fi

  # .env.deploy
  if [ -f "$PROJECT_DIR/.env.deploy" ]; then
    echo "  ✅ .env.deploy 已配置"
  else
    echo "  ⚠️  .env.deploy 未配置 → cp .env.deploy.example .env.deploy"
  fi

  echo ""
  if [ "$ok" = false ]; then
    echo "❌ 预检未通过，请修复以上问题"
    exit 1
  fi
  echo "✅ 预检通过"
  echo ""
}

# ── 交互菜单 ──
menu() {
  echo "请选择操作："
  echo "  1) 一键部署 (云函数 + 环境变量 + 数据库)"
  echo "  2) 仅部署云函数"
  echo "  3) 仅设置环境变量"
  echo "  4) 仅初始化数据库"
  echo "  5) 预演 (dry-run)"
  echo "  0) 退出"
  echo ""
  read -rp "> " CHOICE

  case "$CHOICE" in
    1) deploy_all ;;
    2) bash "$SCRIPT_DIR/deploy-functions.sh" ;;
    3) bash "$SCRIPT_DIR/set-env.sh" ;;
    4) bash "$SCRIPT_DIR/deploy-init-db.sh" ;;
    5) bash "$SCRIPT_DIR/deploy-functions.sh" --dry-run ;;
    0) exit 0 ;;
    *) echo "无效选择"; menu ;;
  esac
}

# ── 一键全量 ──
deploy_all() {
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Step 1/3: 部署 46 个云函数"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  bash "$SCRIPT_DIR/deploy-functions.sh"
  echo ""

  if [ -f "$PROJECT_DIR/.env.deploy" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Step 2/3: 配置环境变量"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    bash "$SCRIPT_DIR/set-env.sh"
    echo ""
  else
    echo "⚠️  跳过环境变量设置（.env.deploy 不存在）"
  fi

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Step 3/3: 初始化数据库"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  bash "$SCRIPT_DIR/deploy-init-db.sh"
  echo ""

  echo "╔══════════════════════════════════════════════════════╗"
  echo "║  🎉 全量部署完成                                    ║"
  echo "╚══════════════════════════════════════════════════════╝"
  echo ""
  echo "📋 下一步："
  echo "  1. 微信开发者工具 → 编译运行"
  echo "  2. 验证 login → onboarding → home 链路"
  echo "  3. 检查 cloudbaserc.json 部署报告: deploy-report.md"
}

# ── 入口 ──
preflight

case "${1:-menu}" in
  all)       deploy_all ;;
  functions) bash "$SCRIPT_DIR/deploy-functions.sh" ;;
  env)       bash "$SCRIPT_DIR/set-env.sh" ;;
  db)        bash "$SCRIPT_DIR/deploy-init-db.sh" ;;
  dry-run)   bash "$SCRIPT_DIR/deploy-functions.sh" --dry-run ;;
  menu)      menu ;;
  *)         menu ;;
esac
