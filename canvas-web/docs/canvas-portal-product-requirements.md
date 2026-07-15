# Canvas 门户产品需求

> canvas-web · 门户改版、公告栏协作、工作流分享  
> 最后更新：2026-07-14

## 1. 背景与目标

- **门户独立**：顶栏仅「首页」「我的画布」；资产/角色/脚本/分镜等收入「我的画布」子导航。
- **工作流复用**：平台精选 + 用户公开模板；组级分享子图结构。
- **协作制作**：公告栏场景去重；各环节可增改行并保留修订历史；剧本包多版本快照。

## 2. 首页

### 2.1 Featured（精选工作流）

| 项 | 说明 |
|----|------|
| 数据源 | `BUILTIN_CANVAS_TEMPLATES` 子集 + DB `featured=true` 且非 builtin |
| 交互 | 卡片预览（只读 React Flow）+「用此工作流创建」→ `cloneGraphForNewProject` + `createCanvasProject` |

### 2.2 Templates（社区模板）

| 项 | 说明 |
|----|------|
| 数据源 | DB `visibility=public` 用户模板 |
| 展示 | 标题、描述、作者、`forkCount` |
| 交互 | 预览 +「复制到我的画布」→ `forkCanvasTemplate` + 新建项目 |

## 3. 导航与子导航

### 顶栏（2 项）

- 首页 `/`
- 我的画布 `/projects`

### 子导航（5 项，`ProjectsSubNav`）

| Tab | 路由 |
|-----|------|
| 项目资产 | `/assets` |
| 角色库 | `/characters` |
| 脚本 | `/scripts` |
| 分镜 | `/storyboards` |
| 资产指南 | `/guides/project-assets` |

「实现逻辑」等旧顶栏入口已移除；`/implementation` 保留路由但无导航入口。

## 4. 公告栏

### 4.1 场景去重（P0）

- `dedupeProSceneRows`：按 name/hubKey 等价合并场景行。
- `mergeBulletinTaskKinds`：按 `kind+label` 合并，避免 hubId 前缀变化导致任务重复。
- 自动 refresh：场景标签/数量双向变化时刷新公告栏。

### 4.2 环节增改（除「剧本已定」）

| 环节 | Hub 字段 |
|------|----------|
| 角色 | `scriptStudioCharacterRows` |
| 场景 | `sceneRows` |
| 道具 | `scriptStudioPropRows` |
| 氛围 | `scriptStudioMoodRows` |
| 音效 | `scriptStudioAudioRows` |
| 分镜/视频/对白/合成 | `scriptStudioFrameRows` |

- 全屏环节面板「+ 新增」插入空行。
- 任务表双击单元格行内编辑；保存后 `refreshCrewBulletinFromHub`。
- 行 `rowRevisionHistory` + `promptHistory` 记录修订。

### 4.3 版本与剧本包

- 制作快照：`appendScriptPackageSnapshot` 保留同 `taskId` 历史，旧版标记 `supersededAt`。
- 剧本包面板：按 task 分组 + 版本下拉。
- 增改后写回：`patchProjectAsset` payload + `persistScriptPackageSnapshotsToAsset`。

## 5. 画布交互

### 5.1 创建节点自动聚焦

- `selectPro2NodeAfterSpawn` / `selectSbv1NodeAfterSpawn` → `focusCanvasNode`（`fitView`）。
- 覆盖：spawn、claim、paste、palette、shortcut。

### 5.2 组级工作流分享

1. `extractGroupSubgraph`：组 + 子节点 + 组内边。
2. `stripRuntimeForTemplate({ keepPersistableMedia: true })`：公开分享保留 OSS 媒体快照；私有结构模板可清媒体。
3. 写入 `thumbnail`（首张可持久化媒体 URL）供首页卡片拼贴。
4. 首页 Templates / Featured 卡片用 `TemplateSnapshotPreview` 显示快照；预览弹层用只读画布。
5. `cloneGraphForNewProject` fork 时保留模板内 ossUrl。

## 6. 数据模型与 API

### Prisma `CanvasTemplate` 扩展字段

- `description`, `visibility` (`private`|`public`), `featured`, `edition`, `forkCount`, `sourceLabel`

### API（book-mall `/api/canvas/templates`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `?scope=featured\|public\|my\|all` | 列表 |
| POST | `/` | 创建（含 visibility） |
| PATCH | `/[id]` | 更新名称/描述/可见性 |
| DELETE | `/[id]` | 删除 |
| POST | `/[id]/fork` | 复制模板，`forkCount++` |

## 7. 非功能需求

- 公开模板：只读预览 + fork；不可 PATCH 他人模板。
- 私有模板：仅 owner 可见与编辑。
- 分享前清洗 runtime/ossUrl，避免泄露用户当次素材。

## 8. 变更记录

| 日期 | 变更 |
|------|------|
| 2026-07-14 | 首版：门户首页、子导航、公告栏增改/去重、组级分享、模板 API、节点聚焦 |
