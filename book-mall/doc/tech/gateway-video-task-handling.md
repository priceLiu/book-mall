# Gateway · 视频生成任务处理（火山 Seedance / 异步 createTask）

> **代码真源**：`book-mall/lib/gateway/gateway-submit-error-policy.ts`  
> **提交实现**：`volcengine-jobs.ts` → `POST /api/gw/v1/jobs/createTask`  
> **后台生成**：`video-background-generation.ts`、`volcengine-background-promote.ts`  
> **恢复误杀**：`volcengine-stall-recover.ts`  
> **轮询 / 收口**：`poll-service.ts`、`log-volcengine-timing.ts`  
> **关联架构**：[`gateway-volcengine-architecture.md`](./gateway-volcengine-architecture.md)

---

## 1. 两类「失败」为什么会发生？

### 1.1 厂商 HTTP 拒绝（400 内容安全 / 参数 / 模型不存在）

**链路：**

```text
createRequestLog(RUNNING)
  → POST ark.../contents/generations/tasks
  → 火山返回 4xx（未创建 taskId）
  → classifyGatewaySubmitError
  → finalize FAILED（约 0～5s，立即回复，不阻塞）
```

**常见原因：**

| failCode | 厂商表现 | 说明 |
|----------|----------|------|
| `CONTENT_POLICY` | 400 + sensitive / 内容安全 | 提示词或参考图触发审核，**改内容才会成功** |
| `INVALID_INPUT` | 400 其它 | 比例、content 结构、参考图数量等不符合 API |
| `MODEL_NOT_FOUND` | 404 | modelKey / ep 接入点不存在或未授权 |
| `UPSTREAM_AUTH_FAILED` | 401 / 403 | 凭证、baseUrl、权限错误 |

**不是 Gateway bug**：厂商在 **accept 任务之前** 就拒绝了；Duration 通常 **≤ 数秒**，`Vendor Task ID` 为 **—**。

---

### 1.2 5 分钟仍无 taskId（`SUBMIT_ORPHAN`）

**链路：**

```text
createRequestLog(RUNNING)   ← 日志已创建
  → volcengineCreateVideoTask 未在 5min 内返回 taskId
  → externalTaskId 一直为 null
  → expireStaleGatewayLogs 收口 → failCode=SUBMIT_ORPHAN
```

**策略不变**：无 taskId **不等待**，按现有 failMessage 立即/超时收口；**不做 6× 盲重试**。

---

## 2. 统一错误策略（submit 阶段）

模块：**`gateway-submit-error-policy.ts`**

| API | 用途 |
|-----|------|
| `classifyGatewaySubmitError(e)` | 分类 + failCode + 是否可重试 |
| `runGatewaySubmitWithRetry(fn)` | **仅 TRANSIENT**（429、5xx、网络）退避重试 |
| `buildSubmitFailureFinalizePayload(e)` | 写日志统一 payload |
| `SUBMIT_ORPHAN_FAIL` | 无 taskId 超时常量 |

**重试策略：**

- `NON_RETRYABLE`：**0 次额外等待**，立即失败。
- `TRANSIENT`：最多 **3 次**，间隔 **2s / 5s / 10s**（非阻塞 HTTP）。
- `UNKNOWN`：不重试。

---

## 3. 生成阶段（已有 taskId 之后）· 准则

### 3.1 核心原则

| 原则 | 说明 |
|------|------|
| **仅 vendor fail 才 FAILED** | poll 返回 `failed` / `cancelled` → `VOLCENGINE_TASK_FAILED` |
| **≥10min 转后台** | 仍 `RUNNING`，释放交通槽，**继续 poll**；UI 文案「持续后台生成中…」 |
| **不因 updated_at 不动而失败** | Seedance 常见 `running` 且 `updated_at` 冻结；**不是**厂商断连 |
| **90min 硬超时** | 仍 `STALE_TIMEOUT`（真正过长仍 RUNNING） |
| **非阻塞** | 所有 HTTP / 读道快速返回；推进靠 poll worker + 客户端 5s 读任务 |

### 3.2 时间线（有 taskId）

```text
0～10min     节点「视频生成中…」· Gateway RUNNING · 占交通槽
≥10min       promoteVolcengineTasksToBackgroundGeneration
             → resultSummary._gateway.backgroundGeneration.slotReleased=true
             → 释放交通槽 · 仍 RUNNING · 继续 poll
             → Canvas 右下角「后台视频」面板 · 节点「持续后台生成中…」
vendor succeeded → finalize SUCCEEDED · 通知用户 · 加载到节点
vendor failed    → VOLCENGINE_TASK_FAILED
90min 仍 RUNNING → STALE_TIMEOUT
```

### 3.3 failCode（生成阶段）

| failCode | 何时 | 用户可见 |
|----------|------|----------|
| `VOLCENGINE_TASK_FAILED` | 厂商 poll 返回 failed | 真失败 |
| `STALE_TIMEOUT` | 90min 仍 RUNNING | 真超时 |
| `VOLCENGINE_GATEWAY_POLL_STALL` | **仅历史误杀**（旧版） | 失败 Tab「厂商复核恢复」· 画布右下角「加载到节点」 |
| `VOLCENGINE_QUEUED_STALE` | queued 10min 无进展 | 仍立即失败（与 running 后台策略区分） |

### 3.4 文案（对用户）

| 场景 | 文案 |
|------|------|
| 0～10min 生成中 | `视频生成中…` |
| ≥10min 后台 | `持续后台生成中…` + 「可先处理其他内容；成片后将通知您加载到节点」 |
| 历史误杀可恢复 | 「厂商侧可能已出片，请点击加载到节点」 |
| 无 taskId submit 失败 | 保持现有 failMessage，**不改动** |

### 3.5 恢复入口

| 入口 | 路径 |
|------|------|
| 画布右下角 | `GET/POST /api/canvas/projects/:id/background-video-tasks` |
| Gateway 失败 Tab | `POST /api/gateway/logs/:id/recover`（`VOLCENGINE_GATEWAY_POLL_STALL`） |
| 轮询池 | Gateway FAILED stall → 「恢复」 |
| 后台自动 | `recoverMisclassifiedVolcengineStallLogs`（poll worker 每轮） |

**查厂商任务请用 Vendor Task（`cgt-…` / `externalTaskId`），不是 Request ID（`0217…`）。**

---

## 4. Canvas 集成

- **节点 UI**：`use-video-generating-wait.ts` · ≥10min → 持续后台生成中
- **项目面板**：`canvas-background-video-panel.tsx` · 右下角列表 + 「加载到节点」
- **通知**：`canvas-notify` · 可恢复误杀 / 加载成功
- **poll**：`canvas-task-service` · Gateway stall FAILED **不**立刻 fail Canvas，先 vendor 复核

---

## 5. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-22 | **停更不再判失败**：≥10min 转持续后台生成；仅 vendor fail 才 FAILED；误杀恢复入口 |
| 2026-06-22 | Canvas 10min 后台 UI、Gateway 后台等待 Tab/ badge、轮询池后台筛选 |
| 2026-06-22 | 初版：错误分类、SUBMIT_ORPHAN、重试策略 |
