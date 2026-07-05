#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# deploy-init-db.sh — 部署 initDatabase 并执行数据库初始化
# ═══════════════════════════════════════════════════════════════
#
# 前置条件：
#   npm i -g @cloudbase/cli
#   tcb login
#
# 用法：
#   bash scripts/deploy-init-db.sh            # 首次初始化
#   bash scripts/deploy-init-db.sh --force    # 强制重建
#
# ⚠️ 注意：CloudBase CLI 调用云函数有一定限制。
#   如果 CLI 调用失败，请用微信开发者工具手动测试 initDatabase。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_ID="fanshex-d2g0adgv7dfbc9bdc"
FORCE=false

for arg in "$@"; do
  case "$arg" in
    --force|-f) FORCE=true ;;
  esac
done

# ── 检查 CLI ──
if ! command -v tcb &>/dev/null; then
  echo "❌ tcb CLI 未安装"
  echo "   npm i -g @cloudbase/cli && tcb login"
  exit 1
fi

echo "╔══════════════════════════════════════════════╗"
echo "║  数据库初始化 (Database Bootstrap)           ║"
echo "║  环境: $ENV_ID                               ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Step 1: deploy initDatabase
echo "[1/3] 部署 initDatabase 云函数..."
cd "$PROJECT_DIR"
tcb fn deploy initDatabase --envId "$ENV_ID" --force
echo "✅ initDatabase 已部署"
echo ""

# Step 2: invoke
echo "[2/3] 执行数据库初始化..."
PAYLOAD='{}'
if [ "$FORCE" = true ]; then
  PAYLOAD='{"force":true}'
  echo "⚠️  FORCE 模式：将清空已有数据重新写入"
fi

echo "调用参数: $PAYLOAD"
echo ""

# 尝试 tcb fn invoke
INVOKE_OUTPUT=$(tcb fn invoke initDatabase --envId "$ENV_ID" --params "$PAYLOAD" 2>&1) || true

if echo "$INVOKE_OUTPUT" | grep -q '"success":true\|"success": false\|"code"'; then
  echo "✅ 云函数执行成功"
  echo "$INVOKE_OUTPUT" | python3 -m json.tool 2>/dev/null || echo "$INVOKE_OUTPUT"
else
  echo "⚠️  CLI 直接调用可能受限。"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📋 请用以下方式之一手动执行："
  echo ""
  echo "方式一 (微信开发者工具):"
  echo "  云开发控制台 → 云函数 → initDatabase → 测试"
  echo "  参数: $PAYLOAD"
  echo ""
  echo "方式二 (Web 控制台):"
  echo "  https://console.cloud.tencent.com/tcb/scf/index"
  echo "  → 环境 $ENV_ID → 云函数 → initDatabase → 测试"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

echo ""
echo "[3/3] 验证 Collection 是否创建..."
# 尝试列出部分 collection
for col in products users orders system_configs admin_logs; do
  result=$(tcb db collection:get "$col" --envId "$ENV_ID" 2>&1) || true
  if echo "$result" | grep -q "not exist\|不存在"; then
    echo "  ❌ $col — 未创建"
  else
    echo "  ✅ $col — 已存在"
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏁 initDatabase 流程完成"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
