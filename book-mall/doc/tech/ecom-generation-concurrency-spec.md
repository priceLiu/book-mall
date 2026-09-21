# 电商 / 工具站 · 生成并发规范

> **权威**：全站电商工具（详情页套图、产品详情页创作、手作、分镜、模特大片等）的 **批量出图、批量写提示词、批量 LLM** 并发上限。  
> **实现入口**：`book-mall/lib/ecom/ecom-image-gen-concurrency.ts`（`resolveEcomImageGenConcurrency` / `resolveEcomPromptGenConcurrency`）  
> **套餐来源**：`resolveVideoRiskLimits` → 个人 / 团队 Gateway 并发（会员档、团队席位数）

---

## 1. 原则

| 原则 | 说明 |
|------|------|
| **套餐优先** | 用户已购 **会员加速 · 高并发** 或 **团队席位并发** 时，使用 `resolveVideoRiskLimits` 返回的 `maxConcurrency`（封顶见下表） |
| **标准兜底** | 套餐 **未** 提供更高并发时，使用 **标准默认 2**，不得在前端/业务代码写死更大值 |
| **禁止页面自选** | 并发 **不由** 用户在 UI 下拉选择；由账户解析后下发给前端展示/限流 |
| **前后端一致** | 前端并行请求数 ≤ API 返回的 limit；服务端 `mapWithConcurrency` 使用同一 resolver |
| **写库安全** | 并发写提示词/出图结果时须 **merge 写回**（`prepareDetailPageSuitePatch` / `mergeDetailPageSuiteSlotPromptFromProject`），禁止裸覆盖 |

---

## 2. 标准默认 vs 套餐加成

| 能力 | 标准默认 | 套餐加成上限（cap） | 解析函数 |
|------|----------|---------------------|----------|
| 批量 **出图** | **2** | min(套餐 maxConcurrency, **5**) | `resolveEcomImageGenConcurrency` |
| 批量 **写提示词**（LLM） | **2** | min(套餐 maxConcurrency, **5**) | `resolveEcomPromptGenConcurrency` |
| 视频交通控 | 见 `video-risk-control.ts` | 团队席位数 / 个人 6 | `resolveVideoRiskLimits` |

**套餐 maxConcurrency 来源**（已有逻辑，本规范复用）：

- **个人**：`VIDEO_MAX_CONCURRENCY`（默认 6），经 cap 后用于电商出图/提示词 ≤ 5  
- **团队**：`Tenant.maxConcurrency`（随席位数，≥20 席保底 20），同样经 cap  
- **报价页文案**：「会员专享加速 · 高并发」= 更高 `maxConcurrency`；未包含该权益的档 **仅标准默认 2**

---

## 3. 各工具接入要求

| 工具 | 服务端 | 前端 |
|------|--------|------|
| 产品详情页创作 / 手作 | `resolveEcomImageGenConcurrency` + `mapWithConcurrency` | `models` API 返回 `imageGenConcurrencyLimit` |
| 分镜故事版 | 同上 | boot/models 下发 limit |
| **详情页套图** | 出图 + 提示词均走 resolver | `GET .../detail-page-suite/models` 返回双 limit |
| 模特大片 | 同上模式 | 同上 |

**禁止**：在 `image-gen.ts`、`prompt-llm` 路由、Studio 组件内写 `mapWithConcurrency(..., 4)` 等 magic number。

---

## 4. 详情页套图 · 交互语义

- **允许多点位同时「撰写提示词」与「出图」**（不同 slot 可并行），但 **同一 slot** 同时只能有一种 in-flight 任务  
- 单次批量勾选 N 条写提示词：并行数 = `promptGenConcurrencyLimit`（标准 2，套餐可更高）  
- 单次批量出图：服务端 `mapWithConcurrency` 使用 `imageGenConcurrencyLimit`  
- 无提示词的 slot 在 **出图点击时** 校验并提示，不在按钮 disabled 阶段按有无 prompt 拆分计数（见产品交互规范）

---

## 5. Code Review 清单

- [ ] 新增电商批量生成是否调用 `resolveEcom*Concurrency`  
- [ ] 是否避免硬编码并发 > 标准默认而未走 resolver  
- [ ] 前端并行 API 是否受 models/boot 下发的 limit 约束  
- [ ] 并发写库是否有 merge / snapshot 恢复  

---

## 6. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-09-18 | 初版：套餐并发 + 标准默认 2；详情页套图出图/写提示词接入 |
