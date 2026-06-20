# QuickReplica（快速复制）· 实施计划

> **状态**：P0–P2 首版已落地  
> **产品说明**：[../product/quick-replica-platform.md](../product/quick-replica-platform.md)  
> **入口索引**：[../../../docs/quick-replica.md](../../../docs/quick-replica.md)  
> **创建**：2026-06-20

---

## 0. 目标摘要

| 维度 | 目标态 |
|------|--------|
| UI | 左 · 中 · 右三栏 + 底部分类 Tab（OpenArt 式） |
| 鉴权 | Book SSO + `tools_token`（`app=quick-replica`） |
| 首版范围 | P0 文档 + P1 只读框架 + P2 运动同步生成 |
| 数据 | `QrTemplate` JSON/DB 同构；Gateway 任务真源 |
| 计费 | 工具月费 `quick-replica` + Gateway BYOK |

---

## 1. 进度总表

| 阶段 | 说明 | 状态 |
|------|------|------|
| P0 | 设计文档 + 参考图索引 + 本计划 | ✅ |
| P1 | 只读三栏框架 + builtin 模板 | ✅ |
| P2 | 运动同步生成 + 用户模板 prepend + 平台登记 | ✅ |

---

## 2. P0 · 文档

| 任务 | 状态 |
|------|------|
| [docs/quick-replica.md](../../../docs/quick-replica.md) | ✅ |
| [product/quick-replica-platform.md](../product/quick-replica-platform.md) | ✅ |
| [docs/quick-replica/assets/README.md](../../../docs/quick-replica/assets/README.md) | ✅ |
| [quick-replica-web/doc/design.md](../../../quick-replica-web/doc/design.md) | ✅ |
| 本文档 | ✅ |

**验收**：三份文档互链；QrTemplate / API / 分类表完整。

---

## 3. P1 · 只读框架

| 任务 | 状态 |
|------|------|
| 新建 `quick-replica-web`（:3008、SSO、middleware） | ✅ |
| `content/templates/*.json` 种子（五类各 ≥3） | ✅ |
| GET `/api/templates`（builtin 只读） | ✅ |
| 三栏 UI：侧栏 / 底 Tab / 模板网格 / 中栏 reference | ✅ |
| 运动同步中栏骨架（无 Gateway） | ✅ |
| book-mall `quick-replica-open` + `platform-app-sso` | ✅ |

**验收**：登录后 `:3008` 三栏可见；切换分类正确；点模板中栏展示 reference。

---

## 4. P2 · 运动同步 + 平台登记

| 任务 | 状态 |
|------|------|
| Prisma `QrTemplate` + migration | ✅ |
| Platform API：templates / upload / jobs | ✅ |
| 运动同步：上传 + 选模型 + 生成 + 轮询 | ✅ |
| 成功写 user template，模板区 prepend | ✅ |
| `navKey` + `dev:all` + 架构文档 §2/§7 | ✅ |
| `ToolNavVisibility` + `ToolServiceFeePlan` 种子 | ✅ |
| Dockerfile + `deploy/tencent/*.env.example` | ✅ |

**验收**：运动同步全流程；Gateway 日志可查；新卡片置顶。

---

## 5. Backlog（首版不做）

- 唇语同步、编辑视频等置顶工具完整链路
- 特点/世界与 LibTV 资产库
- 公共模板发现页 / 审核发布
- CloudBase 生产部署与月费 SKU 配置
- 声音类 category 完整链路
