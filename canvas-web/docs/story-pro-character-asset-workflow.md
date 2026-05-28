# 影视专业版 · 角色资产库与工作流说明

> **读者**：产品 / 导演 / 画布操作者  
> **技术真源**：[story-pro-workflow-canonical.md](./story-pro-workflow-canonical.md) · [2026-story-pro-character-consistency.md](../../book-mall/doc/plans/2026-story-pro-character-consistency.md)

---

## 1. 为什么需要角色资产库

影视专业版的成片质量取决于 **同一角色在多镜之间视觉一致**。仅靠「每镜临时 @ 一张三视图」不够稳定，因此引入 **项目级角色资产库**：

| 概念 | 说明 |
|------|------|
| `characterKey` | 与剧本「角色视觉辞典」姓名规范化后的 key（全项目唯一） |
| 四槽参考 | 脸 / 全身 / 服装 / 三视图 — 点击/拖入/粘贴上传、从生成图入库、锁定 |
| `@` 多 ref | 分镜 prompt 中 `@<ref-id>`，runner 组装 `imageInputs[]` 送 Gateway |

资产库数据存于 book-mall：`StoryProCharacterAsset` / `StoryProCharacterAssetRef`，按 **用户 + projectId** 隔离。

---

## 2. 标准生产流水线（含资产库）

```text
A 故事定稿          → scriptFinalized
B 风格定稿          → styleFinalized（锚定词 + ≥3 张风格参考图）
C 人物设计          → 四槽入库（每主角至少三视图 + 建议脸/全身）
D 场景设计          → 场景参考图（可选）
E 分镜静帧          → prompt 中 @ 角色资产 → 生成分镜图 → 【人工过审】
F 分镜视频          → 仅 i2v，以过审静帧为主图
G 剪映导出
```

### 2.1 阶段 C · 人物设计（资产入库）

1. 风格定稿后，`story-pro-character` 按辞典拆行。
2. 每行先生成 **三视图**（EnginePicker · 三视图白名单）。
3. 在 **四槽面板** 中：
   - **上传**：脸 / 全身 / 服装 / 三视图 — **点击 / 拖入 / 粘贴**（见 [design.md §13](./design.md#13-图片上传控件必须)）；
   - **生成**：三视图槽可一键用当前生成结果入库；
   - **锁定**：锁定后的 ref 会优先进入分镜 `@` 目录。
4. 工具栏 **「项目资产」** 可总览角色/场景、预览、整包锁定（含 version）。

**建议最低标准（每主角）**：三视图 1 张 + 脸 1 张；多人同框镜头建议补全身/服装。

### 2.3 阶段 D · 场景设计（场景资产入库 · 可选）

1. `story-pro-scene` 按分镜表拆分场景行。
2. 每行可生成 **场景参考图**（EnginePicker · 三视图白名单 / multi_ref）。
3. 在 **三槽面板** 中保存 **全景 / 细节 / 氛围** 参考到 `StoryProSceneAsset`。
4. 分镜列 `@` 目录合并角色 + 场景 ref，跨镜复用。

### 2.4 阶段 E · 分镜静帧（消费资产）

1. `story-pro-frame` 自动加载本项目角色 + 场景资产，构建 `@` 目录。
2. 行内 **建议 @** 可一键插入对白中出现的角色；底栏 **「为本列补齐 @ 角色」** 可批量写入。
3. 可选开关 **「注入风格参考图」**：将风格节点 ref 图追加到 `imageInputs`（最多 2 张，与角色 ref 合计 ≤8）。
4. 在分镜 prompt 中 `@` 出场角色/场景（可多个）。
5. 选择 **分镜静帧 IMAGE 模型**（见 §3），生成静帧。
6. 保存 prompt 时写入 **资产 version 快照**；若后续换 ref，行内提示「资产已更新 · 建议重跑静帧」。
7. 点击 **「通过」** 后，才允许该镜生视频（`FRAME_NOT_APPROVED` 门禁）。

Runner 行为：

- 解析 prompt 中 `@<id>` → `refImages` / `refImageUrls`；
- `runStoryProFrameRow` 将 URL 列表写入 `imageInputs`（最多 8 张）；
- 服务端按行校验：有 @ 时须 `image_multi_ref` 模型。

### 2.5 阶段 F · 视频

- 主图 = 过审分镜静帧；
- `@` 角色 ref 作为辅助参考（不替代主图）；
- 模型须 **i2v**（Kling / Seedance / Wan / HappyHorse 等）。

---

## 3. 静帧 · KIE 与支持模型

分镜静帧 IMAGE 白名单：`STORY_PRO_FRAME_IMAGE_MODEL_KEYS`（`lib/canvas/story-prompts.ts`），与 `book-mall/lib/canvas/providers/kie.ts` 的 `buildKieImageCreateArgs` 对齐。

| modelKey | 厂商 | multi_ref | KIE 参考图字段 | 适用场景 |
|----------|------|-----------|----------------|----------|
| `nano-banana-pro` | Google | ✅ 多图 | `image_input[]` | 风格融合、角色一致、默认推荐 |
| `flux-2-pro` | BFL | ✅ 多图 | `input_urls[]` | 写实、电影感静帧 |
| `seedream-5-lite` | 字节 | ✅ 多图 | `image_urls[]` | 写实、快速迭代 |
| `seedream-4.5` | 字节 | ✅ 多图 | `image_urls[]` | 高质量写实 |
| `gpt-image-2` | OpenAI | ✅ 多图 | `input_urls[]` | 海报感、构图 |
| `gpt-image-1` | OpenAI | ✅ 多图 | `input_urls[]` | 排版、平面 |
| `hunyuan-3d-pro` | 腾讯 | ✅ | Gateway HUNYUAN | 三视图/人设（非 KIE） |
| `hunyuan-3d-express` | 腾讯 | ✅ | Gateway HUNYUAN | 同上 · 快速 |
| `qwen-text-to-image` | 阿里 | ⚠️ 仅单图 | `image_url` | **无 @ 角色** 的纯场景静帧 |

**选型建议**：

- 有 `@` 多角色 → `nano-banana-pro` / `flux-2-pro` / `seedream-*` / `gpt-image-*`
- 无角色、纯场景 → 可用 `qwen-text-to-image`
- 默认参数：分镜建议 `aspect_ratio: 16:9`，`resolution: 2K`

---

## 4. 与风格层的关系

| 来源 | 注入方式 | 作用 |
|------|----------|------|
| 风格节点 `refImages` | 文本锚定 + 可选「注入风格参考图」开关 | 全片色调/画风 |
| 角色资产库 | 分镜 `@` + `imageInputs` | 人物外形一致 |
| 场景资产库 | 场景列三槽 + 分镜 `@` | 环境一致 |

**当前行为**：分镜 runner 默认仅文本锚定风格；开启「注入风格参考图」后，会将风格节点 ref 图追加到 `imageInputs`（P-A2）。

---

## 5. 工作流是否需要调整？

### 5.1 已具备（无需改节点链）

- 五阶段节点顺序不变；
- 资产库为 **横切能力**，不改变定稿 / spawn 语义；
- 门禁：静帧先行 + 过审 + i2v + multi_ref 校验；
- P-A1～P-B2 增强项已全部落地（见 rollout 计划）。

### 5.2 可选后续

| 方向 | 说明 |
|------|------|
| 硬门禁 missing 资产 | 产品确认后可禁用「生成静帧」按钮 |
| 场景 version 快照 | 可镜像 B2 逻辑到场景 ref |

---

## 6. 操作检查清单

**开拍前**

- [ ] 故事定稿 + 风格定稿
- [ ] 每个主角四槽至少有三视图（+ 建议脸）
- [ ] 工具栏「项目资产」检查角色/场景锁定与 version

**每镜静帧**

- [ ] prompt `@` 本镜出场角色
- [ ] 选对 IMAGE 模型（有 @ → multi_ref）
- [ ] 生成后点 **通过**

**生视频**

- [ ] 分镜图已过审
- [ ] VIDEO 模型为 i2v

---

## 7. 相关入口

| 入口 | 位置 |
|------|------|
| 四槽 UI | `story-pro-character` 每行下方 |
| 场景三槽 UI | `story-pro-scene` 每行下方 |
| 项目资产侧栏 | 工具栏「项目资产」（角色 / 场景 Tab） |
| 分镜 @ 目录 | `story-pro-frame` prompt 编辑器 |
| API | `GET/POST /api/canvas/story-pro/character-assets` · `.../scene-assets` |

---

## 8. 变更本文

须同步更新 `story-pro-workflow-canonical.md` 门禁表与 `book-mall/doc/plans/2026-story-pro-asset-workflow-rollout.md`。
