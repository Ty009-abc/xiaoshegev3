#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# ci/gate-check.sh — Git 门禁检查（上传前强制运行）
#
# 检查项目：
#   1. 分支是否在 fix/ 或 release/ 系列
#   2. 工作区是否干净
#   3. 代码是否已推送且与远程一致
#   4. 分支是否基于 release/v6.5.0
#   5. Fix 分支仅允许 preview，不允许 upload
#   6. Detached HEAD 仅允许指向 release tag 时 upload
#   7. release 分支不能落后于远程
#
# 用法：
#   bash ci/gate-check.sh [--preview|--upload]
#   通过 → exit 0
#   不通过 → 打印错误 → exit 1
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

MODE="${1:-}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo ""
echo "═════════════════════════════════════════════"
echo "  Git Gate Check — 上传前门禁"
echo "═════════════════════════════════════════════"
echo ""

# ── 0. Detached HEAD 检测 ──
BRANCH=$(git branch --show-current)
if [ -z "$BRANCH" ]; then
  # detached HEAD — 检查是否指向合法 release tag
  HEAD_TAG=$(git tag --points-at HEAD | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "")
  if [ -n "$HEAD_TAG" ]; then
    echo "📋 当前: detached HEAD @ $HEAD_TAG"
    echo -e "${GREEN}   ✅ 合法 release tag，允许 upload${NC}"
    if [ "$MODE" = "--preview" ]; then
      echo -e "${YELLOW}   ⚠️  建议切回分支再 preview${NC}"
    fi
  else
    echo -e "${RED}   ❌ Detached HEAD 且未指向合法 release tag${NC}"
    echo "      当前 HEAD: $(git rev-parse --short HEAD)"
    echo "      请先: git checkout release/v6.5.0"
    exit 1
  fi
  # detached HEAD 不做后续检查（tag 已推送即合法）
  echo ""
  echo -e "${GREEN}═════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  ✅ 门禁通过 (detached HEAD @ $HEAD_TAG)${NC}"
  echo -e "${GREEN}═════════════════════════════════════════════${NC}"
  echo ""
  exit 0
fi

echo "📋 当前分支: $BRANCH"

if [[ "$BRANCH" =~ ^(fix/|release/) ]]; then
  echo -e "${GREEN}   ✅ 分支命名符合规范${NC}"
else
  echo -e "${RED}   ❌ 分支不在 fix/ 或 release/ 系列${NC}"
  echo "      当前: $BRANCH"
  exit 1
fi

# ── 2. 工作区检查 ──
if git diff --quiet && git diff --cached --quiet; then
  echo -e "${GREEN}   ✅ 工作区干净${NC}"
else
  echo -e "${RED}   ❌ WORKING TREE NOT CLEAN${NC}"
  git status --short
  exit 1
fi

# ── 3. 推送状态检查 ──
REMOTE_SHA=$(git ls-remote --heads origin "$BRANCH" 2>/dev/null | cut -f1 || echo "")
LOCAL_SHA=$(git rev-parse HEAD)

if [ -z "$REMOTE_SHA" ]; then
  echo -e "${RED}   ❌ 分支 $BRANCH 尚未推送${NC}"
  exit 1
elif [ "$REMOTE_SHA" = "$LOCAL_SHA" ]; then
  echo -e "${GREEN}   ✅ 代码已同步到 GitHub${NC}"
else
  echo -e "${RED}   ❌ 本地与远程不一致${NC}"
  echo "      local:  ${LOCAL_SHA:0:7}"
  echo "      remote: ${REMOTE_SHA:0:7}"
  echo "      请先: git push origin $BRANCH"
  exit 1
fi

# ── 4. Fix 分支 Gate: 只允许 preview ──
if [[ "$BRANCH" =~ ^fix/ ]]; then
  if [ "$MODE" = "--upload" ]; then
    echo -e "${RED}   ❌ UPLOAD BLOCKED: Fix 分支 ($BRANCH) 不允许 upload${NC}"
    echo "      Fix 分支仅允许 --preview"
    echo "      请先合并到 release/v6.5.0 后再 upload"
    exit 1
  fi
  echo -e "${YELLOW}   ⚠️  Fix 分支: 仅允许 preview${NC}"
fi

# ── 5. release 分支远程检查 ──
if [[ "$BRANCH" =~ ^release/ ]]; then
  REMOTE_RELEASE_SHA=$(git ls-remote --heads origin "$BRANCH" 2>/dev/null | cut -f1 || echo "")
  LOCAL_RELEASE_SHA=$(git rev-parse "$BRANCH")
  if [ -n "$REMOTE_RELEASE_SHA" ] && [ "$REMOTE_RELEASE_SHA" != "$LOCAL_RELEASE_SHA" ]; then
    echo -e "${RED}   ❌ 本地 release 与远程不一致${NC}"
    echo "      local:  ${LOCAL_RELEASE_SHA:0:7}"
    echo "      remote: ${REMOTE_RELEASE_SHA:0:7}"
    echo "      请先: git pull origin $BRANCH"
    exit 1
  fi
  echo -e "${GREEN}   ✅ release 分支与远程一致${NC}"
fi

# ── 6. 分支来源 ──
if git merge-base --is-ancestor "$BRANCH" "release/v6.5.0" 2>/dev/null; then
  echo -e "${GREEN}   ✅ 基于 release/v6.5.0${NC}"
elif git merge-base --is-ancestor "release/v6.5.0" "$BRANCH" 2>/dev/null; then
  echo -e "${YELLOW}   ⚠️  当前分支已超前于 release/v6.5.0${NC}"
else
  echo -e "${RED}   ❌ 当前分支不基于 release/v6.5.0${NC}"
  exit 1
fi

# ── 结果 ──
echo ""
echo -e "${GREEN}═════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ 门禁通过${NC}"
echo -e "${GREEN}═════════════════════════════════════════════${NC}"
echo ""
exit 0
