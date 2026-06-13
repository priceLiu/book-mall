# Dock @mention · 悬停预览

## 行为

Pro2 与 sbv1 所有节点底部 **浮动 Dock** 文案区使用 `MentionsTextarea`。用户将鼠标移到已插入的 `@标签` 上时，若该 mentionable 带 `previewUrl`，在 mention 上方弹出 **280×280** 缩略预览（图片 / 视频 loop）。

| 场景 | 说明 |
| --- | --- |
| 触发 | `mousemove` 命中 `@label` 字符范围 |
| 关闭 | 移出 textarea 或移出 mention |
| 与 @ 选择器 | `@` 弹层打开时 **不** 显示悬停预览 |
| 无图 | 无 `previewUrl` 时不弹层（与选择器缩略图规则一致） |

## 唯一实现

| 层级 | 模块 |
| --- | --- |
| 文案输入 | `components/canvas/mentions/MentionsTextarea.tsx` · `mentionHoverPreview` 默认 `true` |
| 悬停 Portal | `components/canvas/mentions/mention-hover-preview.tsx` |
| 命中检测 | `lib/canvas/mention-at-display-index.ts` |
| 坐标 | `lib/canvas/textarea-caret-rect.ts` · `getTextareaIndexFromClientPoint` · `getMentionRangeClientRect` |

**禁止** 在各 Dock 组件内单独写 hover 预览；扩展 `MentionsTextarea` 或 mentionable 数据即可。

## mentionable 数据

| 版 | 构建函数 | `previewUrl` 来源 |
| --- | --- | --- |
| Pro2 | `buildPro2DockMentionables` | 上游 link / ref / 项目资产 thumbnail |
| sbv1 | `buildSbv1DockMentionables` | `Sbv1UpstreamRefLink.previewUrl` |

新增 Dock 引用类型时 **必须** 填 `previewUrl`，否则悬停与 @ 列表均无缩略图。

## 视觉 token

```
rounded-xl border border-white/15 bg-[#0c0c12]
shadow-[0_20px_60px_rgba(0,0,0,0.65)] ring-1 ring-white/10
aspect-square object-contain
脚注 @label · text-[11px] text-white/75
z-index 5100 · pointer-events-none · createPortal → document.body
```

## 接入 Dock（已覆盖，勿重复）

- Pro2：`Pro2ImageInputDock` · `Pro2ThreeViewInputDock` · `Pro2StarterInputDock` · `Pro2ScriptInputDock` · frame cell dock 等
- sbv1：`Sbv1ImageInputDock` · `Sbv1VideoEngineFloatingDock` / chat input

关闭悬停（极少数非 Dock 场景）：`<MentionsTextarea mentionHoverPreview={false} />`
