#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# set-env.sh — 从 .env.deploy 读取并批量设置云函数环境变量
# ═══════════════════════════════════════════════════════════════
#
# 用法：
#   cp .env.deploy.example .env.deploy
#   编辑 .env.deploy 填入真实值
#   bash scripts/set-env.sh              # 实际写入
#   bash scripts/set-env.sh --dry-run    # 只读校验，不写入
#
# ⚠️ 这会用 .env.deploy 中的值覆盖所有云函数的环境变量。
#    只对实际需要 env 的 6 个 CF 设置。
#
# ⚠️ RC8.4 V6 / B2.7 变更（MERGE-SAFE）：
#    generateAiReport 的 env 现在采用「读取远程 → 保留全部已有键 → 覆盖
#    显式提供的本地值 → 回写完整并集」策略，避免 `config update` 的覆盖式
#    语义误删无关键（如 RC83_* 生产开关）。
#    仅改动 generateAiReport；支付相关云函数（createOrder/payCallback/
#    refundOrder/verifyPayment）保持原样，不在本变更范围内。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env.deploy"
ENV_ID="fanshex-d2g0adgv7dfbc9bdc"

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) echo "用法: bash scripts/set-env.sh [--dry-run]"; exit 0 ;;
    *) echo "未知参数: $arg"; exit 2 ;;
  esac
done

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env.deploy 不存在"
  echo "   cp .env.deploy.example .env.deploy"
  echo "   编辑 .env.deploy 填入真实值"
  exit 1
fi

if [ ! -r "$ENV_FILE" ]; then
  echo "❌ .env.deploy 不可读（需要部署用户可读；权限建议 600，属主=部署用户）"
  exit 1
fi

# ── 加载 .env.deploy ──
set -a
source "$ENV_FILE" 2>/dev/null || {
  echo "❌ .env.deploy 格式错误，请确保每行 KEY=value"
  exit 1
}
set +a

echo "╔══════════════════════════════════════════════╗"
echo "║  设置云函数环境变量                           ║"
echo "║  环境: $ENV_ID                               ║"
if [ "$DRY_RUN" = "1" ]; then
echo "║  模式: DRY-RUN（只读校验，不写入）            ║"
fi
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 只需要 env 的 6 个 CF ──
# 1. generateAiReport — AI API + RC8.4 V6 shadow 配置（MERGE-SAFE）
echo "[1/6] generateAiReport"
GAF_TMP="$(mktemp -d)"
trap 'rm -rf "$GAF_TMP"' EXIT

# 1a. 读取远程函数当前 env（只做解析，回显仅键名/计数，绝不打印值）
if ! tcb fn detail generateAiReport --env-id "$ENV_ID" --json 2>/dev/null \
      | tr -d '\000' > "$GAF_TMP/remote.json" ; then
  echo "  ❌ 无法读取远程函数环境 → fail-closed，放弃设置"
  exit 1
fi
if [ ! -s "$GAF_TMP/remote.json" ]; then
  echo "  ❌ 远程函数环境为空/无法解析 → fail-closed，放弃设置"
  exit 1
fi

# 1b. 本地值校验 + 合并（保留全部远程键，仅覆盖显式提供的本地键）
#     merge 工具对缺失/非法值 fail-closed，并且只打印键名与计数。
MERGE_ARGS=(--remote "$GAF_TMP/remote.json" --out "$GAF_TMP/merged-env.json")
if [ "$DRY_RUN" = "1" ]; then
  MERGE_ARGS+=(--dry-run)
fi
if ! node "$SCRIPT_DIR/lib/merge-function-env.js" "${MERGE_ARGS[@]}" >/dev/null; then
  echo "  ❌ 本地 env 校验或合并失败 → fail-closed，放弃设置"
  exit 1
fi

# 1c. 组装一个仅含 envVariables 的最小 cloudbaserc.json（避免误改 timeout/runtime 等）
# 1d. 回写完整并集（config update 默认覆盖式，但我们回写的是完整并集，故无键丢失）
#     注意：不使用 `config diff` 打印（其输出可能回显 ALLOWLIST 等值），
#     只依赖 merge 工具的键名/计数诊断。
if [ "$DRY_RUN" = "1" ]; then
  echo "  (dry-run) 已完成远程读取/校验/合并；跳过 config update（未写入云端）"
else
  ENV_ID="$ENV_ID" node -e '
    const fs = require("fs");
    const env = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const cfg = { functions: [ { name: "generateAiReport", envVariables: env } ] };
    fs.writeFileSync(process.argv[2], JSON.stringify(cfg, null, 2));
  ' "$GAF_TMP/merged-env.json" "$GAF_TMP/cloudbaserc.json"

  if tcb --config-file "$GAF_TMP/cloudbaserc.json" \
        config update fn generateAiReport --env-id "$ENV_ID" --yes 2>&1 \
        | sed -E 's/(KEY|SECRET|TOKEN|PASSWORD|ALLOWLIST)[A-Z_]*[=:][^ ]*/\1=<redacted>/g'; then
    echo "  ✅ generateAiReport env 已合并写入"
  else
    echo "  ⚠️ 设置失败"
  fi
fi

# 2. initKnowledgeEmbeddings — Embedding API
#    （沿用原有路径，未在本变更范围内）
echo "[2/6] initKnowledgeEmbeddings"
if [ "$DRY_RUN" = "1" ]; then echo "  (dry-run) 跳过"; else
tcb fn config:update initKnowledgeEmbeddings --envId "$ENV_ID" \
  --envVariables "{\"EMBEDDING_API_KEY\":\"${EMBEDDING_API_KEY}\",\"EMBEDDING_MODEL\":\"${EMBEDDING_MODEL}\",\"EMBEDDING_API_BASE\":\"${EMBEDDING_API_BASE}\"}" 2>&1 || echo "  ⚠️ 设置失败"
fi

# 3. createOrder — 微信支付
#    ⚠️ 支付函数：本变更不触碰（保留原样，且不做任何 env mutation）
echo "[3/6] createOrder"
if [ "$DRY_RUN" = "1" ]; then echo "  (dry-run) 跳过"; else
tcb fn config:update createOrder --envId "$ENV_ID" \
  --envVariables "{\"WXPAY_MCHID\":\"${WXPAY_MCHID}\",\"WXPAY_APPID\":\"${WXPAY_APPID}\",\"WXPAY_API_V3_KEY\":\"${WXPAY_API_V3_KEY}\",\"WXPAY_SERIAL_NO\":\"${WXPAY_SERIAL_NO}\",\"WXPAY_PRIVATE_KEY\":\"${WXPAY_PRIVATE_KEY}\",\"WXPAY_NOTIFY_URL\":\"${WXPAY_NOTIFY_URL}\"}" 2>&1 || echo "  ⚠️ 设置失败"
fi

# 4. payCallback — 微信支付回调解密
echo "[4/6] payCallback"
if [ "$DRY_RUN" = "1" ]; then echo "  (dry-run) 跳过"; else
tcb fn config:update payCallback --envId "$ENV_ID" \
  --envVariables "{\"WXPAY_API_V3_KEY\":\"${WXPAY_API_V3_KEY}\"}" 2>&1 || echo "  ⚠️ 设置失败"
fi

# 5. refundOrder — 微信支付退款
echo "[5/6] refundOrder"
if [ "$DRY_RUN" = "1" ]; then echo "  (dry-run) 跳过"; else
tcb fn config:update refundOrder --envId "$ENV_ID" \
  --envVariables "{\"WXPAY_MCHID\":\"${WXPAY_MCHID}\"}" 2>&1 || echo "  ⚠️ 设置失败"
fi

# 6. verifyPayment — 微信支付确认
echo "[6/6] verifyPayment"
if [ "$DRY_RUN" = "1" ]; then echo "  (dry-run) 跳过"; else
tcb fn config:update verifyPayment --envId "$ENV_ID" \
  --envVariables "{\"WXPAY_MCHID\":\"${WXPAY_MCHID}\",\"WXPAY_API_V3_KEY\":\"${WXPAY_API_V3_KEY}\"}" 2>&1 || echo "  ⚠️ 设置失败"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏁 环境变量设置完成"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "验证: tcb fn detail generateAiReport --env-id $ENV_ID"
