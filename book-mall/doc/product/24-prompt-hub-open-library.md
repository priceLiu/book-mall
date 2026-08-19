# 提示词库（Prompt Hub）· 全平台开放查阅方案

> **状态**：草案 · 待评审  
> **关联**：[prompt-optimizer-platform.md](./prompt-optimizer-platform.md) · [12-platform-app-federation.md](./12-platform-app-federation.md) · [docs/prompt-optimizer.md](../../../docs/prompt-optimizer.md)  
> **创建**：2026-08-19

---

## 1. 背景与目标

平台已积累大量生成用提示词（画布任务归档、电商模板、QuickReplica 模板等），但目前 **分散在各应用、默认私有**，用户无法统一浏览、复制，也无法一键跳转 **提示词优化器** 做二次优化。

**目标**：

1. 提供 **全平台可触达** 的提示词浏览页（查阅、搜索、复制）。
2. 支持与 **提示词优化器**（`:3006`）联动：选中 → 优化 → 带回业务应用使用。
3. 不自动公开用户私有 prompt；开放须 **显式发布 + 可选审核**。

---

## 2. 现状盘点（2026-08-19 生产库快照）

| 数据源 | 数量 | prompt 存储方式 | 默认可见性 |
|--------|------|-----------------|------------|
| Canvas 生成任务 `archivePromptText` | **2014** / 2033 任务 | 独立列 + `inputPayload` | 仅本人（画布「我的提示词」） |
| Canvas 项目 | **148** | 节点 JSON / 任务归档 | 按项目 |
| Canvas 用户模板 `CanvasPromptTemplate` | **0** 活跃 | 独立表 | 仅本人 |
| 电商模板 `EcomTemplateCatalogEntry.promptText` | **3** | 独立字段 | 平台 catalog |
| QuickReplica 模板 | **153** | 模板 JSON | 平台 catalog |
| Story 生成任务 | **31** | `inputPayload` | 按项目 |
| 提示词优化器收藏 | 未入 PG | 浏览器 IndexedDB | 仅本机 |
| 外部 Prompt Garden | 独立服务 | `garden.always200.com` | 公开（已通过 importCode 接入优化器） |

**结论**：有价值存量主要在 Canvas 归档（2014 条），但 **无统一公开库**；优化器与 Garden 的 import 协议已成熟，可复用。

---

## 3. 产品定位

**Prompt Hub（提示词库）** —  hosted 于 **book-mall**（SEO、统一域名、Platform API Single Writer）。

```text
运营精选 / 模板抽取 / 用户自愿发布
        ↓
  PlatformPromptEntry（PG）
        ↓
  /prompts 浏览 · 复制 · 搜索
        ↓
  「用优化器打开」→ prompt-optimizer（SSO + importCode / draftPrompt）
        ↓
  「带回 Canvas / 电商 / …」深链（Phase 2+）
```

与 **Prompt Garden** 关系：Hub 聚焦 **平台场景化**（影视 Pro2、电商、分镜等）；Garden 作外部灵感源，可镜像部分条目（遵守协议与 AGPL）。

---

## 4. 数据模型（建议）

```prisma
model PlatformPromptEntry {
  id              String    @id @default(cuid())
  slug            String    @unique
  title           String
  promptText      String    @db.Text
  negativePrompt  String?   @db.Text
  mediaKind       String    // TEXT | IMAGE | VIDEO
  sceneKey        String    // story-outline | ecom-product | image-edit | ...
  tags            String[]
  modelKey        String?
  exampleImages   Json?     // OSS URL 数组
  sourceType      String    // platform_seed | ecom_catalog | user_publish | garden_mirror
  sourceId        String?
  importCode      String?   @unique  // 兼容优化器，如 ZH-NB-001
  visibility      String    @default("public") // public | unlisted | private
  curatorUserId   String?
  useCount        Int       @default(0)
  publishedAt     DateTime?
  deletedAt       DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

**原则**：

- 正文入 PG；示例图入 OSS（见 `media-storage-oss-vs-db.mdc`）。
- 禁止从 Canvas 任务 **批量自动公开**；须用户「发布到提示词库」或运营人工精选。
- `importCode` + `/api/public/prompt-source/:code` 返回 **Prompt Garden v1 schema**（`prompt-garden.prompt.v1`），与现有优化器 `useAppPromptGardenImport` 对齐。

---

## 5. 页面与 API

| 层 | 路径 | 说明 |
|----|------|------|
| 公开列表 | `book-mall/app/prompts/page.tsx` | SSR · 分类 / 标签 / 搜索 / 分页 |
| 公开详情 | `book-mall/app/prompts/[slug]/page.tsx` | 全文 · 复制 · 示例图（统一 zoom-pan） |
| 公开 API | `GET /api/public/prompts` | 列表（可匿名） |
| 公开 API | `GET /api/public/prompt-source/:importCode` | 优化器拉取（Garden 契约） |
| 管理后台 | `book-mall/app/admin/prompt-library/` | 上架 / 审核 / 从模板导入 |
| 用户发布 | `POST /api/platform/prompts/publish` | 从 canvas archive 发布（默认 unlisted） |

**全站入口**：

- book-mall 顶栏 / 工具导航：「提示词库」
- 各子站侧栏同链：`https://book.ai-code8.com/prompts`（或 `MAIN_SITE_ORIGIN/prompts`）
- 与现有 `mainSitePromptOptimizerOpenHref` 并列

---

## 6. 与提示词优化器联动

### Phase A（MVP）

- 详情页：**复制** + **用优化器打开**
- 跳转：`/prompt-optimizer-open?path=/#/basic/user?importCode={code}`
- Book 提供 `GET /api/public/prompt-source/:code`

### Phase B

- 平台壳增加 `?draftPrompt=`（base64）或 `?draftId=`（Book 临时 token，24h）
- Hub 按钮「优化后再用」→ 预填工作区，无需先存收藏

### Phase C

- 「带回 Canvas / 电商」深链：`canvas-open?seedPrompt=…` / 粘贴到 Dock

**计费**：浏览/复制免费；优化器调用走 **工具月费**（`navKey: prompt-optimizer`）+ **Gateway BYOK**。

---

## 7. 冷启动内容

| 阶段 | 来源 | 规模 |
|------|------|------|
| T0 | `EcomTemplateCatalogEntry` + QR 有 prompt 的模板 | 数十条 |
| T1 | 运营从 Canvas `archivePromptText` 人工精选 | 50–100 条 |
| T2 | Prompt Garden 镜像（协议允许条目） | 按需 |
| T3 | 用户 UGC + 审核 | 持续增长 |

---

## 8. 实施分期

| 里程碑 | 交付 | 估时 |
|--------|------|------|
| **M1** | Schema + 管理 seed + `/prompts` 列表/详情 + 复制 | 1.5 周 |
| **M2** | `importCode` API + 优化器深链 + 全站导航 | 0.5 周 |
| **M3** | Canvas「发布到提示词库」+ 审核 | 1 周 |
| **M4** | `draftPrompt` 预填 + 带回业务应用 | 1 周 |
| **M5** | 搜索 / 热门 / useCount | 0.5 周 |

**合计约 4–5 周**（1 后端 + 1 前端；M1+M2 可先上线 MVP）。

---

## 9. 风险与对策

| 风险 | 对策 |
|------|------|
| 私人 prompt 误公开 | 默认不公开；发布二次确认 + 审核 |
| 与 Garden 重复 | Hub 强调平台场景；Garden 作外链灵感 |
| 优化器 AGPL | 网络服务须满足源码公开义务（已有 upstream 策略） |
| 超长 prompt | 列表截断；超 8k 字上传 OSS 存 URL |

---

## 10. 待决策项（评审用）

1. Hub 是否 **仅 book-mall**，或独立子站？
2. MVP 是否只做 **M1+M2**（只读 + 优化器），用户发布放 M3？
3. Canvas 归档 **2014 条** 是否由运营批量筛选 seed，还是等用户自发发布？
4. 是否与 Prompt Garden **双向同步**，还是单向镜像？

---

## 11. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-08-19 | 初稿：现状盘点 + 模型 + 分期 + 优化器联动 |
