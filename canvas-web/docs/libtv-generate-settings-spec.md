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

## 1. 批量 / 嵌套弹层（与 Dock 同款双下拉）

批量弹层内的模型与参数 **必须** 复用 §0 的 Dock 双钮组件，**禁止** 再用 `EnginePicker` 卡片网格或平铺 `LabeledSegment` 段落 —— 同一参数在节点与弹层里应是同一个交互。

| 规则 | 说明 |
| --- | --- |
| **组件** | `Sbv1ImageDockModelPicker` + `Sbv1ImageDockParamsPicker`（视频/LLM/TTS 同理取对应一对） |
| **容器** | 双钮同一行 `flex flex-wrap items-center gap-0.5`，外层 `rounded-xl border border-white/10 bg-black/25 px-1 py-1` |
| **互斥** | 宿主持有 `dockMenu: 'model' \| 'params' \| null` |
| **草稿态** | 弹层用本地 `draft` + `onPatch` 收敛，`确认` 时一次性回传；未选模型禁用 `确认` |
| **层级** | 弹层内须包 `LibtvToolbarDropdownZProvider zIndex={modalZIndex + 10}`，否则下拉落到弹层背后 |
| **弹层宽度** | `max-w-lg` |

已接入：`Sbv1ImageGenerateSettingsModal` · `Pro2CharacterThreeViewPicker`（角色三视图批量，直接内联双钮、不再套一层设置弹层）。

## 2. 参数分组（视频 · sbv1）

参数 Popover 内 `LibtvDockParamGrid` 顺序：**参考模式 + 分辨率** → **比例** → **时长** → **生成音频 + 水印**。

## 3. 参数分组（图片 · sbv1）

参数 Popover 内 `LibtvDockParamGrid` 顺序：**画质** → **清晰度** → **比例** → **张数** → **格式**。

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
- [ ] 批量弹层是否复用同一对 Dock 双钮（而非 `EnginePicker` 卡片网格）？
- [ ] 批量弹层是否包了 `LibtvToolbarDropdownZProvider`？
- [ ] 弹层打开时节点顶栏是否收起（`data-canvas-modal-open` + `useModalBodyScrollLock`）？
- [ ] Dock 是否对 `MentionsTextarea` 开启 `mentionInlineThumb`？
