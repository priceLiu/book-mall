# 我的 AI 空间

> **状态**：设计稿（待评审 → 分期实施）  
> **创建**：2026-08-14  
> **关联**：  
> - [12-platform-app-federation.md](./12-platform-app-federation.md)  
> - [14-tenant-team-design.md](./14-tenant-team-design.md)  
> - [16-project-assets-unified-design.md](./16-project-assets-unified-design.md)  
> - [quick-replica-platform.md](./quick-replica-platform.md)  
> - [04-user-center.md](./04-user-center.md)  
> - 数字人带货合成规格：[../数字人.md](../数字人.md)

---

## 1. 产品定位

**我的 AI 空间**是 Book **个人中心**下的跨应用创作展示与编排入口，隐喻 QQ 空间「布置自己的房间」：

| 隐喻 | 产品含义 |
|------|----------|
| 房间墙面 | 用户主动 **钉选（Pin）** 要展示的作品 |
| 相册 / 仓库 | 各应用内的 **真实数据**（库表 + OSS） |
| 点照片进详情 | 深链回 **原应用工作流** 继续编辑 |
| 好友来访 | **预留**：关注空间、收藏作品（二期） |

### 1.1 与现有「空间」概念的区分

| 名词 | 含义 | 关系 |
|------|------|------|
| **Tenant 个人空间** | 计费与资源归属（`TenantType.PERSONAL`） | 资产仍归属租户；AI 空间是 **展示层** |
| **StorySpace** | Story 漫剧专属对外主页（slug + Product） | **不合并**；可 Pin Story 成片 |
| **各应用「我的资产/库」** | 电商 library、工具站图片/视频库、画布项目等 | **数据源**；AI 空间不替代 |
| **我的 AI 空间** | Book 个人中心 · 跨应用 Pin + 数字人创作台 | **本文件** |

### 1.2 核心原则（强制）

1. **空间只做指针，不复制业务数据**  
   - Pin 表仅存 `(sourceApp, sourceType, sourceId, sortOrder, visibility)`。  
   - 展示字段（缩略图、prompt、时长等）**实时 resolve 源记录**，禁止在 Pin 表冗余 OSS URL / prompt。

2. **入库 = 用户主动 Pin**  
   - 各应用完成品默认 **不** 自动进入空间。  
   - 用户在各应用点「展示到我的 AI 空间」或在空间内「从库中选择钉选」。

3. **删除源作品 → 级联移除 Pin，事前告知**  
   - 删库/删项目前检测 Pin；二次确认文案写明：**个人空间中的展示将一并移除**（涉及 OSS 时沿用 `destructive-delete-confirmation.mdc`）。  
   - 删源事务内 `deleteMany` 关联 Pin；**不**维护 dangling pin、**不**做展示快照兜底。

4. **创作与 AI 调用走 Gateway**  
   - 数字人 S2V、TTS、FFmpeg 合成等厂商能力经 Gateway + 用户 `sk-gw`（见 `gateway-platform-vendor-credentials.mdc`）。  
   - **禁止**在业务 `.env` 追加厂商 Key 作为默认路径。

5. **联邦架构**  
   - Book 提供 Platform API + 个人中心 UI；子应用保留编辑器；跨域打开经 SSO re-enter + `WorkflowLaunchSpec` 深链。

### 1.3 平台共享素材：数字人与音频（Book 真源 · 全应用引用）

> **独立需求点**（2026-08-14 补充）：数字人形象与口播音频不仅是 AI 空间合成台的选材，而是 **全站各应用项目均可引用的平台级素材**。

| 维度 | 作品墙 Pin | 数字人 / 音频 |
|------|------------|----------------|
| 性质 | **展示指针**（不存业务数据） | **平台真源**（OSS + 元数据在 book-mall） |
| 存放 | `AiSpacePin` 仅 `(sourceType, sourceId)` | `DigitalHuman`、`AiSpaceAudioAsset` 等业务表 |
| 管理入口 | 布置顺序、取消展示 | **我的 AI 空间** Tab（上传 / TTS / 克隆 / 命名） |
| 跨应用 | 深链回 **原应用成品** | 各项目 **引用 ID**，不复制音频/照片 |

**为何放在 Book（个人中心 · 我的 AI 空间）**

1. **全应用共用**：电商数字人口播、种草视频 TTS、画布节点、Story 角色音、QuickReplica 工作区、工具站项目等，均需同一套形象与口播；若分散在各应用库会造成重复上传与音色不一致。  
2. **符合「布置房间」**：数字人 = 房间里的「形象摆件」，音频 = 「留声机/台词卡」——在 AI 空间集中创建与管理，各应用按需 **@ 引用**，而非各应用各建一套。  
3. **平台 Single Writer**：数据只在 book-mall PostgreSQL + OSS；子应用 **禁止**自建平行 `DigitalHuman` / `Audios` 表（QuickReplica 生成结果 **写入** Book 统一表，见 §4.2）。  
4. **联邦一致**：子应用经 SSO Platform API **只读/选用**；创建与删除在 Book；Gateway 调用仍走 Book 编排。

**引用模型（禁止复制 OSS）**

各应用在项目 JSON / 任务入参中仅存：

```typescript
// 示例：任意子应用项目 meta
{
  digitalHumanId?: string;   // → GET /api/platform/ai-space/digital-humans/:id
  audioAssetId?: string;     // → GET /api/platform/ai-space/audio-assets/:id
}
```

生成时 Book 或子应用 BFF **resolve** 出 `avatarImageUrl` / `audioUrl` 再调 Gateway；**不**把 URL 固化复制到第二份业务表（除非该应用已有独立成片库条目，那是 **输出** 而非 **素材引用**）。

**删除与引用检测**

与 Pin cascade 类似：删除数字人或音频前，检测 **跨应用引用**（项目 meta、合成任务、进行中的生成任务）；二次确认文案须含 **「引用该素材的项目可能无法正常生成」**；确认后删源（不做素材快照）。

**团队空间**：数字人 / 音频带 `tenantId` + `AssetVisibility`（PRIVATE / TEAM_PUBLIC）；团队 PUBLIC 素材全队项目可选用，与 [14-tenant-team-design.md](./14-tenant-team-design.md) 一致。

---

## 2. 信息架构（个人中心）

```
/account/ai-space                    # 我的 AI 空间（Book 个人中心新入口）
├── 作品墙（Pin 网格）                 # 跨应用已 Pin 的成片 / 项目包
├── 数字人库                         # §4.1 · 见 ../数字人.md
├── 音频库                           # §4.2 · 与 QuickReplica 音频统一
├── 视频创作库                       # §4.3 · 分类 + 各应用已发布视频 + 用户上传
├── 视频合成台                       # §4.4 · 数字人 + 音频 + 背景视频 → 成片
└── [预留] 关注 / 收藏 / 公开主页 slug
```

**导航**：在 `account-nav-menu-config` 增加链接「我的 AI 空间」（与「应用」分组并列或独立「创作」分组）。

---

## 3. 数据模型

### 3.1 AiSpacePin（空间钉选 · 仅指针）

```prisma
model AiSpacePin {
  id           String   @id @default(cuid())
  userId       String
  tenantId     String?  // 与 active tenant 一致，便于团队上下文过滤

  /// 源应用：e-commerce-toolkit | canvas-web | tool-web | story-web | quick-replica | ai-space
  sourceApp    String
  /// 源类型：ecom_asset | canvas_project | t2i_library | qr_template | ai_space_video | …
  sourceType   String
  sourceId     String

  sortOrder    Int      @default(0)
  /// 第一版：SPACE_PRIVATE；二期：SPACE_PUBLIC（访客可见）
  visibility   String   @default("SPACE_PRIVATE")
  pinnedAt     DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, sourceType, sourceId])
  @@index([userId, sortOrder])
  @@index([sourceType, sourceId])
}
```

**禁止字段**：`prompt`、`ossUrl`、`thumbnailUrl`、`title` 等业务副本。

### 3.2 展示聚合（读时 resolve）

Platform API：`GET /api/platform/ai-space/entries`  

1. 查当前用户 Pin 列表（分页 + `sortOrder`）。  
2. 按 `sourceType` 批量调用已有 service（`listEcomLibrarySections`、`QrTemplate`、画布项目等）组装 DTO。  
3. 源记录不存在 → 不返回该 Pin（理论上不应出现，因删源已 cascade）。

### 3.3 深链（WorkflowLaunchSpec）

Pin 卡片点击「继续创作 / 打开工作流」时，Book 不内嵌编辑器，而是：

```typescript
type WorkflowLaunchSpec = {
  app: string;           // navKey / 子站标识
  path: string;          // 子站路由
  mode: "open_project" | "reuse_snapshot" | "open_studio";
  projectId?: string;
  snapshotSavedAt?: string;
  sessionStorageKey?: string;
  query?: Record<string, string>;
};
```

经 SSO re-enter → 子站 callback 读取 launch 参数。电商已有先例（`sessionStorage` + `reuseStoryboardProject`）。

### 3.4 删除一致性

| 动作 | 行为 |
|------|------|
| 用户在各应用 **删除源作品** | 删前 `GET .../pins/check?sourceType=&sourceId=`；确认文案含「个人空间展示一并移除」；删源 + cascade Pin |
| 用户在空间 **取消展示** | 仅 `DELETE` Pin，**不**删源 |
| 管理员 / OSS 清理 | 同 cascade 规则 |

### 3.5 平台共享素材表（Book 真源 · 非 Pin）

数字人 / 音频 **不是** Pin；为 book-mall 业务表，供 §1.3 全应用引用。

```prisma
model DigitalHuman {
  id              String          @id @default(cuid())
  userId          String
  tenantId        String?
  ownerUserId     String?
  visibility      AssetVisibility @default(PRIVATE)
  name            String
  avatarImageUrl  String          @db.Text
  status          String          @default("active") // active | inactive | detect_failed
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@index([userId, createdAt])
  @@index([tenantId, visibility, createdAt])
}

// AiSpaceAudioAsset 见 §4.2
```

子应用项目内 **仅保存 FK**（`digitalHumanId` / `audioAssetId`）；禁止在各应用库表重复 `audioUrl` / `avatarImageUrl` 作为素材真源。

---

## 4. 创作台四模块（含数字人规格整合）

以下四模块 **UI 聚合在「我的 AI 空间」**，**数据仍各存其表**；空间层不复制媒体。  
数字人流水线业务细节以 [../数字人.md](../数字人.md) 为 **能力规格**，落地时须按 §5 改造为 Book Platform API + Gateway。

### 4.1 数字人库

**来源文档**：[../数字人.md](../数字人.md) §3.1、§4.1  

**平台定位**（见 §1.3）：Book **真源**；AI 空间为 **管理 + 布置入口**；电商 / 画布 / Story / 工具站 / QuickReplica 等项目 **引用 `digitalHumanId`**。

| 项 | 规格摘要 | AI 空间 / Book 职责 |
|----|----------|---------------------|
| 实体 | `DigitalHuman`：name、avatar_image_url、status | CRUD 在 book-mall；**唯一**数字人表 |
| 上传 | 正面单人照 jpg/png，400–7000px | OSS + wan2.2-s2v-detect（Gateway） |
| 跨应用引用 | 项目 meta 存 `digitalHumanId` | Platform API 列表/详情；子应用 **选用器**（见 §6.1） |
| 合成台 | §4.4 选材 | 与跨应用引用 **同一数据源** |
| 布置 | 可选 Pin 形象或成片到作品墙 | Pin 仍是指针；形象本身不是 Pin |

**与 Pin 关系**：数字人 **形象** 是平台素材，默认 **不** Pin；用户可将「数字人成片」Pin 到作品墙（`sourceType=compose_output` 等）。

### 4.2 音频库（与 QuickReplica 整合 · Book 真源）

**平台定位**（见 §1.3）：与数字人相同——**Book 统一音频表**，全应用项目引用 `audioAssetId`；QuickReplica 为 **创作入口之一**，不是第二套音频库。

**现状**

| 来源 | 存储 | 能力 |
|------|------|------|
| [../数字人.md](../数字人.md) | 规划 `Audios` 表 | 本地上传 MP3/WAV；CosyVoice TTS；`text_script`；**时长 &lt; 20s**（S2V 限制） |
| [quick-replica-platform.md](./quick-replica-platform.md) | `QrTemplate`（`category: audio`）+ `GatewayRequestLog` | 文本转语音、声音克隆、情感控制；`POST .../assets/upload` kind=audio |

**整合原则：一套音频资产表，两路写入**

```prisma
/// 平台统一音频资产（真源）
model AiSpaceAudioAsset {
  id           String   @id @default(cuid())
  userId       String
  tenantId     String?
  name         String
  sourceType   String   // upload | tts | voice_clone
  audioUrl     String   @db.Text
  durationSec  Float
  textScript   String?  @db.Text
  /// 溯源：quick-replica job / 空间内 TTS
  originApp    String?  // quick-replica | ai-space
  originRef    String?  // qrTemplateId | gatewayRequestLogId
  meta         Json?
  createdAt    DateTime @default(now())

  @@index([userId, createdAt])
}
```

| 路径 | 行为 |
|------|------|
| QuickReplica 生成音频 | 写入 `AiSpaceAudioAsset` + 可选 `QrTemplate` **引用同一 audioUrl**（不双存 OSS） |
| AI 空间 · 音频库 | 列表读 `AiSpaceAudioAsset`；支持上传 / TTS（复用 QR 的 Gateway 模型与 `qr-text-to-audio` 能力） |
| **各应用项目** | 选用器绑定 `audioAssetId`；生成前 resolve URL + 校验时长等业务规则 |
| 数字人合成台选音频 | 只读 `AiSpaceAudioAsset`；校验 `durationSec < 20` |

**UI**：AI 空间「音频库」Tab（Book 个人中心）；各子应用挂载 **统一选用器**（§6.1），可跳转「在 AI 空间管理」。

**Pin**：用户可将某条音频 Pin 到作品墙（播放预览 + 台词文本）；仍是指针 `sourceType=ai_space_audio`。**Pin 与项目引用独立**：取消 Pin 不影响项目内引用；删除音频则两者皆失效（见 §1.3 删除检测）。

### 4.3 视频创作库

**定位**：按 **分类** 浏览可用于合成的 **背景/素材视频**，来源三类：

| 来源 | 说明 | sourceType 示例 |
|------|------|-----------------|
| **各应用已 Pin / 已发布视频** | 电商 `EcomAsset`（video 模块）、工具站 `ImageToVideoLibraryItem`、画布视频库、Story 分镜视频、QR 视频 output 等 | `ecom_asset`、`i2v_library`、`canvas_video`… |
| **用户上传** | 用户自拍/拍产品背景视频 MP4/MOV | `ai_space_video_upload` |
| **平台分类** | 系统标签：带货、穿搭、产品展示、口播背景…（可运营配置） | 存 `category` 字段，非新 OSS |

**数据**

```prisma
model AiSpaceVideoMaterial {
  id           String   @id @default(cuid())
  userId       String
  tenantId     String?
  name         String
  category     String   // 用户可选/可改；默认 uncategorized
  videoUrl     String   @db.Text
  durationSec  Float
  /// upload | app_ref
  sourceKind   String
  /// app_ref 时指向原记录，避免双份 OSS
  originApp    String?
  originType   String?
  originId     String?
  createdAt    DateTime @default(now())

  @@index([userId, category, createdAt])
}
```

**与 Pin 的关系**

- 各应用 **已发布到 AI 空间的作品**（Pin）可在「视频创作库」中 **按分类聚合展示**（resolve Pin → 过滤 kind=video）。  
- **用户上传** 写入 `AiSpaceVideoMaterial`，不自动 Pin；用户可选 Pin 到作品墙。  
- **禁止**：从电商库 **复制** videoUrl 到新表；`app_ref` 行只存指针，展示时 resolve。

**分类建议（v1）**

| category | 含义 |
|----------|------|
| `product` | 产品展示 / 带货背景 |
| `outfit` | 穿搭 / 模特走动 |
| `lifestyle` | 生活场景 |
| `upload` | 用户上传默认类 |
| `from-app` | 来自各应用 Pin（子标签用 module 名） |

### 4.4 视频合成台（创作台）

**来源文档**：[../数字人.md](../数字人.md) §3.4、§4.4  

**交互**：在 AI 空间内三步选素材 → 一键合成：

```
[数字人库] 选形象  +  [音频库] 选口播  +  [视频创作库] 选背景
                        ↓
              POST /api/platform/ai-space/compose
                        ↓
         wan2.2-s2v（Gateway 队列，并发=1）→ FFmpeg 画中画 → OSS 成片
                        ↓
              写入合成结果（见下）→ 可选 Pin 到作品墙
```

**任务表**（真源，非 Pin 副本）：

```prisma
model AiSpaceComposeTask {
  id                 String   @id @default(cuid())
  userId             String
  digitalHumanId     String
  audioAssetId       String
  videoMaterialId    String
  status             String   // pending | generating_human | composing | completed | failed
  tempHumanVideoUrl  String?  @db.Text
  finalVideoUrl      String?  @db.Text
  errorMessage       String?  @db.Text
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
```

**合成成片** 完成后：

1. 可写入 `AiSpaceVideoMaterial`（`sourceKind=compose_output`）或独立 `EcomAsset` module（若同步进电商库）。  
2. 用户点「展示到空间」→ 创建 Pin 指向该结果记录。

**技术约束**（摘自数字人文档，实施时必须遵守）：

| 约束 | 处理 |
|------|------|
| 音频 &lt; 20s | 合成前校验 `AiSpaceAudioAsset.durationSec` |
| S2V 并发 = 1 | Book 侧任务队列（Bull/DB 锁），多用户排队 |
| 阿里云结果 URL 24h | 及时转存 OSS |
| 背景短于口播 | FFmpeg `stream_loop` |
| 临时文件 | 合成后清理 `/temp/{taskId}/` |
| OSS 拉取 | 服务端下载到本地再 FFmpeg；不假设 Bucket 公网读（与现网 OSS 规范一致） |

**Provider 抽象**（数字人文档 §6）：预留 `IVideoProvider` / `ITTSProvider`；v1 阿里云，v2 可接 MiniMax（仍经 Gateway）。

---

## 5. 对 [../数字人.md](../数字人.md) 的评估与改造清单

原稿为 **独立 Express + SQLite + 直连阿里云** 的交付规格，与现网 **Book 平台联邦 + PostgreSQL + Gateway** 存在差距。结论：**业务逻辑可采纳，工程形态必须改造**。

| 原稿项 | 评估 | 目标态 |
|--------|------|--------|
| 独立 Express 服务 | ❌ 与 monorepo 分裂 | book-mall Platform API `/api/platform/ai-space/*` |
| SQLite | ❌ | PostgreSQL + Prisma 迁移 |
| 直连 DashScope Key | ❌ | Gateway + `resolveGatewayAuthForBookUser` |
| 4 表（DigitalHuman / Audio / VideoMaterial / ComposeTask） | ✅ 语义保留 | Audio 合并为 §4.2 `AiSpaceAudioAsset`；VideoMaterial 合并 §4.3 |
| FFmpeg 云端合成 | ✅ | 独立 worker 或 book-mall 后台 job（与 canvas 媒体管线对齐） |
| 20s / 队列 / 临时目录 | ✅ 必须保留 | 写入合成 service 与 UI 校验 |
| CosyVoice TTS | ✅ | 与 QuickReplica 音频共用 Gateway 模型；**不单开第二套 TTS UI** |
| MiniMax 预留 | ✅ 二期 | Provider 接口 + Gateway 登记 |

**与「我的 AI 空间」关系**：数字人文档描述的是 **AI 空间内的「创作台」能力**，不是第六套独立产品；入口统一在 `/account/ai-space`，数据真源在 book-mall，展示层用 Pin 指向成片。

---

## 6. 与各应用的关系

### 6.1 全应用引用：数字人 / 音频选用器

子应用 **不** 维护本地数字人/音频列表；统一调用 Book Platform API（Bearer `tools_token` 或 Book 会话）：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/platform/ai-space/digital-humans` | 当前租户可见列表（含缩略图、status） |
| GET | `/api/platform/ai-space/digital-humans/:id` | 详情（供生成 resolve） |
| GET | `/api/platform/ai-space/audio-assets` | 音频列表（含 durationSec、textScript 摘要） |
| GET | `/api/platform/ai-space/audio-assets/:id` | 详情 |
| GET | `/api/platform/ai-space/refs/check` | 删素材前：哪些项目/任务仍引用 |

**前端**：各应用复用统一选用 Dialog（类似 `EcomAssetPickerDialog` / `@` mention 模式），数据源仅为上述 API。  
**BFF**：子站 `/api/book-mall/platform/ai-space/*` 代理，与现联邦模式一致。

**典型引用场景**

| 应用 | 引用方式 |
|------|----------|
| 电商工具箱 | 数字人口播 / 口播带货模块：`digitalHumanId` + `audioAssetId` |
| 种草视频 | 分镜 TTS 轨：`audioAssetId` 或现场 TTS 后写入 Book 再引用 |
| 画布 Pro2 / sbv1 | 节点 `meta.digitalHumanId` / 口播音频槽 |
| Story | 角色配音、分镜口播引用 `audioAssetId` |
| QuickReplica | 生成写入 Book；workspace **选用已有** 音频而非仅本地态 |
| 工具站 | 图生视频口播、数字人相关 tool 引用同一 ID |
| AI 空间 · 合成台 | 同上 ID，无特殊分支 |

### 6.2 作品 Pin 与各应用库

| 应用 | 数据源 | Pin 入口 | 深链 | 数字人/音频 |
|------|--------|----------|------|-------------|
| 电商工具箱 | `EcomAsset`、`*Project` | library / 项目页「展示到 AI 空间」 | 已有 reuse + sessionStorage | 项目 meta 引用 Book ID |
| 工具站 | `TextToImageLibraryItem`、`ImageToVideoLibraryItem` | 库条目操作 | 打开对应工具页 | 同上 |
| 画布 | `CanvasProject`、视频库 | 项目/输出 Pin | `/canvas?projectId=` | 同上 |
| Story | `StoryProject` | 项目页 Pin | story-web 项目路由 | 同上 |
| QuickReplica | `QrTemplate` output | 生成结果 Pin | workspace 复制 / 打开 | 音频写入 + 引用 Book |
| AI 空间自身 | 合成任务 / 视频素材 | 合成台 / 库内 Pin | 空间内 Tab | 管理真源 |

**与 [16-project-assets-unified-design.md](./16-project-assets-unified-design.md) 边界**：

- **ProjectAsset**：画布内可复用 **组件**（角色、分镜、提示词包）。  
- **AiSpacePin**：跨应用 **成品展示** + 空间布置。  
- 二者可并存：用户保存角色到 ProjectAsset，另 Pin 成片到 AI 空间。

---

## 7. 预留（二期）

| 能力 | 说明 |
|------|------|
| 关注空间 | `AiSpaceFollow` |
| 收藏作品 | `AiSpaceFavorite` → 指向 `AiSpacePin.id` 或 source ref |
| 公开主页 | `AiSpaceProfile.slug` + `SPACE_PUBLIC` Pin |
| 动态流 | 被关注用户的公开 Pin |

第一版仅 `SPACE_PRIVATE`；枚举与路由占位即可。

---

## 8. API 概要（Platform · book-mall）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/platform/ai-space/pins` | 列表（resolve 展示字段） |
| POST | `/api/platform/ai-space/pins` | `{ sourceApp, sourceType, sourceId }` |
| DELETE | `/api/platform/ai-space/pins/:id` | 取消展示 |
| PATCH | `/api/platform/ai-space/pins/reorder` | 布置顺序 |
| GET | `/api/platform/ai-space/pins/check` | 删源前检测是否 Pin |
| GET | `/api/platform/ai-space/refs/check` | 删数字人/音频前检测跨应用引用 |
| GET/POST/PATCH/DELETE | `/api/platform/ai-space/digital-humans` | 数字人库 CRUD（Book 真源） |
| GET/POST/PATCH/DELETE | `/api/platform/ai-space/audio-assets` | 音频库 CRUD + QR 写入聚合 |
| GET/POST | `/api/platform/ai-space/video-materials` | 视频创作库 |
| POST | `/api/platform/ai-space/compose` | 发起合成 |
| GET | `/api/platform/ai-space/compose/:id` | 合成进度 |

鉴权：Book 会话（个人中心）或 SSO platform token；写操作校验 `userId` 与源记录所有权。

---

## 9. 实施分期

| 阶段 | 交付 | 优先级 |
|------|------|--------|
| **P0** | `AiSpacePin` + 个人中心页 + 删源 cascade 提示 + 电商/工具站 Pin 适配 | 高 |
| **P1** | `AiSpaceAudioAsset` + QR 音频 **写入 Book** + 音频库 UI + **全应用选用器 API** | 高 |
| **P1** | `DigitalHuman` + detect + 数字人库 UI + **全应用选用器 API** | 高 |
| **P1** | `AiSpaceVideoMaterial` + 分类 + 上传 + 聚合各应用 Pin 视频 | 高 |
| **P2** | 电商 / 种草 / QR 至少一个模块接入 `digitalHumanId` / `audioAssetId` 引用 | 中 |
| **P2** | `AiSpaceComposeTask` + Gateway S2V 队列 + FFmpeg worker | 中 |
| **P3** | 关注 / 收藏 / 公开主页 | 低 |

---

## 10. 验收清单

- [ ] Pin 表无 prompt/OSS 冗余；展示均 resolve 源  
- [ ] 删源前二次确认含「个人空间展示一并移除」；删源 cascade Pin  
- [ ] 空间「取消展示」仅删 Pin  
- [ ] 数字人 / 音频 **仅存 book-mall**；子应用无平行素材表  
- [ ] 各应用通过 Platform API **引用 ID**，不复制 OSS  
- [ ] 删数字人/音频前检测跨应用引用并二次确认  
- [ ] 数字人 / 音频 / 视频库 / 合成台管理入口在 `/account/ai-space`  
- [ ] 音频与 QuickReplica 共用 `AiSpaceAudioAsset`，不双存 OSS  
- [ ] 视频创作库 `app_ref` 仅指针；用户上传走 `AiSpaceVideoMaterial`  
- [ ] 合成任务遵守 20s、队列、临时目录清理  
- [ ] 厂商调用经 Gateway，无 `.env` 厂商 Key 默认路径  
- [ ] 点击 Pin 可 SSO 深链回原应用工作流  

---

## 11. 变更记录

| 日期 | 摘要 |
|------|------|
| 2026-08-14 | 初稿：指针模型、cascade 删除、四模块整合、数字人文档评估 |
| 2026-08-14 | §1.3：数字人/音频为 Book 真源、全应用引用、布置式管理 |
