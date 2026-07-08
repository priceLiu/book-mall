# LibTV 生成参数弹层规范（Pro2 · sbv1）

> 适用：浮动 Dock 底栏模型/参数选择 · 批量弹层（`Sbv1ImageGenerateSettingsModal` 等）· 关联：`pro2-model-picker.mdc` · `EnginePicker` · `libtv-node-interaction-spec.md`

## 0. 浮动 Dock · 模型 / 参数双钮（强制）

**所有** Pro2 2.0 / sbv1 媒体与文本浮动 Dock，底栏须采用与 **分镜视频**（`sbv1-video-engine`）相同的 **双触发钮** 模式，禁止再用单一「选择模型与参数」合并钮或 Dock 内嵌全屏 `EnginePicker` 弹层。

| 组件 | 路径 | 用途 |
| --- | --- | --- |
| `LibtvDockEngineModelPicker` | `libtv-dock-engine-model-picker.tsx` | 通用 Gateway 模型列表 Popover |
| `LibtvDockGatewayParamsPicker` | `libtv-dock-gateway-params-picker.tsx` | Gateway `paramsSchema` · `DynamicParamForm` |
| `Sbv1ImageDockModelPicker` / `Sbv1ImageDockParamsPicker` | `sbv1/sbv1-image-dock-pickers.tsx` | 图片 · 画质/清晰度/比例/张数/格式 |
| `Sbv1VideoDockModelPicker` / `Sbv1VideoDockParamsPicker` | `sbv1/sbv1-video-dock-pickers.tsx` | 视频 · 比例/分辨率/参考模式/时长 |
| `Pro2LlmDockModelPicker` / `Pro2LlmDockParamsPicker` | `pro2/pro2-llm-dock-pickers.tsx` | 剧本 / 文本 LLM |
| `LibtvTtsDockModelPicker` / `LibtvTtsDockParamsPicker` | `libtv-audio-dock-pickers.tsx` | 音频 TTS |
| `Sbv1ToolbarDropdown` · `useSbv1ToolbarAnchor` | `sbv1/sbv1-toolbar-anchor-popover.tsx` | 锚点 Popover · `placement=auto` · z 1100/1101 |
| `LibtvDockParamGrid` | `libtv-dock-picker-chrome.tsx` | 参数分段网格 |

### 交互规则

| 规则 | 说明 |
| --- | --- |
| **模型钮** | `Sparkles` + Gateway `displayName`；未选时「选择模型」 |
| **参数钮** | `SlidersHorizontal` + 紧凑摘要（如 `16:9 · 2K · 标准 · 1张 · png`）；未选模型时 disabled |
| **互斥** | 同一 Dock 内 `dockMenu: 'model' \| 'params' \| null`，打开其一关闭另一 |
| **即时生效** | Popover 内点选即 `onPatch` / `updateNodeData`，无确认钮 |
| **数据来源** | `useUserProviders()` · `collectLibtvDockEngineModels`；禁止硬编码模型卡片 |
| **多 role** | 文本节点（`story-pro2-starter`）按 role 分组，每组各一对模型+参数钮 |

### 已接入 Dock

| 节点 type | Dock | 模型/参数组件 |
| --- | --- | --- |
| `sbv1-video-engine` | `Sbv1VideoEngineFloatingDock` | Video pickers |
| `sbv1-image` · `story-pro2-image` · `story-pro2-prop` · `story-pro2-mood` | `LibtvImageInputDock` | Image pickers |
| `story-pro2-three-view` | `Pro2ThreeViewInputDock` | Image pickers |
| `story-pro2-script-hub` | `Pro2ScriptInputDock` | LLM pickers |
| `story-pro2-audio` | `LibtvAudioInputDock` | TTS pickers |
| `story-pro2-starter` | `Pro2StarterInputDock` → `Pro2TextNodeEnginePickers` | 按 role · Engine + Gateway pickers |

流水线组内非 frame 图片格（scene/prop/mood in group）：模型在列控制器，Dock **不展示** 模型钮（保持不变）。

---

## 1. 全屏弹层布局原则（批量 / 嵌套场景保留）

| 规则 | 说明 |
| --- | --- |
| **模型优先** | 第一块必须是 **模型选择**（`EnginePicker` · `modelsOnly`） |
| **紧凑** | 标签 `text-[12px] text-white/55` · 段按钮 `px-2 py-1 text-[11px~12px]` · 区块间距 `space-y-3` |
| **合并行** | 同类短选项尽量同一行 |
| **不重复** | `modelsOnly` 时禁止弹层内再渲染 `DynamicParamForm` |
| **弹层宽度** | `max-w-2xl` |

## 2. 块顺序（视频 · sbv1）

1. **模型** — `EnginePicker` · `role="VIDEO"` · `modelsOnly`
2. **参考模式 + 分辨率** — 720p / 1080p
3. **比例** · **时长** · **生成音频 + 水印**

## 3. 块顺序（图片 · sbv1）

1. **模型** — `EnginePicker` · `role="IMAGE"` · `modelsOnly`
2. **画质 + 清晰度** · **比例** · **张数 + 格式**

## 4. 默认值（视频）

| 参数 | 默认 |
| --- | --- |
| `generate_audio` | `true` |
| `watermark` | `false` |
| `resolution` | 节点已有值，否则 `720p` |
| `duration` | 15s（非智能多帧） |

## 5. Dock @ 内联缩略图

> **完整规范**：[`libtv-dock-input-spec.md`](./libtv-dock-input-spec.md) §2

## 6. Code Review

- [ ] 浮动 Dock 是否为 **模型 + 参数** 双钮？
- [ ] Popover 是否 `useSbv1ToolbarAnchor` + z ≥ 1100？
- [ ] 模型列表是否走 Gateway providers？
- [ ] 全屏弹层（若保留）第一块是否为模型？
- [ ] Dock 是否对 `MentionsTextarea` 开启 `mentionInlineThumb`？
