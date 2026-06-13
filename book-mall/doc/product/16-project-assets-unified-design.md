# 项目资产 · 统一设计方案

> 状态：设计稿（待评审 → 分期实施）  
> 创建：2026-06-12  
> 需求来源：`docs/项目产资产.md`  
> 关联：  
> - 租户/团队 `doc/product/14-tenant-team-design.md`  
> - 现有 Story-Pro 资产 rollout `doc/plans/2026-story-pro-assets-and-script-assistant.md`  
> - LibTV 顶栏规范 `canvas-web/docs/libtv-unified-node-catalog.md` §1.2  
> - 平台联邦 `doc/product/12-platform-app-federation.md`

---

## 1. 目标与结论

### 1.1 产品目标

| # | 需求 | 设计回应 |
| --- | --- | --- |
| 1 | 11 类资产：角色、场景、道具、大纲、分镜脚本、音频、分镜图、分镜视频、数字人、风格、提示词 | 统一 `ProjectAssetKind` 枚举 + 单一 `ProjectAsset` 表（payload 分 kind） |
| 2 | 个人私有 / 团队共享 | 复用 `tenantId` + `ownerUserId` + `AssetVisibility`（PRIVATE / TEAM_PUBLIC） |
| 3 | 同时仅一人可编辑 | 资产级 **编辑租约** `editLease`（与现有「锁定生产」`locked` 分离） |
| 4 | 节点顶栏「保存为资产」 | 扩展 `Pro2ImageNodeToolbar` / 组顶栏 / 薄卡工具条，不新建壳层 |
| 5 | 组可保存为资产 | `GROUP_BUNDLE` 复合资产，含子项快照 + 可选 relayout 元数据 |
| 6 | 三种画布共用一套 | **一套 Platform API + 一套 `/assets` UI**；画布 edition 只影响「从哪类节点导出」映射 |
| 7 | 顶栏样式 | 一律 `PRO2_IMAGE_NODE_TOOLBAR_*` |

### 1.2 核心结论：**只用一套**

三种画布（Story-Pro 1.0 列式、影视 2.0 Pro2、分镜视频 1.0 sbv1）在**存储、权限、UI、API** 上共用 **同一套项目资产系统**。  
画布 `edition` 仅决定：

- 哪些节点类型可「保存为资产」
- 导出时 `payload` 的默认字段映射

**不**按画布拆表、拆 Tab 组件、拆权限模型。

---

## 2. 与现有实现的关系

### 2.1 已有（保留并迁移）

| 现有表 | 对应统一 kind | 说明 |
| --- | --- | --- |
| `StoryProCharacterAsset` + refs | `CHARACTER` | 四槽 + characterKey |
| `StoryProSceneAsset` + refs | `SCENE` / `PROP` | 场景与道具拆分 kind，迁移时按 ref 标签区分 |
| `StoryProCharacterAudioAsset` | `AUDIO` | 音色样本 |
| `StoryProStyleProfile` | `STYLE` | 锚定词 + 参考图 |
| `CanvasCharacter` | 并入 `CHARACTER`（简化条目） | 逐步废弃独立表 |

### 2.2 新增 kind（v1 必做）

| kind | 典型来源节点 |
| --- | --- |
| `OUTLINE` | `story-pro2-starter` · Story-Pro starter |
| `STORYBOARD_SCRIPT` | `story-pro2-script-hub` · `story-pro-script-hub` |
| `STORYBOARD_IMAGE` | `story-pro2-image` · `story-pro2-three-view` · `sbv1-image` · 分镜静帧列 |
| `STORYBOARD_VIDEO` | `sbv1-video-engine` · 分镜视频列 |
| `DIGITAL_HUMAN` | 预留；v1 可占位 Tab + 手动上传 |
| `PROMPT` | Dock prompt / 节点 meta · 导演提示词包 |
| `GROUP_BUNDLE` | 选中 `group`（Pro2 媒体组 / sbv1 参考图组） |

### 2.3 迁移策略（三阶段）

1. **Phase A — 适配层**：新建 `ProjectAsset` API；读写时 **双写** 旧表 + 新表（或视图聚合旧数据到统一列表）。
2. **Phase B — UI 统一**：`/assets` 与画布侧栏改读 `ProjectAsset`；旧 Tab 映射到新 kind 过滤器。
3. **Phase C — 下线旧表**：迁移脚本 + 只读兼容期 → 删除冗余 REST。

---

## 3. 数据模型

### 3.1 枚举

```prisma
enum ProjectAssetKind {
  CHARACTER
  SCENE
  PROP
  OUTLINE
  STORYBOARD_SCRIPT
  AUDIO
  STORYBOARD_IMAGE
  STORYBOARD_VIDEO
  DIGITAL_HUMAN
  STYLE
  PROMPT
  GROUP_BUNDLE
}

enum AssetVisibility {
  PRIVATE      // 个人空间：仅 owner；团队空间：仅本人可见
  TEAM_PUBLIC  // 团队空间：全员可见可用
}
```

### 3.2 主表

```prisma
model ProjectAsset {
  id           String            @id @default(cuid())
  tenantId     String            // personal 或 team 租户
  ownerUserId  String            // 创建者
  visibility   AssetVisibility   @default(PRIVATE)

  kind         ProjectAssetKind
  displayName  String
  description  String            @default("") @db.Text
  thumbnailUrl String            @default("")

  /// 可选：从某画布项目导出时记录来源（库内资产 projectId 可为 null = 租户级复用库）
  sourceProjectId String?
  sourceNodeId    String?        // 画布 node id（追溯）
  sourceEdition   String?        // pro2 | sbv1 | story-pro

  /// 生产锁定：锁定后流水线/API 拒绝覆盖（沿用 StoryPro locked 语义）
  locked       Boolean           @default(false)

  /// 并发编辑租约（同时仅一人编辑）
  editLockUserId    String?
  editLockExpiresAt DateTime?

  version      Int               @default(1)
  payload      Json              // kind 专用结构，见 §3.3

  refs         ProjectAssetRef[]

  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
  deletedAt    DateTime?

  @@index([tenantId, kind, visibility, updatedAt])
  @@index([ownerUserId, updatedAt])
  @@index([sourceProjectId, kind])
}

model ProjectAssetRef {
  id        String       @id @default(cuid())
  assetId   String
  asset     ProjectAsset @relation(fields: [assetId], references: [id], onDelete: Cascade)
  slotKey   String       // face | three_view | ref_1 | bundle_child_0 ...
  label     String       @default("")
  mediaUrl  String
  mimeType  String?
  meta      Json?
  sortOrder Int          @default(0)

  @@index([assetId, sortOrder])
}
```

### 3.3 payload 约定（JSON）

| kind | payload 要点 |
| --- | --- |
| CHARACTER | `{ characterKey, slots: { face, full_body, outfit, three_view } }` |
| SCENE / PROP | `{ entityKey, tags[] }` |
| OUTLINE | `{ markdown, theme?, finalized?: boolean }` |
| STORYBOARD_SCRIPT | `{ markdown, tables?: { storyboard, characters } }` |
| STORYBOARD_IMAGE | `{ prompt, modelKey?, width?, height?, role?: frame\|character-three-view\|ref }` |
| STORYBOARD_VIDEO | `{ prompt, modelKey?, duration?, timeline? }` |
| AUDIO | `{ characterKey?, voiceLabel?, durationSec? }` |
| STYLE | `{ anchorText, refUrls[], options? }` |
| PROMPT | `{ text, tags[], modelHints? }` |
| DIGITAL_HUMAN | `{ provider?, avatarId?, previewUrl }` |
| GROUP_BUNDLE | `{ edition, pro2Kind?, layout: { nodes[], edges[] }, childAssetIds?[] }` |

`GROUP_BUNDLE` 默认存 **子图快照**（nodes/edges 相对布局 + 媒体 URL），避免强依赖子资产 ID 仍存在。

### 3.4 租户与 visibility

与 `14-tenant-team-design.md` §3.1 一致：

| 上下文 | PRIVATE | TEAM_PUBLIC |
| --- | --- | --- |
| personal 租户 | 默认且唯一 | 不可用（UI 隐藏） |
| team 租户 | 仅本人可见 | 全队可见可用 |

保存对话框默认：

- personal 空间 → 仅「保存到个人库」
- team 空间 → 单选「仅自己可见 / 团队共享」；MEMBER 可将自有条目「设为团队共享」

权限矩阵复用 §3.2（删改公共库仅 OWNER/ADMIN）。

---

## 4. 编辑租约（同时一人编辑）

与 `locked`（生产冻结）**分离**：

| 概念 | 字段 | 含义 |
| --- | --- | --- |
| 生产锁定 | `locked` | 定稿后禁止画布流水线自动覆盖 |
| 编辑租约 | `editLockUserId` + `editLockExpiresAt` | 详情页/表编辑 Modal 打开时占用 |

**流程**

1. 打开资产详情或「从资产插入到画布」的可编辑模式 → `POST .../assets/:id/lease`（TTL 15min）。
2. 前端每 5min heartbeat；关闭页 `DELETE .../lease`。
3. 他人打开 → 提示「{name} 正在编辑」+ 只读预览 +「请求接管」（OWNER/ADMIN 或租约过期后可接管）。
4. 画布节点保存到已有资产 → 若租约非本人则拒绝，引导先打开资产页。

实现：DB 字段 + 可选 Redis `asset:lease:{id}` 加速；v1 可仅 DB。

---

## 5. 画布 · 保存为资产

### 5.1 顶栏入口（统一壳层）

扩展 `Pro2ImageNodeToolbar` / `Pro2MediaGroupToolbarPanel`，新增按钮：

```tsx
// 文案 + 图标建议：BookmarkPlus 或 FolderInput
<button className={PRO2_IMAGE_NODE_TOOLBAR_TOOL_BTN_CLASS} …>
  <BookmarkPlus className="size-3.5" />
  <span>保存为资产</span>
</button>
```

**须挂载的节点**

| 节点 type | 默认 kind | 顶栏位置 |
| --- | --- | --- |
| `story-pro2-image` | STORYBOARD_IMAGE | 有图顶栏 |
| `story-pro2-three-view` | CHARACTER 或 STORYBOARD_IMAGE | 有图顶栏 |
| `sbv1-image` | STORYBOARD_IMAGE | 有图顶栏 |
| `sbv1-video-engine` | STORYBOARD_VIDEO | 组顶栏或视频预览区工具条（同壳层） |
| `story-pro2-starter` | OUTLINE | 薄卡选中工具条* |
| `story-pro2-script-hub` | STORYBOARD_SCRIPT | `Pro2ScriptHubToolbar` |
| `story-pro2-style-asset` | STYLE | 检视器保存（已有，改走统一 API） |
| `group` | GROUP_BUNDLE | `Pro2MediaGroupToolbarPanel` |

\*薄卡无 `Pro2ImageNodeToolbar` 时，新增 **同壳层** 的 `Pro2ThinNodeToolbar`（复用 `PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS`，禁止第三套视觉）。

Story-Pro 1.0 列节点：列引擎条 / 槽位面板增加同文案按钮，API 相同。

### 5.2 保存对话框

`SaveProjectAssetDialog`（新建，单实例）：

| 字段 | 说明 |
| --- | --- |
| 名称 | 默认节点标题 / 角色名 / 组名 |
| 类型 | 自动预选，可改（下拉 11 类） |
| 可见性 | personal：固定私有；team：私有 / 团队共享 |
| 目标 | 「本项目资产库」/「租户复用库」（`sourceProjectId` null） |
| 预览 | 缩略图 + 摘要（prompt 前 80 字 / 表行数） |

确认 → `POST /api/platform/assets`（Platform API，book-mall 单写）。

### 5.3 组保存为资产

选中 Pro2/sbv1 媒体组 → 组顶栏「保存为资产」：

1. 遍历组内节点，收集媒体 URL + 相对 position + 边关系。
2. 写入 `GROUP_BUNDLE` payload；thumbnail 取第一张图或组标题色块。
3. 插入画布时：spawn 组 + 子节点模板（类似 template paste），**不**自动占用编辑租约。

---

## 6. 界面方案（使用便捷）

### 6.1 信息架构

```
/assets                          # 全站项目资产（与画布侧栏同组件）
├── 顶栏：当前空间（个人 / 团队名）· 搜索 · 新建
├── 左：Kind 导航（11 类 + 全部）
├── 中：卡片网格 / 列表
└── 右（可选）：详情抽屉（预览 · 编辑 · 锁定 · 可见性 · 插入画布）
```

画布内：**同一 `ProjectAssetsPanel`**，`compact` 模式 + 当前 `projectId` 过滤。

### 6.2 Kind 导航（11 类）

| Tab | kind | 图标 |
| --- | --- | --- |
| 角色 | CHARACTER | Users |
| 场景 | SCENE | MapPin |
| 道具 | PROP | Package |
| 大纲 | OUTLINE | BookOpen |
| 分镜脚本 | STORYBOARD_SCRIPT | Table |
| 音频 | AUDIO | Mic |
| 分镜图 | STORYBOARD_IMAGE | Image |
| 分镜视频 | STORYBOARD_VIDEO | Clapperboard |
| 数字人 | DIGITAL_HUMAN | UserCircle |
| 风格 | STYLE | Palette |
| 提示词 | PROMPT | Sparkles |

「风格库」（平台内置只读）仍为 **独立 Tab**，不入库表。

### 6.3 列表卡片

复用 `ProjectAssetMediaCard` 壳层，扩展：

- 角标：kind · PRIVATE/TEAM_PUBLIC · locked · 编辑中（租约）
- 操作：预览 · 插入画布 · 复制链接 · 设为共享 · 删除（doubleConfirm + OSS 文案）

### 6.4 筛选

- **范围**：全部 / 仅本项目 / 租户库
- **可见性**：全部 / 我的私有 / 团队共享
- **排序**：最近更新 / 名称

### 6.5 插入画布

资产卡片「插入」：

1. 按 kind 映射 spawn 节点（与 edition 无关，由当前项目 edition 决定节点 type）。
2. 例：`STORYBOARD_IMAGE` → Pro2 项目 spawn `story-pro2-image`；sbv1 spawn `sbv1-image`。
3. 插入后选中节点，不自动连边。

### 6.6 便捷性要点

- **保存**：节点顶栏一键 → 对话框记住上次 visibility。
- **复用**：侧栏 Dock `@` 可引用租户库资产（扩展 mentionables）。
- **搜索**：跨 kind 全文（displayName + payload.text）。
- **批量**：组顶栏批量下载已有；资产页可选批量设共享 / 删除（ADMIN）。

---

## 7. API  sketch（Platform API · book-mall）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/platform/assets` | `tenantId` 上下文 · filter kind/visibility/projectId |
| POST | `/api/platform/assets` | 从画布导出创建 |
| GET | `/api/platform/assets/:id` | 详情 + refs |
| PATCH | `/api/platform/assets/:id` | 改 meta / visibility / locked |
| DELETE | `/api/platform/assets/:id` | 软删 + OSS 清理队列 |
| POST | `/api/platform/assets/:id/lease` | 编辑租约 |
| DELETE | `/api/platform/assets/:id/lease` | 释放 |
| POST | `/api/platform/assets/:id/insert-map` | 返回当前 edition 的 spawn 规格 |

鉴权：SSO platform token + `tenant_id`；写操作 `assertTenantPermission`。

Canvas BFF：`/api/book-mall/platform/assets/*` 代理（与现 Story-Pro 资产 API 并存至 Phase C）。

---

## 8. 节点 → kind 映射表（三画布）

| 画布 edition | 节点 | kind |
| --- | --- | --- |
| pro2 | story-pro2-starter | OUTLINE |
| pro2 | story-pro2-script-hub | STORYBOARD_SCRIPT |
| pro2 | story-pro2-image | STORYBOARD_IMAGE |
| pro2 | story-pro2-three-view | CHARACTER |
| pro2 | story-pro2-style-asset | STYLE |
| pro2 | group (pro2Kind) | GROUP_BUNDLE |
| sbv1 | sbv1-image | STORYBOARD_IMAGE |
| sbv1 | sbv1-video-engine | STORYBOARD_VIDEO |
| sbv1 | group (sbv1Styled) | GROUP_BUNDLE |
| story-pro | story-pro-starter | OUTLINE |
| story-pro | story-pro-script-hub | STORYBOARD_SCRIPT |
| story-pro | story-pro-character + 四槽 | CHARACTER |
| story-pro | story-pro-scene | SCENE / PROP |
| story-pro | story-pro-frame | STORYBOARD_IMAGE |
| story-pro | story-pro-video | STORYBOARD_VIDEO |
| story-pro | story-pro-style | STYLE |
| 任意 | Dock / 导演包 | PROMPT |

---

## 9. 实施分期

| 阶段 | 交付 | 优先级 |
| --- | --- | --- |
| **P0** | Prisma `ProjectAsset` + lease + POST 创建 + 顶栏按钮（图片/三视图/sbv1） | 高 |
| **P1** | `/assets` 11 Tab + 迁移适配层（读旧表聚合） | 高 |
| **P1** | 组保存 GROUP_BUNDLE + team visibility | 中 |
| **P2** | OUTLINE / SCRIPT / PROMPT / VIDEO 全节点覆盖 | 中 |
| **P2** | Dock `@` 租户库 · 插入画布映射 | 中 |
| **P3** | DIGITAL_HUMAN · 旧表下线 | 低 |

---

## 10. 风险与决策

| 项 | 决策 |
| --- | --- |
| 一套 vs 三套 | **一套**；edition 仅映射 |
| locked vs editLease | **两个字段**，UI 文案区分「生产锁定 / 编辑占用」 |
| GROUP_BUNDLE 体积 | 存快照 JSON，单资产上限如 2MB；超出提示拆组 |
| OSS | 保存时复制媒体到 `tenant/assets/{assetId}/` 前缀，避免项目删除后断链 |
| 联邦 | 资产 API 只在 book-mall；Canvas 经 Platform API / BFF |

---

## 11. 验收清单

- [ ] 三种画布同一 `/assets` 列表，切换项目 edition 数据不分裂
- [ ] personal 仅私有；team 可选私有/共享，权限符合 §3.2
- [ ] 保存对话框 + 顶栏壳层符合 `PRO2_IMAGE_NODE_TOOLBAR_*`
- [ ] 两人同时编辑同一资产，后者只读 + 租约提示
- [ ] 组保存 / 插入可还原布局
- [ ] 删除资产 doubleConfirm 含 OSS 文案
