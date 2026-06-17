# LibTV 生成参数弹层规范（Pro2 · sbv1）

> 适用：`Sbv1ImageGenerateSettingsModal` · `Sbv1VideoGenerateSettingsModal` 及后续 Pro2 同类弹层。  
> 关联：`pro2-model-picker.mdc` · `EnginePicker` · `libtv-node-interaction-spec.md`

## 1. 布局原则

| 规则 | 说明 |
| --- | --- |
| **模型优先** | 第一块（第一行）必须是 **模型选择**（`EnginePicker` · `modelsOnly`） |
| **紧凑** | 标签 `text-[12px] text-white/55` · 段按钮 `px-2 py-1 text-[11px~12px]` · 区块间距 `space-y-3` |
| **合并行** | 同类短选项尽量同一行（如参考模式 + 分辨率；画质 + 清晰度） |
| **不重复** | `modelsOnly` 时 **禁止** 在弹层内再渲染 `EnginePicker` 的 `DynamicParamForm`；分辨率/时长/音频/水印由弹层自控 |
| **弹层宽度** | 图片 `max-w-2xl` · 视频 `max-w-2xl`（较旧 `max-w-3xl` 须收紧） |

## 2. 块顺序（视频 · sbv1）

1. **模型** — `EnginePicker` · `role="VIDEO"` · `modelsOnly` · `SBV1_VOLCENGINE_GATEWAY_MODEL_KEYS`
2. **参考模式 + 分辨率** — 同一行 · 分辨率仅 **720p / 1080p**（Gateway `VIDEO_PARAM_SCHEMA` 无 480p 时不展示）
3. **比例** — 单行 segment · `compact`
4. **时长** — 4～15s 滑条（智能多帧模式隐藏）
5. **生成音频 + 水印** — 同一行 · 各「开启 / 关闭」双钮 · 默认 **音频开 · 水印关**

## 3. 块顺序（图片 · sbv1）

1. **模型** — `EnginePicker` · `role="IMAGE"` · `modelsOnly`
2. **画质 + 清晰度** — 同一行
3. **比例** — `compact`
4. **张数 + 格式** — 同一行

## 4. 默认值（视频）

| 参数 | 默认 |
| --- | --- |
| `generate_audio` | `true` |
| `watermark` | `false` |
| `resolution` | 节点已有值，否则 `720p` |
| `duration` | 15s（非智能多帧） |

写入 `engine.params` 与节点顶层字段（`resolution` · `durationSec`）须 **同步**（见 `Sbv1VideoGenerateSettingsModal.handleConfirm`）。

## 5. Dock @ 内联缩略图

| 规则 | 说明 |
| --- | --- |
| 开关 | `MentionsTextarea` · `mentionInlineThumb` |
| 位置 | **@ 标签文字右侧**（文案输入区内，非 footer） |
| 实现 | `mention-inline-thumbs.tsx` · `findAllMentionRangesInDisplay` |

**禁止** footer 工具栏上方 pill 行。

## 6. Code Review

- [ ] 新弹层第一块是否为模型？
- [ ] `EnginePicker` 是否 `modelsOnly` 且无重复参数区？
- [ ] 视频分辨率是否仅 API 支持的档位？
- [ ] Dock 是否对 `MentionsTextarea` 开启 `mentionInlineThumb`？
