# 全站 · 后台生成 Dock 规范

> **状态**：v1 · 电商工具箱故事版已接入；Canvas 影视专业版沿用 `CanvasBackgroundVideoPanel`（dark 变体），须与本规范对齐。

## 1. 目标

所有子应用中 **耗时 AI 生成任务**（生图、生视频、合成等），在 **前台等待超时** 或 **用户继续操作** 时：

1. **不得** silently 丢失任务或误导用户重复提交（重复计费）；
2. **必须** 缩至 **右下角 Dock**，展示 **进度/已等待时长** 与 **状态文案**；
3. Gateway `RUNNING` 任务由 **gateway:poll-loop** 继续收口；Dock 仅负责 **用户可见进度** 与 **完成后通知/写回**。

## 2. 时间与文案（真源）

代码常量：`book-mall/lib/generation/background-generation-dock-policy.ts`

| 阈值 | 默认 | 行为 |
|------|------|------|
| `BACKGROUND_DOCK_FOREGROUND_MS` | 3 min | 超时后内联 busy（TaskStatus / 卡片扫光）**自动最小化**至 Dock |
| `BACKGROUND_DOCK_PERSISTENT_MS` | 15 min | 文案切换为 **「持续后台生成中…」**（与 Gateway `VIDEO_BACKGROUND_UI_MS` 一致） |
| `BACKGROUND_DOCK_POLL_MS` | 15 s | Dock 轮询间隔 |
| `BACKGROUND_DOCK_FOREGROUND_POLL_MS` | 4 s | 前台轮询间隔（可选，故事版整图成片） |

## 3. UI 结构（统一）

```
fixed bottom-4 right-4 z-[200]
├─ [collapsed] 胶囊钮：图标 + 「后台生成 · N」+ 旋转/进度环
└─ [expanded]  面板 max-w-[22rem]
   ├─ 标题栏：类型图标 + 标题 + 最小化/关闭
   ├─ 任务列表（可滚动）
   │  └─ 每项：label · hint · 已等待 · 细进度条（伪进度或 indeterminate）
   └─ 完成项：「查看结果 / 加载到节点 / 刷新」主操作
```

### 3.1 视觉变体

| 变体 | 应用 | 面板底 | 强调色 | 组件 |
|------|------|--------|--------|------|
| **light** | 电商工具箱、tool-web | 白 `#ffffff` + 描边 `#e8e8ed` | 品牌蓝 `#0071e3` | `BackgroundGenerationDock` `variant="light"` |
| **dark** | canvas-web、story-web Pro | `#141418/98` + 描边 `orange-400/35` | 橙 `#fb923c` | `CanvasBackgroundVideoPanel`（迁移对齐本规范） |

**禁止**各应用自写第二套右下角浮层。

## 4. 接入 checklist（新增长耗时生成）

- [ ] 提交成功后写入 **可恢复 pending**（DB `meta.workflow.*` 或 `CanvasGenerationTask` + `GatewayRequestLog`）
- [ ] 前台 busy ≤ `BACKGROUND_DOCK_FOREGROUND_MS`，随后 **registerTask** 至 Dock
- [ ] Dock `poll()` 调 **现有 status API**，不在前端直连厂商
- [ ] 成功：**`toast({ variant: "success" })`**（右下角自动消失，**禁止**阻塞 `alert`）+ 写回业务实体 + 清除 pending
- [ ] 失败：Dock 展示错误，允许 dismiss；**禁止**仅 `console.error`
- [ ] 规范引用写入 PR（本文件 + 对应 `.cursor/rules/background-generation-dock.mdc`）

## 5. 已接入入口

| 应用 | 场景 | 实现 |
|------|------|------|
| canvas-web | 画布视频 ≥15min 后台 | `canvas-background-video-panel.tsx` |
| e-commerce-toolkit | 故事版整图成片 / 单镜视频 | `BackgroundGenerationProvider` + `storyboard-content-panel` |
| gateway-web | 状态驾驶舱 | 只读 `GatewayRequestLog`，非 Dock |

## 6. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-08-30 | v1.1：完成通知统一 toast（`ecom-success-toast.mdc`），禁止阻塞 alert |
| 2026-08-30 | v1：规范文档 + 电商故事版 light Dock |
