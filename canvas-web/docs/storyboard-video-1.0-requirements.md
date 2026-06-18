# 分镜视频 1.0 · 需求规格

> 代号 `sbv1` · 与影视专业版 1.0/2.0、快手漫剧 **完全隔离**  
> 权威流程见 [storyboard-video-1.0-workflow-canonical.md](./storyboard-video-1.0-workflow-canonical.md)

## 1. 画布范围

| 节点 type | 说明 |
|-----------|------|
| `sbv1-image` | 参考图；支持粘贴多张、连线到视频合成 |
| `sbv1-video-engine` | **视频合成**；卡片 + 下方浮动 Dock（prompt / 模型 / 生成） |

禁止同画布出现 `story-pro*` / `story-pro2*` / `story-comic*` 节点。

**节点交互权威规范**（拖动 / 壳层 / Dock / 预览）：[storyboard-video-1.0-node-interaction-spec.md](./storyboard-video-1.0-node-interaction-spec.md)  
**样板节点**：`sbv1-video-engine`（视频合成）。

## 2. 视频合成 · 浮动 Dock（图1）

选中 `sbv1-video-engine` 时，**卡片下方**展示浮动 Dock（非卡片内嵌）：

- **Header**：按参考模式切换的内容区（参考槽 / 首尾帧 / 多帧列表）
- **ContextBar**：上游图片 chip（图10/11）
- **Body**：多行 prompt，`@图片N` 与 chip 编号一致
- **Footer 工具条**（左→右）：
  1. 创作类型（图2）— 仅「视频生成」可用
  2. Gateway 火山 Seedance 真人模型（图3）
  3. 参考模式（图4）
  4. 比例 / 分辨率 / 时长（图5–9）
  5. 消耗占位 + 生成（↑）

## 3. 创作类型（图2）

| 选项 | Phase 1 |
|------|---------|
| 视频生成 | ✅ 可用 |
| Agent / 图片 / 数字人 / 配音 / 动作模仿 | disabled +「即将推出」 |

## 4. 模型（图3 · Gateway 火山 Seedance 真人）

展示名与 Gateway `modelKey` 映射见 `lib/canvas/sbv1-video-models.ts`；列表经 Gateway introspect 校验。**真人人像**须先录入 [真人人像库](https://www.volcengine.com/docs/82379/2333589) 并通过审核，生成时引用 `asset://`。

详细说明见 [storyboard-video-1.0-volcengine-real-person.md](./storyboard-video-1.0-volcengine-real-person.md)。

## 5. 参考模式（图4–9）

| 模式 | key | 比例 | 时长 | 内容区 |
|------|-----|------|------|--------|
| 全能参考 | `omni` | 21:9–9:16 | 4–15s | 参考内容 + prompt |
| 首尾帧 | `first_last` | 同上 | 4–15s | 首帧 / 尾帧两槽 |
| 智能多帧 | `smart_multi` | 21:9–9:16 + 720P/1080P | **0s 只读** | 第 N 帧槽列表 |

**联动**：切换模式时裁剪非法字段；smart_multi 隐藏时长选择器。

## 6. 图片节点

- **交互对齐 Pro2 图片节点**（见 [node-interaction-spec](./storyboard-video-1.0-node-interaction-spec.md) §8）：
  - 顶栏 `Pro2ImageNodeToolbar`（有图且唯一选中）
  - 空态内嵌 Dock / 有图底部浮动 `Sbv1ImageInputDock`
  - 左右 `+` 菜单与 Pro2 相同（`PRO2_IMAGE_LEFT_ADD_MENU` / `PRO2_RIGHT_ADD_MENU`）；可生成项映射为 sbv1 节点（图片 → `sbv1-image`，视频合成 → `sbv1-video-engine`）
- 整卡拖动：**仅**内嵌/浮动 Dock 与小眼睛例外；顶栏工具条空白区可拖（`passNodeDrag`）
- 出边 `image` → 视频合成 `in_ref`；图片间 `in_image`
- **无** Pro2 分镜/三视图列节点

## 7. 上游 chip（图10/11）

- 入边 `sbv1-image` 按连线顺序编号 1…N
- 左上数字、hover 显示 **X**
- **X 仅 `removeEdge`**，不删除图片节点（与 Pro2 不同）

## 8. 生成与计费

- Gateway Volcengine Seedance（`doubao-seedance-*` / `ep-*`），**禁止直连 ARK**；须 `sk-gw` → `/api/gw/v1/jobs/createTask`
- **凭证**：默认 Gateway 别名 **「火山方舟 · 分镜视频1.0」**（Key 同平台 `VOLCENGINE_API_KEY`）；见 `volcengine-credential-pick.ts`
- 每次生成写入 `inputPayload.sbv1Billing` + Gateway 完整 Params
- 任务轮询：`GET /api/canvas/projects/:id/tasks`
- `clientPage`: `canvas/{projectId}/sbv1`
- 计价参考：46 元/百万 tokens（纯生成），详见 [volcengine-real-person.md](./storyboard-video-1.0-volcengine-real-person.md)

## 9. Phase 2 限制

- 智能多帧：Volcengine 单次 task 可能无法完整复刻即梦多镜头时间轴；Phase 1 为多图 reference 近似
- 创作类型其余五项仅占位
