# 电商工具箱 · 营销海报制作 PRD

> **SSOT**：产品需求与实施对照。  
> **入口**：电商工具箱 → 品牌 → **海报制作** → `/brand/poster`  
> **toolKey**：`ecom-toolkit__poster`  
> **管理后台**：Book [`/admin/pending-features`](http://localhost:3000/admin/pending-features) · 待处理 **POST-001～POST-018**

---

## 1. 定位与边界

### 1.1 一句话

面向电商与商业运营的 **营销海报出图**：促销、上新、节日、直播预告、主图氛围等；支持 **傻瓜式最少输入** 与 **专业式全参数**；**图字分离**（默认无字底图 + 程序排版，可选字图同出）。

### 1.2 明确不做

- 独立子站、第四套会员/水印体系（计费沿用工具箱月费 + 积分/BYOK + Gateway）
- **账号级品牌 VI 配置库**（无「我的品牌库」表；品牌仅在单次创作中通过参考素材结合）
- 团队、子账号、权限角色
- V1 完整 Canva 级图层编辑器（局部重绘/贴纸库/PDF → Canvas 深链或 P2）

### 1.3 与站内其它能力

| 能力 | 关系 |
|------|------|
| 品牌 VI SOP `/brand/vi` | 上游产出可进资产库，海报 **导入使用** |
| IP 母版 `/brand/ip` | 同上 |
| 主图/详情 | 可选从资产库带入产品图与策略文案（P1 一键填文案） |
| 图片处理「AI海报生成器」 | **收敛**：主入口仅侧栏海报制作；印刷向可保留次级或跳转 |
| Canvas AI 海报画布 | 精修编排；本模块 **5 步内出营销海报** |

---

## 2. 设计原则

1. **单入口**：用户只认「海报制作」。  
2. **素材三源**：资产库导入、本地上传、剪贴板粘贴（`firstOrigin` 自动打标）。  
3. **品牌 = 创作时组合**：Logo / IP / VI 成图 / 色板参考位 + 显式开关「使用品牌参考」。  
4. **图字分离平台能力**：与 **爆款详情页套图** 共用 `@private/ecom-copy-overlay` + book-mall 合成 API；升级只改 shared + render。  
5. **生成必落库**：OSS + 参数/artifact 快照，支持复刻与只改字再合成。

---

## 3. 创作模式

### 3.1 档位

| 档位 | 说明 |
|------|------|
| **傻瓜式** | 最少上传/选择，系统补全策划、文案、无字 prompt、默认排版 |
| **专业式** | 文生 / 图生 / 模板 + 完整参数与模型选择 |

默认 Tab：**傻瓜出图**；可「用此方案进专业模式」。

### 3.2 傻瓜式路径

| 路径 | 最少输入 | 系统补全 |
|------|----------|----------|
| **A** | 模特 + 服装 + 场景（场景可空）+ 节日 | 融合场景、节日包、营销文案、无字底图、默认 overlay |
| **B** | 仅服装 + 可选节日 | 默认模特/场景、文案、无字底图 |
| **C** | 一句话活动需求 + 可选节日/尺寸 | 文生营销海报（极简 UI） |
| **D** | 节日 + 至少 1 项 VI/品牌资产 | 创意/品牌向海报（弱硬促销） |

### 3.3 专业式三引擎

- **文生营销海报**  
- **图生海报**（参考构图/风格 + 新文案）  
- **模板重构**（电商模板区 catalog，禁止前端硬编码列表）

### 3.4 节日选择器

大促、传统节日、店庆、日常上新/清仓、自定义；每节日绑定 **场景包**（视觉关键词、文案语气、合规 hint）。尺寸默认 **1:1 / 3:4 / 9:16**（各尺寸 **分别生成**，不承诺 AI 智能重排截字）。

---

## 4. 图字分离与程序化排版

### 4.1 两种出字策略（用户可选）

| 模式 | 默认 | 行为 |
|------|------|------|
| **字后加** | 推荐 | `burnCopyInImage: false`；出图 prompt 为 **无字摄影画面**；文案走 `EcomCopyOverlay` 服务端合成 |
| **字图同出** | 可选 | `burnCopyInImage: true`；prompt 注入文案；仍建议重要活动字后加 |

### 4.2 数据：`EcomCopyImageArtifact`（v1）

| 区块 | 字段 |
|------|------|
| copy | slotCopy, slotCopyAi |
| image | baseImageUrl, finalImageUrl, imagePrompt, negativePrompt |
| layout | EcomCopyOverlay（layers nx/ny/fontSize/color/…） |
| render | burnCopyInImage, exportWidthPx, aspectRatio |
| meta | sourceModule, composedAt, assetId |

### 4.3 UI：全屏排版与出图（用户可见）

**全屏弹层**（详情页套图 / 营销海报共用 `EcomCopyLayoutStudioDialog`）：

| 区域 | 内容 |
|------|------|
| 左侧 | 大画布：拖拽文案块；底图为无字成图；顶栏 **编辑排版 \| 合成预览** |
| 右侧 | 文案块列表、对齐/字号/颜色、**文字特效**（投影/外发光/描边/字底衬底）、无字 **出图提示词** |
| 底部 | **仅保存草稿** · **生成预览** · **保存并关闭** |

流程：**生成预览**（服务端烧字 PNG，与保存成图同一引擎）→ 切换 **合成预览** 核对 → **保存并关闭**（写回项目并刷新外层）。改字/改字底后预览会标记过期，需重新 **生成预览**。

**用户操作说明**：[`docs/电商品牌创作-使用说明.md`](./电商品牌创作-使用说明.md) §6。

---

## 5. 品牌结合（非账号库）

创作时参考位：Logo、IP 形象、VI 成图、色板截图、产品图、风格参考。开关 **「本次使用品牌参考」** 关闭时不参与生成。

---

## 6. 验收标准

1. 唯一入口 `/brand/poster` 可完成：傻瓜 C 或 B + 无字出图 + 合成带字成图。  
2. 素材：资产库 / 上传 / 粘贴均可用。  
3. 品牌参考开关有效。  
4. 改字再合成 **不触发** 新 Gateway 任务（除非用户重出底图）。  
5. 删除作品二次确认；涉 OSS 第二次说明云端。  
6. 模型选择走 Gateway 登记列表（`StoryboardModelPickerDialog`）。

---

## 7. 分期

| 阶段 | 内容 |
|------|------|
| P0 | Studio、傻瓜 B/C、专业文生、图字分离、作品入库 |
| P1 | 傻瓜 A/D、模板、批量 ZIP、Picker 品牌分组 |
| P2 | Logo 后合成、Canvas 深链 |

---

## 8. 管理后台待处理（POST-001～018）

与 [`book-mall/scripts/seed-admin-pending-features.ts`](../book-mall/scripts/seed-admin-pending-features.ts) 一致。

| ID | 标题 | 阶段 |
|----|------|------|
| POST-001 | 营销海报制作 · 总规格 | 文档 SSOT |
| POST-002 | EcomCopyImageArtifact 类型与 parse | 平台 |
| POST-003 | image-gen-copy-policy 抽离 | 平台 |
| POST-004 | EcomCopyLayoutStudioDialog + hit/canvas wrapper | 平台 |
| POST-005 | EcomPosterProject schema + 迁移 | 后端 |
| POST-006 | ecom-poster-service auto-plan/generate/compose | 后端 |
| POST-007 | SSO API poster/projects/* | 后端 |
| POST-008 | 电商 posterStyle + 节日场景包 | 规则 |
| POST-009 | 傻瓜式 A/B/C/D | 前端 |
| POST-010 | 专业式三引擎 + burnCopyInImage | 前端 |
| POST-011 | /brand/poster PosterStudio | 前端 |
| POST-012 | 排版弹层接入 | 前端 |
| POST-013 | 资产 Picker 品牌分组 + ref 三源 | 前端 |
| POST-014 | 作品/草稿 + workflow drafts | 资产 |
| POST-015 | 批量文案 ZIP | P1 |
| POST-016 | 收敛图片处理 AI 海报入口 | 产品 |
| POST-017 | Gateway clientPage + 价目 | 运维 |
| POST-018 | 单测 + schema-changelog + dev.md | 质量 |

---

## 10. 界面与持久化（现网）

| 项 | 行为 |
|----|------|
| 布局 | **左操作 / 右预览**（`PosterStepSection` 分步卡片）；宽屏右侧 sticky；页面 **左对齐**（非居中窄栏） |
| 生成态 | 「海报生成中…」在 **右侧「生成预览 · 排版与成图」** |
| 项目恢复 | `localStorage` `ecom-poster-active-project` + 最近项目 id；刷新 → 上次项目 / 列表首项 / 新建 |
| 自动保存 | 傻瓜路径、`brief.oneLineBrief` 等 **防抖 patch** 到 `EcomPosterProject` |
| 参考图 | `ecom-poster-ref-resolve` 按路径 A/B/C/D 与专业模式过滤 refs，避免无关图传入生图 |
| 生图路由 | 火山 **Seedream** 等经 `generateEcomImage` 专用分支 + `ensureCanvasVendorImageUrls`（避免误走万相导致 url error） |
| 模块文案 | **多文案块**：「+ 添加文案块」→ 每块独立内容/位置/字号/颜色；左侧点选拖拽；块内 Enter 仍可换行；合成渲染全部 `layers` |

**操作说明**：[`docs/电商品牌创作-使用说明.md`](./电商品牌创作-使用说明.md) §6。

---

## 9. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-10-03 | 整版重写：电商单入口、傻瓜/专业、图字分离平台能力；废弃独立平台 V2 / 账号 VI 库 PRD |
| 2026-10-03 | POST-001～018 落地：排版壳层收敛、专业三引擎+模型选择器+模板 catalog、export ZIP、clientPage=projectId |
| 2026-10-03 | §10：左右栏 UI、项目 localStorage、ref 过滤与 Seedream 路由；统一使用说明链到 `电商品牌创作-使用说明.md` |
