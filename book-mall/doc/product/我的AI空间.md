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
├── 口播脚本                         # §4.5 · 整段文案拆镜 + 表格编辑 → 分镜渲染
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

**命名约定**：本文档所有新表统一 `AiSpace` 前缀，避免与未来通用概念冲突。

```prisma
model AiSpaceDigitalHuman {
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
| 实体 | `AiSpaceDigitalHuman`：name、avatarImageUrl、status | CRUD 在 book-mall；**唯一**数字人表 |
| 上传 | 正面单人照 jpg/png，400–7000px | OSS + wan2.2-s2v-detect（Gateway） |
| 跨应用引用 | 项目 meta 存 `digitalHumanId` | Platform API 列表/详情；子应用 **选用器**（见 §6.1） |
| 合成台 | §4.4 选材 | 与跨应用引用 **同一数据源** |
| 布置 | 可选 Pin 形象或成片到作品墙 | Pin 仍是指针；形象本身不是 Pin |

**与 Pin 关系**：数字人 **形象** 是平台素材，默认 **不** Pin；用户可将「数字人成片」Pin 到作品墙（`sourceType=compose_output` 等）。

**与电商现有「数字人」模块的关系（重要）**

电商工具箱侧栏的「数字人」当前 **不是** 音频驱动形象：它走 `resolveEcomVideoGenerationPlan` 的 `digital-human` 分支，模型为 `doubao-seedance-2.0`，输入 **仅 prompt**，无形象库、无口播音频（见 `book-mall/lib/ecom/ecom-video-generate-routing.ts`）。

因此：

- `AiSpaceDigitalHuman` 是 **全新建设**，不是迁移既有表；
- 电商「数字人」模块保持现状（文生视频），后续可 **可选** 接入 `digitalHumanId` + `audioAssetId` 走 §4.4 合成链路；
- 两者并存期间，文案上须区分「数字人视频（文生）」与「数字人口播合成（形象 + 音频驱动）」。

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

**定位**：按 **分类** 浏览可用于合成的 **背景/素材视频**。视图由 **两个数据源合并** 得到，**不**为各应用视频建第三份记录：

| 视图来源 | 数据来源 | 说明 |
|----------|----------|------|
| **各应用已 Pin 视频** | `AiSpacePin` 中 resolve 出 `kind=video` 的条目 | 电商 `EcomAsset`、工具站 `ImageToVideoLibraryItem`、画布视频库、Story 分镜视频、QR output 等 |
| **本库自有记录** | `AiSpaceVideoMaterial` | 仅两类：`upload`（用户自拍）与 `compose_output`（§4.4 合成成片） |

> **设计修正（2026-08-15）**：早期草案曾设想在 `AiSpaceVideoMaterial` 中写 `app_ref` 行来指向各应用视频。该设计与 `AiSpacePin` 功能重叠（同一件事两张表），已 **废弃**。各应用视频一律经 Pin 表引用，本库只存「用户真正拥有的新文件」。

**数据**

```prisma
model AiSpaceVideoMaterial {
  id           String   @id @default(cuid())
  userId       String
  tenantId     String?
  ownerUserId  String?
  visibility   AssetVisibility @default(PRIVATE)
  name         String
  category     String   // 见下表；默认 upload
  videoUrl     String   @db.Text
  durationSec  Float
  /// upload | compose_output（不含 app_ref）
  sourceKind   String
  /// compose_output 时回指 AiSpaceComposeTask
  composeTaskId String?
  meta         Json?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([userId, category, createdAt])
  @@index([tenantId, visibility, createdAt])
}
```

**与 Pin 的关系**

- 各应用视频 **只经 Pin** 出现在本视图，展示字段实时 resolve 源记录。  
- **用户上传 / 合成成片** 写入 `AiSpaceVideoMaterial`（这是真源，必须存 `videoUrl`），不自动 Pin；用户可另行 Pin 到作品墙。  
- **禁止**：把电商/工具站的 `videoUrl` 复制成本表新行。

**分类（v1）**

| category | 含义 | 适用 sourceKind |
|----------|------|-----------------|
| `product` | 产品展示 / 带货背景 | upload |
| `outfit` | 穿搭 / 模特走动 | upload |
| `lifestyle` | 生活场景 | upload |
| `upload` | 未归类上传（默认） | upload |
| `compose` | 合成台成片 | compose_output |

来自各应用 Pin 的视频在视图中按 **来源应用 + module** 分组，不占用上述 `category` 枚举。

### 4.4 视频合成台（创作台）

**来源文档**：[../数字人.md](../数字人.md) §3.4、§4.4  

**交互**：在 AI 空间内三步选素材 → 一键合成：

```
[数字人库] 选形象  +  [音频库] 选口播  +  [视频创作库] 选背景
                        ↓
              POST /api/platform/v1/ai-space/compose-tasks
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
  tenantId           String?
  digitalHumanId     String
  audioAssetId       String
  videoMaterialId    String?  // 可空 = 不叠背景，直接输出口播视频
  status             String   // pending | generating_human | composing | completed | failed
  /// Gateway 侧 S2V 任务与日志（排障用）
  gatewayLogId       String?
  gatewayTaskId      String?
  /// 阿里云中间产物转存后的 OSS 地址
  tempHumanVideoUrl  String?  @db.Text
  /// 复用 MediaRenderJob 做画中画合成
  mediaRenderJobId   String?
  finalVideoUrl      String?  @db.Text
  errorMessage       String?  @db.Text
  /// overlay 参数快照（缩放/位置/字幕开关）
  options            Json?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([userId, createdAt])
  @@index([status, createdAt])
}
```

**合成成片** 完成后：

1. 写入 `AiSpaceVideoMaterial`（`sourceKind=compose_output` + `composeTaskId`）。  
2. 用户点「展示到空间」→ 创建 Pin 指向该 `AiSpaceVideoMaterial` 记录。

**技术约束**（摘自数字人文档，实施时必须遵守）：

| 约束 | 处理 |
|------|------|
| 音频 &lt; 20s | 合成前校验 `AiSpaceAudioAsset.durationSec` |
| S2V 并发 = 1 | Book 侧 **单飞队列**：DB advisory lock，全局同时仅 1 条 `generating_human` |
| S2V 耗时不可控 | 进程内只等 10min，到点 **不判失败**，任务留 `generating_human` 交队列泵对账；超过 `AI_SPACE_S2V_HARD_TIMEOUT_MS`（默认 3h）才收口失败。实测厂商排队可达 1h，20min 硬超时会误杀在跑任务 |
| 阿里云结果 URL 24h | 及时转存 OSS |
| 背景短于口播 | FFmpeg `-stream_loop -1` |
| 临时文件 | 复用 `render-ffmpeg` 的 `mkdtemp` + `finally rm` |
| OSS 拉取 | 服务端下载到本地再 FFmpeg；不假设 Bucket 公网读（与现网 OSS 规范一致） |

**合成实现**（已落地）：复用 [../../lib/media/media-render-service.ts](../../lib/media/media-render-service.ts) 的 `MediaRenderJob`（状态机、并发控制、OSS 上传、积分扣退），`MediaTimelineV1` 新增可选 `composite`（`backgroundUrl` / `audioUrl` / `overlay` / `subtitleText`），命中时 `processMediaRenderJob` 分流到 [../../lib/media/render-ffmpeg.ts](../../lib/media/render-ffmpeg.ts) 的 `runCompositeRender`（背景 `-stream_loop -1` 铺底 + overlay 叠加 + 音轨择一 + 字幕烧录），`sourceApp` 复用 `api`。单飞队列由 `pg_try_advisory_xact_lock` + `AiSpaceComposeTask` 状态计数实现，无常驻 worker 时由合成台前台轮询（`GET /compose-tasks`）驱动 `pumpAiSpaceComposeQueue`。

**模块边界（务必遵守）**：合成任务的 **只读查询** 在 [../../lib/ai-space/ai-space-compose-query.ts](../../lib/ai-space/ai-space-compose-query.ts)，**状态机** 在 `ai-space-compose-service.ts`。`/account/ai-space` 等 Server Component 只能 import **query** 模块——service 会经 `media-render-service → render-ffmpeg → canvas-jianying-export` 把 `archiver` 拉进 RSC 编译图，而 `next.config.mjs` 的 `serverComponentsExternalPackages` 只对服务端运行时外置，页面编译会报 `ESM packages (archiver) need to be imported`。

**Provider 抽象**（数字人文档 §6）：预留 `IVideoProvider` / `ITTSProvider`；v1 阿里云，v2 可接 MiniMax（仍经 Gateway）。

### 4.5 口播分镜脚本（创作编排层）

**权威文档**：[ai-space-broadcast-script.md](./ai-space-broadcast-script.md)

**定位**：合成台（§4.4）的 **上级编排**：整段口播文案 → Gateway LLM 拆镜 → 表格编辑（绑背景、数字人出镜时间段）→ 锁定 → 分镜级渲染 + 总拼接。

**与 §4.4 关系**：单次 `AiSpaceComposeTask` 变为 **镜级渲染单元**；新 Tab `?tab=broadcast`（口播脚本）。

**v1 范围**：文案输入 + AI 拆镜 + 表格 CRUD + 单镜 TTS；语音 ASR 路径预留。合成台单次任务增加 **分步进度条**（排队 / S2V / 转存 / 画中画 / 入库）。

**数据表（Phase 2+）**：`AiSpaceBroadcastProject` · `AiSpaceBroadcastScript` · `AiSpaceBroadcastShot` · `AiSpaceBroadcastRenderJob`（见子文档 §3）。

---

## 5. 对 [../数字人.md](../数字人.md) 的评估与改造清单

原稿为 **独立 Express + SQLite + 直连阿里云** 的交付规格，与现网 **Book 平台联邦 + PostgreSQL + Gateway** 存在差距。结论：**业务逻辑可采纳，工程形态必须改造**。

| 原稿项 | 评估 | 目标态 |
|--------|------|--------|
| 独立 Express 服务 | ❌ 与 monorepo 分裂 | book-mall Platform API `/api/platform/v1/ai-space/*` |
| SQLite | ❌ | PostgreSQL + Prisma 迁移 |
| 直连 DashScope Key | ❌ | Gateway + `resolveGatewayAuthForBookUser` |
| 4 表（DigitalHuman / Audio / VideoMaterial / ComposeTask） | ✅ 语义保留 | 统一 `AiSpace` 前缀：`AiSpaceDigitalHuman` / `AiSpaceAudioAsset` / `AiSpaceVideoMaterial` / `AiSpaceComposeTask` |
| FFmpeg 云端合成 | ✅ | **复用现网 `MediaRenderJob`**（`lib/media/`），新增 composite 渲染路径 |
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
| GET | `/api/platform/v1/ai-space/digital-humans?activeOnly=1` | 可用形象列表（含 `avatarImageUrl`、`status`、宽高） |
| GET | `/api/platform/v1/ai-space/audio-assets?maxDurationSec=20` | 音频列表（含 `durationSec`、`textScript`），可按门禁过滤 |
| GET | `/api/platform/v1/ai-space/video-materials?ownedOnly=1` | 本库视频（背景素材与合成成片） |
| GET | `/api/platform/v1/ai-space/refs/check?kind=&id=` | 删素材前：合成任务引用数 + 是否已 Pin |

列表接口已返回选用所需全部字段，未单独提供 `/:id` 详情端点；需要单条时前端按 id 从列表结果取。

**前端**：各应用复用统一选用 Dialog（类似 `EcomAssetPickerDialog` / `@` mention 模式），数据源仅为上述 API。已提供客户端封装 [../../../tool-web/lib/ai-space-client.ts](../../../tool-web/lib/ai-space-client.ts)（`listAiSpaceDigitalHumans` / `listAiSpaceAudioAssets` / `checkAiSpaceMaterialRefs`）与 [../../../canvas-web/lib/canvas-ai-space.ts](../../../canvas-web/lib/canvas-ai-space.ts) 同名函数。  
**BFF**：tool-web 走同域 `/api/ai-space/*`（catch-all 代理，注入 `Bearer tools_token`）；canvas-web / story-web 走既有 `/api/book-mall/*` 代理，与现联邦模式一致。

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

前缀 `/api/platform/v1/ai-space`，与 `quick-replica` 保持同一代际约定。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/pins` | 列表（resolve 展示字段） |
| POST | `/pins` | `{ sourceType, sourceId }`（`sourceApp` 由源类型推导） |
| PATCH | `/pins` | 改 `caption` |
| DELETE | `/pins?id=` | 取消展示 |
| PATCH | `/pins/reorder` | 布置顺序 |
| GET | `/pins/check` | 删源前检测是否 Pin |
| GET | `/refs/check?kind=digital-human\|audio\|video&id=` | 删素材前检测引用（合成任务数 + 是否已 Pin） |
| GET/POST/PATCH/DELETE | `/digital-humans` | 数字人库 CRUD（Book 真源）；`?activeOnly=1` 供选用器 |
| GET/PATCH/DELETE | `/audio-assets` | 音频库列表 / 改名 / 删除；`?maxDurationSec=` 供 20 秒门禁过滤 |
| POST | `/audio-assets/upload` | 上传本地音频（multipart） |
| GET/POST | `/audio-assets/tts` | 可选模型音色 / 空间内 TTS 生成（Gateway） |
| GET/POST/PATCH/DELETE | `/video-materials` | 视频创作库；默认返回「自有 + Pin(video)」合并视图，`?ownedOnly=1` 只返回本库 |
| GET/POST | `/compose-tasks` | 合成任务列表（`?id=` 单条，轮询时推进队列）/ 发起合成；DTO 含 `steps[]` 分步进度 |
| GET/POST | `/broadcast-projects` | 口播项目列表 / 新建（§4.5） |
| POST | `/broadcast-projects/split?id=` | LLM 拆镜 |
| POST | `/broadcast-projects/lock?id=` | 锁定脚本 |
| GET/PATCH/POST/DELETE | `/broadcast-shots?scriptId=` | 分镜行 CRUD |
| POST | `/broadcast-shots/tts?id=` | 单镜 TTS |
| POST | `/broadcast-projects/render?id=` | 镜级渲染 + 总拼接 |

> 写操作按资源分布在同一 collection 路由上（`?id=` 定位），与 `quick-replica` 现网风格一致；未使用 `/:id` 动态段。

**鉴权（双模）**：同域个人中心用 NextAuth session；子应用用 `Authorization: Bearer {tools_token}`。统一封装 `resolveAiSpaceActor(request)`，写操作校验 `userId` 与源记录所有权。

---

## 9. 实施分期

| 阶段 | 交付 | 优先级 |
|------|------|--------|
| **P0** | `AiSpacePin` + 个人中心页 + 删源 cascade 提示 + 电商/工具站 Pin 适配 | 高 |
| **P1** | `AiSpaceAudioAsset` + QR 音频 **写入 Book** + 音频库 UI + **全应用选用器 API** | 高 |
| **P1** | `AiSpaceDigitalHuman` + 数字人库 UI + **全应用选用器 API** | 高 |
| **P1** | `AiSpaceVideoMaterial` + 分类 + 上传 + 聚合各应用 Pin 视频 | 高 |
| **P2** | 电商 / 种草 / QR 至少一个模块接入 `digitalHumanId` / `audioAssetId` 引用 | 中 |
| **P2** | `AiSpaceComposeTask` + Gateway S2V 队列 + FFmpeg worker | 中 |
| **P3** | 关注 / 收藏 / 公开主页 | 低 |
| **P4** | 口播分镜脚本（§4.5）：拆镜 + 表格 + 镜级渲染 + 总拼接 | 高 |
| **P4** | 合成台分步进度 UI | 中 |

**当前进度（2026-08-16）**：P0–P2（AI 空间五 Tab + 合成台）已交付；P4 口播脚本与分步进度实施中；P3 未开始。

---

## 10. 验收清单

- [x] Pin 表无 prompt/OSS 冗余；展示均 resolve 源  
- [x] 删源前二次确认含「个人空间展示一并移除」；删源 cascade Pin  
- [x] 空间「取消展示」仅删 Pin  
- [x] 数字人 / 音频 **仅存 book-mall**；子应用无平行素材表  
- [x] 各应用通过 Platform API **引用 ID**，不复制 OSS（选用器 API + 客户端封装已就位）  
- [x] 删数字人/音频前检测跨应用引用并二次确认（`refs/check`）  
- [x] 数字人 / 音频 / 视频库 / 合成台管理入口在 `/account/ai-space`  
- [x] 音频与 QuickReplica 共用 `AiSpaceAudioAsset`，不双存 OSS  
- [x] 视频创作库中各应用视频 **只经 Pin**；`AiSpaceVideoMaterial` 仅 `upload` / `compose_output`  
- [x] 合成任务遵守 20s、队列、临时目录清理  
- [x] 厂商调用经 Gateway，无 `.env` 厂商 Key 默认路径  
- [x] 点击 Pin 可 SSO 深链回原应用工作流  
- [x] Gateway 凭证：`DASHSCOPE` / `BAILIAN` 凭证已挂 Platform Admin + Personal + `platform-*` 托管 Key（凭证按 `providerKind` 绑定，新增模型无需单独绑定）；`pnpm gateway:verify-ai-space` 可自检  
- [x] CosyVoice TTS 实机跑通（`cosyvoice-v3-flash` 出 5.6s 音频并入库）  
- [x] composite 渲染实机跑通（`pnpm gateway:smoke-composite`：背景循环 + 右下小窗 + TTS 音轨 + 中文字幕烧录 + faststart + OSS），效果见 [assets/ai-space-composite-smoke.jpg](./assets/ai-space-composite-smoke.jpg)  
- [x] 形象图预检 `wan2.2-s2v-detect` 已接入（上传即检 + 合成前门禁 + 「重新预检」按钮，结果缓存 `meta.detect`，换图自动失效）  
- [ ] **阻塞中**：`wan2.2-s2v` 端到端出片。**官方文档示例图 + 示例音频**在本账号同样失败：排队恰好 60 分钟后返回 `InternalError / Internal server error!`（示例任务 `9c7bbb45`：提交 04:08:17 → 结束 05:08:27）。已排除请求体（与官方示例逐字段一致）、形象图（`wan2.2-s2v-detect` 返回 `check_pass=true`）与凭证（同一把 Key 的 detect 同步接口 200）。最可能原因：文档明确要求 **华北2（北京）** 地域 API Key 与 `{WorkspaceId}.cn-beijing.maas.aliyuncs.com` 端点，而当前用的是通用 `dashscope.aliyuncs.com`。**待办**：拿到北京地域 Key + WorkspaceId 后改 `S2V_CREATE_URL` 重测  
- [ ] **待定价**：`wan2.2-s2v`（480P 0.5 元/秒 · 720P 0.9 元/秒）与 `cosyvoice-v3-flash`（1 元/万字符）尚无 `ModelCreditPrice`，平台代付用户当前不扣积分，需在 `/admin/model-credit-ledger` 发布  
- [ ] **P2 待接入**：电商 / 种草 / 画布节点引用 `digitalHumanId` / `audioAssetId`  

---

## 11. 变更记录

| 日期 | 摘要 |
|------|------|
| 2026-08-14 | 初稿：指针模型、cascade 删除、四模块整合、数字人文档评估 |
| 2026-08-14 | §1.3：数字人/音频为 Book 真源、全应用引用、布置式管理 |
| 2026-08-15 | 代码核对后修正：废弃 `AiSpaceVideoMaterial.app_ref`（与 Pin 重叠）、表名统一 `AiSpace` 前缀、更正电商数字人现状（Seedance 文生视频非音频驱动）、合成复用 `MediaRenderJob`、API 前缀改 `/api/platform/v1/ai-space` |
| 2026-08-15 | 一期落地：五张表迁移 `20260815020000_ai_space`；作品墙 / 数字人库 / 音频库 / 视频创作库 / 合成台五个 Tab 上线；Gateway 补登 `wan2.2-s2v` 与 CosyVoice（新建 `cosyvoice-tts-proxy.ts`）；`MediaTimelineV1.composite` + `render-ffmpeg.runCompositeRender` 实现画中画；合成台经 `pg_try_advisory_xact_lock` 单飞排队（S2V 厂商并发 1）；API 表按实际路由更新 |
| 2026-08-15 | 接入形象图预检 `wan2.2-s2v-detect`（同步接口 0.004 元/张）：形象上传即检、合成前门禁、UI「重新预检」；结果缓存 `AiSpaceDigitalHuman.meta.detect`（含 `imageUrl`，换图自动失效），不通过时状态置 `detect_failed`。新增 `lib/ai-space/ai-space-s2v-detect-service.ts` + `lib/ai-space/ai-space-gateway-auth.ts`（S2V / detect / TTS 共用凭证解析）+ `pnpm gateway:detect-digital-humans` 存量回填。S2V 厂商 `InternalError` 改为指向「需华北2（北京）地域 Key」的可执行提示 |
| 2026-08-15 | 实机验证与修复：S2V 进程内 20min 硬超时改为「10min 交队列泵 + 3h 硬上限」（避免误杀厂商仍在跑的任务），对账终态补写 Gateway 日志；终态后 `kickNextPendingTask` 自动放行下一条排队；composite 字幕在底部小窗时按 ASS 脚本坐标抬高 `MarginV`，不再压住画中画。新增运维脚本 `gateway:verify-ai-space` / `gateway:ai-space-worker` / `gateway:smoke-ai-space` / `gateway:smoke-composite` 与 `scripts/debug-s2v-task.ts` |
| 2026-08-16 | §4.5 口播分镜脚本：新增 [ai-space-broadcast-script.md](./ai-space-broadcast-script.md)；`?tab=broadcast` Tab；四表 `AiSpaceBroadcast*`；合成台分步进度 `steps[]` |
