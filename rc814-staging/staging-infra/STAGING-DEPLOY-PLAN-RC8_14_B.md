# RC8_14_B — submitChallengeChoice 原子性修复 · staging 部署方案（本批先不部署）

- 基线：`feature/rc8.13-virtual-payment @ 471501b`（撰写时复核 HEAD 一致、工作区仅本批改动、本地=远端 0/0）
- 目标环境（唯一允许写入）：staging `fanshen002-d9g0rjr3b6e313af5`
- 生产 `fanshex-d2g0adgv7dfbc9bdc`：**本批不部署、不触碰**
- 本批范围：**仅** `submitChallengeChoice`（含 `lib/response.js` 新增 `CONFLICT:409`）；**不改** 试用配额、**不加** 指定记录复用

## 1. 变更摘要

- 将提交推进由「非原子读-改-写（`doc(record._id).update`）」改为「**版本条件原子更新（CAS on `currentEventIndex`）**」：
  `where({ _id, openid, status: ne 'finished', currentEventIndex: 读到的版本 }).update({...})`
  —— 仅当版本未被他人推进时才写入；`stats.updated !== 1` 则重读并按语义裁决（有界重试 5 次）。
- 同一原子写内提交：`choices` 追加、`currentEventIndex` 推进、`rawScores/scores/tags` 计数 → 重试不产生重复副作用。
- 冲突语义：
  - 同题同选择重复提交 → `code=0` 且 `duplicate:true/idempotent:true`（不重复计分、不推进）；
  - 同题不同选择并发 → 恰好一个成功，其余 `code=409 CONFLICT`（含 `data.conflict:true`）；
  - 过期/非当前题（经 plan 校验）→ `code=400 PARAM_ERROR`，不推进；
  - 不同记录 / 不同用户 → 条件写按 `_id + openid` 隔离，互不干扰。
- 未改计分引擎、未改鉴权、未放开权限、未触发支付。

## 2. 部署前门禁（必须全绿）

```bash
cd /home/ubuntu/rc88-6q-refoundation
export STAGING_ENV_ID=fanshen002-d9g0rjr3b6e313af5
export STAGING_ALLOWLIST=fanshen002-d9g0rjr3b6e313af5

# 1) 隔离/标记/依赖 preflight（READ-ONLY）
bash rc814-staging/staging-infra/preflight.sh
DEPS_PREFLIGHT=1 bash rc814-staging/staging-infra/preflight.sh

# 2) 本地回归（无网络）
node tests/rc8.14/run.js            # 期望 PASS (10/10)，含 submit-atomicity
```

## 3. 部署步骤（仅 staging；本批不执行）

> 注意：仓库根 `cloudbaserc.json` 指向**生产**；staging 部署必须用独立工作区（literal staging envId），
> 不可用 `-e` 之外的隐式默认，避免误投生产。

```bash
# 3.1 独立工作区（复用既有 /tmp/rc814-deploy-ws 模式）
WORK=/tmp/rc814-deploy-ws
mkdir -p "$WORK"
ln -sfn /home/ubuntu/rc88-6q-refoundation/cloudfunctions "$WORK/functions"
cat > "$WORK/cloudbaserc.json" <<'JSON'
{ "version":"2.0","envId":"fanshen002-d9g0rjr3b6e313af5","functionRoot":"./functions",
  "functions":[{"name":"submitChallengeChoice","runtime":"Nodejs18.15","timeout":30,"handler":"index.main","installDependency":true}] }
JSON

# 3.2 守卫式部署（要求显式确认；拒绝生产）
cd /home/ubuntu/rc88-6q-refoundation
STAGING_ENV_ID=fanshen002-d9g0rjr3b6e313af5 \
DEPLOY_CONFIRM=fanshen002-d9g0rjr3b6e313af5 \
bash rc814-staging/staging-infra/run-guarded-deploy.sh
#   ↑ 该脚本 preflight → deploy-guard → 仅部署 getChallengeEvent/startChallenge/submitChallengeChoice
#     若只想部署本函数，改用：
#     cd /tmp/rc814-deploy-ws && tcb fn deploy submitChallengeChoice -e fanshen002-d9g0rjr3b6e313af5
```

## 4. 部署后核验（READ-ONLY）

```bash
# 4.1 记录部署前后 sha256（index.js）
sha256sum cloudfunctions/submitChallengeChoice/index.js

# 4.2 远端修改时间应为新增（区别于基线 2026-10-14 22:17:51）
tcb fn detail submitChallengeChoice -e fanshen002-d9g0rjr3b6e313af5 | grep 修改时间

# 4.3 生产未动（mtime 应保持 2026-09-30 21:07:30）
tcb fn detail startChallenge -e fanshex-d2g0adgv7dfbc9bdc | grep 修改时间
```

## 5. 部署后功能验证（真实身份 = BLOCKED 项，需 owner 客户端）

- 真机：进入挑战 → 连续提交同一题两次（相同选择）→ 第二次应 `duplicate:true`、无重复计分；
  换选项重提 → 应 `409`。
- 并发真实身份用例（`test-client` 双发）→ 需绑定客户端；**agent 不代跑**（BLOCKED）。

## 6. 回滚方案

- 回滚 = 用基线 `471501b^` 的 `submitChallengeChoice/index.js` + `lib/response.js` 重新部署到 staging（同一门禁）。
- 该修复**未改数据结构**（无迁移），回滚无数据副作用。
- 生产始终不部署。

## 7. 边界

- 仅 staging 部署；生产只读。
- 不改三业务函数鉴权；不放开 DB 权限；不跳权益校验；不触发真实支付。
- 真实身份 / 密钥不入 Git。
