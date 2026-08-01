# Pro2 剧本类别预设与 Prompt 对齐实施计划

> 实施 checklist 真源 · 2026-08

## 目标

- **UI**：`story-pro2-script-hub` 空态删底部引导小字；左栏三条能力快捷；右栏 **「古风甜宠短剧剧本」**、**「默认剧本大师」**。
- **交互（方案 A）**：点击类别 → 当前 hub **左侧** spawn `story-pro2-starter` + 连线，不新建第二个 hub。
- **结构化**：不改 `enqueuePro2ScriptGeneration` 四段顺序；古风铁律映射进 GFM 制作包表头。
- **默认 prompt v5**：吸收站位起止、视觉锚点锁定、Negative ban list 等通用约束（不含甜宠铁律）。
- **运维**：`seed-platform-model-costs.ts` 全量自动上架。
- **发布**：`docs/releases/2026-08-pro2-script-category-presets.md`

## 关键文件

| 区域 | 路径 |
|------|------|
| 类别 registry | `canvas-web/lib/canvas/pro2-script-category-presets.ts` |
| Spawn A | `canvas-web/lib/canvas/spawn-pro2-script-category-from-hub.ts` |
| Hub UI | `canvas-web/components/canvas/pro2/story-pro2-script-hub-node.tsx` |
| Prompt 真源 | `canvas-web/lib/canvas/story-pro2-theme-outline-prompt.ts`（book-mall 镜像） |
| 古风内嵌 | `canvas-web/lib/canvas/data/pro2-gu-feng-*.ts` |
| 生成接入 | `canvas-web/lib/canvas/pro2-script-hub-helpers.ts` |

## 回归清单

| 场景 | 预期 |
|------|------|
| 空 hub 点「古风甜宠…」 | 左侧文本 + 连线；dock `@docs/古风田宠短剧.md` |
| 空 hub 点「默认剧本大师」 | 同上；默认 pack，无古风铁律 |
| 已有上游再点类别 | 不重复 spawn；更新 preset |
| Dock 发送 | 四段 LLM；GFM Tab 可解析 |
| 旧画布 hydrate | pack v5 migrate |
| 财务 publish | 平台模型挂牌价同步 |
