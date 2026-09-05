# 发布说明：Pro2 剧本类别预设与 Prompt 对齐

**日期**：2026-08-01

## 面向用户

### 故事脚本生成节点 · 空态

- 移除底部红色引导小字。
- **左栏**：保留「上传剧本 / 文生视频 / 角色」三条能力快捷（`TRY_ACTIONS`）。
- **右栏**：新增 **剧本类别**：
  - **古风甜宠短剧剧本** — 顶栏「剧本类别参考」chip 预览/编辑 `docs/古风田宠短剧.md`（sync 内嵌）；**outline 段**注入类别参考，character/scene/storyboard 段走 v6 段 prompt + 上游 textInputs（不重复整份 doc）。
  - **默认剧本大师** — 使用升级版默认 prompt pack（v5），不含古风甜宠铁律。

### 交互（方案 A）

点击类别 → 在当前 hub **左侧** 自动 spawn `story-pro2-starter` 并连线 `text → in_text`；若已有上游文本节点，则 **仅更新 preset**（不重复 spawn）。

### 生成流程（不变）

Dock 发送仍走四段 LLM：`outline → character → scene → storyboard`；Tab 解析仍为 GFM 制作包表头，后续三视图 / 分镜图板流程不变。

## Prompt 变更摘要

| 项 | 说明 |
|---|---|
| `STORY_PRO2_PACK_PROMPT_VERSION` | **5 → 6**（2026-08-01 二次发布）；旧画布 hydrate 时 migrate 刷新 hub 段 prompt |
| 默认 pack v6 | 与古风 pack **同一 GFM 标准**：摄影级视觉风格表、核心冲突 GFM 表、9 列分镜、中文 Seedance 视频列、【起始】站位、4 镜完整 few-shot |
| 古风 pack | 在 v6 共享标准上叠加甜宠铁律 1–3 + 类别参考文档（含 example 级范例说明） |
| 导演上传路径 | `STORY_PRO_PACK_PROMPT_VERSION` **1 → 2**；骨架同步 9 列 + Seedance |
| migrate 修复 | gu-feng hub 升级 v6 时 **保留** gu-feng pack（不再被 default 覆盖） |
| 文档真源 | `docs/example.md` 14 镜金标准；`docs/古风田宠短剧.md` v6 铁律 + GFM 锚点（`pnpm sync:pro2-gu-feng-doc`） |
| 分镜 prompt 减载 | 段 prompt 用 2 镜 compact few-shot；完整规范在类别参考 + `docs/example.md` |

## 用户操作路径

1. 新建或选中空的 **故事脚本生成** 节点。
2. 右栏点 **古风甜宠短剧剧本** 或 **默认剧本大师** → 左侧出现/更新文本节点。
3. 在文本节点填写梗概，在 hub Dock 选模型并发送。
4. 检视 Tab 解析 GFM 表；继续 **生成三视图 / 分镜图**（与现网一致）。

## 财务 · 平台模型自动上架

**执行时间**：2026-08-01 17:46–18:00 CST（UTC 09:46–10:00）

**命令**：

```bash
cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/seed-platform-model-costs.ts
```

**结果**（exit 0，约 14 分钟）：

- `[ok] upserted 114 cost profile(s)`
- `[ok] auto-publish: 106 active, 2 skipped`
- 跳过原因（无合规路由）：
  - `Eleven/english-sts-v2`
  - `seedream-5-lite`

## 回归清单

| 场景 | 预期 |
|------|------|
| 空 hub 点「古风甜宠…」 | 左侧文本 + 连线；顶栏类别参考 chip（非 Dock `@docs`） |
| 空 hub 点「默认剧本大师」 | 同上；默认 pack，无古风铁律 |
| 已有上游文本再点类别 | 不重复 spawn；更新 preset |
| Dock 发送 | 四段 LLM；Tab GFM；分镜 ≥8 镜 |
| 旧画布 hydrate | pack v5 migrate；无 `scriptCategoryId` 行为与默认大师一致 |
| 财务 seed | 114 成本档 + 106 自动上架 |

## 参考

- 实施计划：`book-mall/doc/plans/2026-08-pro2-script-category-presets.md`
- 节点状态：`canvas-web/docs/libtv-node-state-spec.md`
- Pro2 设计：`canvas-web/docs/story-pro2-design-spec.md` §9.3
