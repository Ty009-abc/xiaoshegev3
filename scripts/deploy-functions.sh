#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# deploy-functions.sh — 批量部署所有云函数
# ═══════════════════════════════════════════════════════════════
#
# 前置条件：
#   npm i -g @cloudbase/cli
#   tcb login
#
# 用法：
#   bash scripts/deploy-functions.sh                    # 部署全部
#   bash scripts/deploy-functions.sh login               # 部署单个
#   bash scripts/deploy-functions.sh --force             # 强制覆盖
#   bash scripts/deploy-functions.sh --dry-run           # 预演不执行
#
# 输出：
#   deploy-report.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORT_FILE="$PROJECT_DIR/deploy-report.md"
FORCE=false
DRY_RUN=false
TARGET=""

# ── 参数解析 ──
for arg in "$@"; do
  case "$arg" in
    --force|-f) FORCE=true ;;
    --dry-run|-n) DRY_RUN=true ;;
    *) TARGET="$arg" ;;
  esac
done

# ── 检查 CLI ──
check_cli() {
  if ! command -v tcb &>/dev/null; then
    echo "❌ tcb CLI 未安装。请执行:"
    echo "   npm i -g @cloudbase/cli"
    echo "   tcb login"
    exit 1
  fi
  echo "✅ tcb CLI: $(tcb --version 2>&1 | head -1 || echo 'OK')"
}

# ── 检查登录 ──
check_login() {
  if ! tcb env:list &>/dev/null 2>&1; then
    echo "❌ 未登录或未授权。请执行: tcb login"
    exit 1
  fi
  echo "✅ tcb 已登录"
}

# ── 读取 cloudbaserc.json ──
read_functions() {
  node -e "
    const fs = require('fs');
    const d = JSON.parse(fs.readFileSync('$PROJECT_DIR/cloudbaserc.json','utf8'));
    const names = d.functions
      .filter(f => !['common','lib'].includes(f.name))
      .map(f => f.name);
    names.forEach(n => console.log(n));
  " 2>/dev/null
}

# ── 安装单个云函数依赖 ──
install_deps() {
  local name="$1"
  local fn_dir="$PROJECT_DIR/cloudfunctions/$name"

  if [ ! -f "$fn_dir/package.json" ]; then
    return 0  # 无依赖，跳过
  fi

  # 检查是否有 dependencies
  if ! node -e "const d=JSON.parse(require('fs').readFileSync('$fn_dir/package.json','utf8')); process.exit(Object.keys(d.dependencies||{}).length > 0 ? 0 : 1)" 2>/dev/null; then
    return 0  # dependencies 为空
  fi

  echo "    安装依赖..."
  (cd "$fn_dir" && npm install --production 2>&1 | tail -1) || {
    echo "    ⚠️  依赖安装失败，继续尝试部署"
  }
}

# ── 部署单个云函数 ──
deploy_one() {
  local name="$1"
  local fn_dir="$PROJECT_DIR/cloudfunctions/$name"

  if [ ! -f "$fn_dir/index.js" ]; then
    echo "FAIL|$name|index.js 不存在"
    return 1
  fi

  if $DRY_RUN; then
    echo "DRYRUN|$name|(跳过部署)"
    return 0
  fi

  install_deps "$name"

  echo "    正在部署..."
  local start=$(date +%s)
  local output=""
  local code=0

  output=$(cd "$PROJECT_DIR" && tcb fn deploy "$name" --envId fanshex-d2g0adgv7dfbc9bdc --force 2>&1) || code=$?
  local elapsed=$(($(date +%s) - start))

  if [ $code -eq 0 ]; then
    echo "OK|$name|${elapsed}s"
    return 0
  else
    # 提取错误信息
    local err_msg=$(echo "$output" | grep -i "error\|fail\|reason" | head -1 | cut -c1-120)
    echo "FAIL|$name|${elapsed}s|${err_msg:-未知错误}"
    return 1
  fi
}

# ── 主流程 ──
main() {
  check_cli
  check_login

  echo "📦 读取云函数清单..."
  mapfile -t ALL_FNS < <(read_functions)

  if [ ${#ALL_FNS[@]} -eq 0 ]; then
    echo "❌ cloudbaserc.json 未找到可部署的云函数"
    exit 1
  fi

  echo "共 ${#ALL_FNS[@]} 个云函数"
  echo ""

  local total=0 success=0 fail=0
  local failed_list=()

  if [ -n "$TARGET" ]; then
    echo "🎯 仅部署: $TARGET"
    echo ""
    deploy_one "$TARGET"
    if [ $? -eq 0 ]; then success=$((success+1)); else fail=$((fail+1)); fi
    total=1
  else
    for name in "${ALL_FNS[@]}"; do
      total=$((total+1))
      printf "[%2d/%2d] %-30s " "$total" "${#ALL_FNS[@]}" "$name"
      if deploy_one "$name"; then
        success=$((success+1))
      else
        fail=$((fail+1))
        failed_list+=("$name")
      fi
    done
  fi

  # ── 生成报告 ──
  local timestamp=$(TZ='Asia/Shanghai' date '+%Y-%m-%d %H:%M:%S')
  cat > "$REPORT_FILE" << RPTEOF
# 云函数部署报告

**时间:** $timestamp
**环境:** fanshex-d2g0adgv7dfbc9bdc
**模式:** $([ "$DRY_RUN" = true ] && echo '预演' || echo '正式')

| 维度 | 数值 |
|------|------|
| 总数 | $total |
| 成功 | $success |
| 失败 | $fail |

RPTEOF

  if [ $fail -gt 0 ]; then
    echo "" >> "$REPORT_FILE"
    echo "## ❌ 失败列表" >> "$REPORT_FILE"
    for f in "${failed_list[@]}"; do
      echo "- $f" >> "$REPORT_FILE"
    done
  else
    echo "" >> "$REPORT_FILE"
    echo "✅ 全部部署成功" >> "$REPORT_FILE"
  fi

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  if $DRY_RUN; then
    echo "🏁 预演完成（未实际部署）"
  else
    echo "🏁 部署完成: $success/$total 成功, $fail 失败"
  fi
  echo "📄 报告: $REPORT_FILE"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  [ $fail -eq 0 ] && exit 0 || exit 1
}

main
