#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# ci/gate-check.sh — Git 门禁检查（上传前强制运行）
#
# 检查项目：
#   1. 当前是否在 fix/ 或 release/ 分支
#   2. 工作区是否干净
#   3. 代码是否已推送
#   4. 分支是否基于 release/v6.5.0
#
# 用法：
#   bash ci/gate-check.sh
#   通过 → exit 0
#   不通过 → 打印错误 → exit 1
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=true
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo ""
echo "═════════════════════════════════════════════"
echo "  Git Gate Check — 上传前门禁"
echo "═════════════════════════════════════════════"
echo ""

# ── 1. 检查分支 ──
BRANCH=$(git branch --show-current)
echo "📋 当前分支: $BRANCH"

if [[ "$BRANCH" =~ ^(fix/|release/) ]]; then
  echo -e "${GREEN}   ✅ 分支命名符合规范${NC}"
else
  echo -e "${RED}   ❌ 分支不在 fix/ 或 release/ 系列${NC}"
  echo "      当前: $BRANCH"
  PASS=false
fi

# ── 2. 检查工作区 ──
if git diff --quiet && git diff --cached --quiet; then
  echo -e "${GREEN}   ✅ 工作区干净${NC}"
else
  echo -e "${RED}   ❌ 工作区有未提交的修改${NC}"
  git status --short
  PASS=false
fi

# ── 3. 检查是否已推送 ──
REMOTE_SHA=$(git ls-remote --heads origin "$BRANCH" 2>/dev/null | cut -f1 || echo "")
LOCAL_SHA=$(git rev-parse HEAD)

if [ -z "$REMOTE_SHA" ]; then
  echo -e "${YELLOW}   ⚠️  分支 $BRANCH 尚未推送${NC}"
  PASS=false
elif [ "$REMOTE_SHA" = "$LOCAL_SHA" ]; then
  echo -e "${GREEN}   ✅ 代码已同步到 GitHub${NC}"
else
  echo -e "${YELLOW}   ⚠️  本地与远程不一致（需要 push）${NC}"
  echo "      local:  ${LOCAL_SHA:0:7}"
  echo "      remote: ${REMOTE_SHA:0:7}"
  PASS=false
fi

# ── 4. 检查分支来源 ──
if git merge-base --is-ancestor "$BRANCH" release/v6.5.0 2>/dev/null; then
  echo -e "${GREEN}   ✅ 基于 release/v6.5.0${NC}"
elif git merge-base --is-ancestor release/v6.5.0 "$BRANCH" 2>/dev/null; then
  echo -e "${YELLOW}   ⚠️  当前分支已超前于 release/v6.5.0${NC}"
else
  echo -e "${RED}   ❌ 当前分支不基于 release/v6.5.0${NC}"
  PASS=false
fi

# ── 结果 ──
echo ""
if [ "$PASS" = true ]; then
  echo -e "${GREEN}═════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  ✅ 门禁通过，可以上传${NC}"
  echo -e "${GREEN}═════════════════════════════════════════════${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}═════════════════════════════════════════════${NC}"
  echo -e "${RED}  ❌ 门禁未通过，上传被拦截${NC}"
  echo -e "${RED}═════════════════════════════════════════════${NC}"
  echo ""
  exit 1
fi
