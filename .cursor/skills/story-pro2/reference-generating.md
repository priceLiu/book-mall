# Pro2 / LibTV · 生图 / 生视频 · 生成中扫光

真源组件：`canvas-web/components/canvas/libtv-media-generating-state.tsx`  
CSS 动画：`canvas-web/app/globals.css` · `@keyframes canvas-story-media-shimmer`  
Token：`canvas-web/lib/canvas/libtv-node-chrome.ts` · `LIBTV_MEDIA_GENERATING_*`

## 硬性要求

**凡 LibTV 媒体卡 stage 处于「生图 / 生视频 / 上传入库」进行中，必须挂载 `LibtvMediaGeneratingState`。**

| 场景 | 必须扫光 |
| --- | --- |
| Pro2 分镜图 / 图片生成 | ✅ |
| Pro2 三视图生成 | ✅ |
| sbv1 图片生成 / 上传 | ✅ |
| sbv1 视频引擎生成 | ✅ |
| 未来 Pro2 视频节点 | ✅（`variant="violet"`） |

**禁止**

- 仅 `Loader2` + 静态文案、无外框扫光
- 自写第二套 shimmer / `@keyframes`
- Pro2 媒体生成用橙色扫光或 sbv1 用 violet 扫光（色不对版）

## 组件用法

```tsx
import { LibtvMediaGeneratingState } from "@/components/canvas/libtv-media-generating-state";

// Pro2 生图 / 三视图
<LibtvMediaGeneratingState label="生成三视图中…" variant="violet" />

// sbv1 生视频
<LibtvMediaGeneratingState label="视频生成中…" variant="cyan" />

// 上传中带半透明底图
<LibtvMediaGeneratingState label="上传中…" variant="cyan">
  {previewUrl ? <img src={previewUrl} className="absolute inset-0 size-full object-contain opacity-40" /> : null}
</LibtvMediaGeneratingState>
```

| prop | 值 |
| --- | --- |
| `variant="violet"` | Pro2 · `LIBTV_MEDIA_GENERATING_VIOLET_CLASS` |
| `variant="cyan"` | sbv1 / 分镜1.0 · `LIBTV_MEDIA_GENERATING_CYAN_CLASS` |
| `label` | 用户可见状态文案（生图中… / 视频生成中… / 上传中…） |

## 视觉效果（三层）

1. **外框光晕** — `box-shadow` cyan 或 violet（`.canvas-story-media-generating` + `-pro` / `-pro2`）
2. **扫光** — `::after` 斜向渐变 · `canvas-story-media-shimmer` 1.4s 循环
3. **中央** — `RefreshCw` · `storyEditionSpinClass(pro|pro2, "lg")` + 半透明遮罩 `bg-black/45`

容器须 `absolute inset-0 overflow-hidden`（组件内已含）。

## 触发条件（节点 data）

统一用 **`isLibtvMediaGenerating(data)`**（`libtv-media-generating-state.tsx`）：

```typescript
uploading === true
|| runtime.status === "pending" | "running"
```

| 节点 | 文案示例 |
| --- | --- |
| `story-pro2-image` | 图片生成中… / 上传中… / 生成三视图中… |
| `story-pro2-three-view` | 生成三视图中… / 上传中… |
| `sbv1-image` | 上传中… / 图片生成中… |
| `sbv1-video-engine` | 视频生成中… |

## 已接入文件

| 文件 | 文案 |
| --- | --- |
| `pro2/story-pro2-image-node.tsx` | 上传中… / 生成三视图中… |
| `pro2/story-pro2-three-view-node.tsx` | 生成三视图中… |
| `sbv1/sbv1-image-node.tsx` | 上传中… |
| `sbv1/sbv1-video-engine-node.tsx` | 视频生成中… |

## Code Review

- [ ] 生图 **与** 生视频 stage 均用 `LibtvMediaGeneratingState`
- [ ] 未单独写 `Loader2` 占满 stage 代替扫光
- [ ] `variant` 与版别一致（Pro2 violet · sbv1 cyan）
- [ ] 扫光 CSS 仅来自 `globals.css`，未复制 keyframes
