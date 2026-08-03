#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# ci/before-upload.sh — 上传前一键预检 + 门禁 + 上传
#
# 流程：
#   bash ci/before-upload.sh --preview
#   bash ci/before-upload.sh --upload --ver 6.5.1 --desc "..."
#
#   1. 运行 gate-check.sh 门禁
#   2. 环境变量检查
#   3. node ci/upload.js 执行上传
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

MODE="${1:-}"
if [ "$MODE" != "--preview" ] && [ "$MODE" != "--upload" ] && [ "$MODE" != "--dev" ]; then
  echo ""
  echo -e "${RED}用法:${NC}"
  echo "  bash ci/before-upload.sh --preview"
  echo "  bash ci/before-upload.sh --upload --ver 6.5.1 --desc \"fix: footer\""
  echo ""
  exit 1
fi

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  珠澳小事哥 CI 2.0 — 预检 + 上传        ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

# ── Step 1: 门禁 ──
echo -e "${GREEN}[1/3] Git 门禁检查…${NC}"
if ! bash "$PROJECT_DIR/ci/gate-check.sh" "$MODE"; then
  echo ""
  echo "❌ 门禁未通过，上传已取消。"
  exit 1
fi

# ── Step 2: 环境变量检查（不输出私钥信息）──
echo -e "${GREEN}[2/3] 环境变量检查…${NC}"
if [ -z "${WX_APPID:-}" ]; then
  echo "❌ 缺少环境变量 WX_APPID"
  echo "   请先执行: source .env.ci"
  exit 1
fi
if [ -z "${WX_PRIVATE_KEY_PATH:-}" ]; then
  echo "❌ 缺少环境变量 WX_PRIVATE_KEY_PATH"
  echo "   请先执行: source .env.ci"
  exit 1
fi
if [ ! -f "$WX_PRIVATE_KEY_PATH" ]; then
  echo "❌ 私钥文件不存在"
  exit 1
fi
echo -e "   ✅ 环境变量已就绪"

# ── Step 3: 执行上传 ──
echo ""
echo -e "${GREEN}[3/3] 执行上传…${NC}"
node "$PROJECT_DIR/ci/upload.js" "$@"
