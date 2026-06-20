# 火山视频 · EP 接入池（设计备忘）

> **状态**：待开发（本文档为架构结论，尚未实现）  
> **关联**：`book-mall/doc/tech/gateway-volcengine-architecture.md`、`book-mall/lib/gateway/volcengine-credential-pick.ts`

---

## 1. EP 是什么

**EP（Endpoint）** = 火山方舟控制台里的 **推理接入点 ID**，形如 `ep-20260604145826-rsvt7`。

| 概念 | 含义 |
|------|------|
| **API Key / 凭证** | `GatewayVendorCredential`：谁有权限调用、扣哪个账号 |
| **EP（modelKey）** | 走哪条推理管道/队列；请求里 `model: "ep-xxx"` 原样透传上游 |
| **逻辑模型** | 如 `doubao-seedance-2.0`：产品侧展示名，映射到上游 `doubao-seedance-2-0-260128` |

EP 与 API Key **不是同一层**：同一 Key 下可在控制台开多个 EP。

---

## 2. 结论：按凭证配置 EP，不用 env

**可以、且应该**在 Gateway **按凭证（Credential）** 配置 EP 列表，由系统自动建池选路。

**不要**继续用 `SBV1_VOLCENGINE_EP_MODELS` 等 env 注入 EP（当前 sbv1 的临时做法）。

### 2.1 挂点：Credential，不是 sk-gw 字符串

```
用户 sk-gw (GatewayApiKey)
  └─ 绑定 GatewayApiKeyCredential → 一条或多条 GatewayVendorCredential

GatewayVendorCredential（VOLCENGINE）
  └─ EP 列表（待建）：ep-1, ep-2, ep-3 …
```

- **EP 属于火山账号**（凭证里的 API Key），不是属于 sk-gw 本身。
- sk-gw 只决定 **能用哪些凭证**；EP 池挂在 **每条 VOLCENGINE 凭证** 上。
- 平台池：在「火山方舟」凭证上配 EP；BYOK 用户在自己的凭证上配 EP；**同一套 Gateway 控制台 UI**。

### 2.2 与「按 API Key 配置」的对应

| 说法 | 实现 |
|------|------|
| 按 sk-gw 配 EP | 不推荐直接绑 sk-gw；应绑 sk-gw 下的 **凭证** |
| 按 API Key 配 EP | **每条 `GatewayVendorCredential` 一份 EP 列表**（推荐） |
| 平台统一 | 平台凭证 alias「火山方舟」上维护 EP |
| sbv1 专用 | 凭证 alias「火山方舟 · 分镜视频1.0」上维护 EP（便于日志/统计隔离） |

**注意**：若两条凭证 **Key 值相同**，火山侧队列可能仍共享；alias 分离 **不会** 自动形成两条物理队列，但有利于路由策略与对账。

---

## 3. 目标数据模型（待实现）

推荐独立子表（示例）：

```text
GatewayCredentialVideoEndpoint
  credentialId   → GatewayVendorCredential.id
  epModelKey     → ep-xxxxxxxx（submit 时 model 字段）
  displayName    → 控制台展示
  poolGroup      → 如 seedance-2.0（与逻辑模型分组）
  sortOrder      → 手工优先级
  active         → 是否参与选池
```

全局 `GatewayModelRoute` / `VOLCENGINE_VIDEO_KNOWN_MODELS` 保留 **逻辑模型**（`doubao-seedance-2.0`）；具体 `ep-*` 由 **凭证级配置** 提供。

---

## 4. 运行时选路（待实现）

**仅在 `createTask` submit 时选 EP**；poll 必须用同一 `credentialId` + `externalTaskId`，**不可中途换 EP**。

```text
createTask
  ① pickVolcengineCredentialForGatewayJob（现有：alias / gatewayCredentialId）
  ② pickVolcengineEpFromPool（新增：credentialId + poolGroup → ep-*）
  ③ volcengineCreateVideoTask(model=ep-xxx)
  ④ GatewayRequestLog 记录 credentialId + 实际 model（ep-*）
```

选池策略：**least-queue**（近 7 天各 EP 的 queue P50），样本不足时 fallback `sortOrder`；**不要** blind round-robin。

产品侧建议提供：

- **Seedance 2.0 · 自动**（默认）：后台解析到当前最空 EP  
- **指定 ep-xxx**（高级）：固定接入点，不进池  

---

## 5. 排队统计（与 EP 池配套）

已有单任务 `queueMs`（Gateway 日志 Queue 列）。待做：

- 按 `model`（含各 `ep-*`）聚合近 7 天成功任务的 P50/P75 queue  
- **n ≥ 100** 才对用户展示「预计排队约 X 分钟」  
- 为 EP 池 `least-queue` 提供信号  

统计 **不缩短** 火山 Queue，但改善预期与选路依据。

---

## 6. 与现有机制的关系

| 机制 | 作用 | 与 EP 池关系 |
|------|------|----------------|
| `GenerationTrafficState` 控流 | 平台何时 submit | 互补：控流减撞墙，EP 池减单点热点 |
| 凭证 alias 轮询 | 无 | 同 Key 多 alias **无收益** |
| env `SBV1_VOLCENGINE_EP_MODELS` | sbv1 临时挂 EP | **迁移到凭证 EP 表后删除** |
| Poll 并发 | 加快发现完成 | **不缩短** Queue |

---

## 7. 实施顺序（建议）

1. **凭证级 EP 配置**（Gateway UI + DB）— 替换 env  
2. **Provider 列表读 DB** — Canvas/sbv1 展示已配 EP  
3. **排队统计 API** — 按 ep 聚合 queueMs  
4. **auto 池 + least-queue** — createTask 解析逻辑模型 → ep  
5. （可选）虚拟 modelKey `doubao-seedance-2.0-auto`  

---

## 8. 验收标准（草案）

- [ ] VOLCENGINE 凭证编辑页可增删改 EP，无需改 env /  redeploy  
- [ ] submit 日志含 `credentialId` + 实际 `ep-*`  
- [ ] 用户选「自动」时系统从该凭证 EP 池选路  
- [ ] BYOK 仅能看到/使用自己凭证下的 EP  
- [ ] 禁用某 EP 后池子自动排除  
- [ ] n≥100 时生成中可展示预计排队（可选 Phase）

---

## 9. 相关文件（现状）

| 文件 | 说明 |
|------|------|
| `book-mall/lib/gateway/volcengine-credential-pick.ts` | 凭证 alias 路由 |
| `book-mall/lib/canvas/canvas-gateway-providers.ts` | 临时 `SBV1_VOLCENGINE_EP_MODELS` |
| `book-mall/lib/gateway/log-volcengine-timing.ts` | queueMs / generateMs |
| `book-mall/lib/gateway/volcengine-jobs.ts` | submit + poll |
| `gateway-web/components/model-manager/` | 凭证编辑 UI（待扩展 EP 区块） |
