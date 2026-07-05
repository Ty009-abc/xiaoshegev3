#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# set-env.sh — 从 .env.deploy 读取并批量设置云函数环境变量
# ═══════════════════════════════════════════════════════════════
#
# 用法：
#   cp .env.deploy.example .env.deploy
#   编辑 .env.deploy 填入真实值
#   bash scripts/set-env.sh
#
# ⚠️ 这会用 .env.deploy 中的值覆盖所有云函数的环境变量。
#    只对实际需要 env 的 6 个 CF 设置。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env.deploy"
ENV_ID="fanshex-d2g0adgv7dfbc9bdc"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env.deploy 不存在"
  echo "   cp .env.deploy.example .env.deploy"
  echo "   编辑 .env.deploy 填入真实值"
  exit 1
fi

# ── 加载 .env.deploy ──
set -a
source "$ENV_FILE" 2>/dev/null || {
  echo "❌ .env.deploy 格式错误，请确保每行 KEY=VALUE"
  exit 1
}
set +a

echo "╔══════════════════════════════════════════════╗"
echo "║  设置云函数环境变量                           ║"
echo "║  环境: $ENV_ID                               ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 只需要 env 的 6 个 CF ──
# 1. generateAiReport — AI API
echo "[1/6] generateAiReport"
tcb fn config:update generateAiReport --envId "$ENV_ID" \
  --envVariables "{\"AI_API_KEY\":\"${AI_API_KEY}\",\"AI_API_BASE_URL\":\"${AI_API_BASE_URL}\",\"AI_MODEL_FLASH\":\"${AI_MODEL_FLASH}\",\"AI_MODEL_PRO\":\"${AI_MODEL_PRO}\"}" 2>&1 || echo "  ⚠️ 设置失败"

# 2. initKnowledgeEmbeddings — Embedding API
echo "[2/6] initKnowledgeEmbeddings"
tcb fn config:update initKnowledgeEmbeddings --envId "$ENV_ID" \
  --envVariables "{\"EMBEDDING_API_KEY\":\"${EMBEDDING_API_KEY}\",\"EMBEDDING_MODEL\":\"${EMBEDDING_MODEL}\",\"EMBEDDING_API_BASE\":\"${EMBEDDING_API_BASE}\"}" 2>&1 || echo "  ⚠️ 设置失败"

# 3. createOrder — 微信支付
echo "[3/6] createOrder"
tcb fn config:update createOrder --envId "$ENV_ID" \
  --envVariables "{\"WXPAY_MCHID\":\"${WXPAY_MCHID}\",\"WXPAY_APPID\":\"${WXPAY_APPID}\",\"WXPAY_API_V3_KEY\":\"${WXPAY_API_V3_KEY}\",\"WXPAY_SERIAL_NO\":\"${WXPAY_SERIAL_NO}\",\"WXPAY_PRIVATE_KEY\":\"${WXPAY_PRIVATE_KEY}\",\"WXPAY_NOTIFY_URL\":\"${WXPAY_NOTIFY_URL}\"}" 2>&1 || echo "  ⚠️ 设置失败"

# 4. payCallback — 微信支付回调解密
echo "[4/6] payCallback"
tcb fn config:update payCallback --envId "$ENV_ID" \
  --envVariables "{\"WXPAY_API_V3_KEY\":\"${WXPAY_API_V3_KEY}\"}" 2>&1 || echo "  ⚠️ 设置失败"

# 5. refundOrder — 微信支付退款
echo "[5/6] refundOrder"
tcb fn config:update refundOrder --envId "$ENV_ID" \
  --envVariables "{\"WXPAY_MCHID\":\"${WXPAY_MCHID}\"}" 2>&1 || echo "  ⚠️ 设置失败"

# 6. verifyPayment — 微信支付确认
echo "[6/6] verifyPayment"
tcb fn config:update verifyPayment --envId "$ENV_ID" \
  --envVariables "{\"WXPAY_MCHID\":\"${WXPAY_MCHID}\",\"WXPAY_API_V3_KEY\":\"${WXPAY_API_V3_KEY}\"}" 2>&1 || echo "  ⚠️ 设置失败"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏁 环境变量设置完成"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "验证: tcb fn detail generateAiReport --envId $ENV_ID"
