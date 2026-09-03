# 拆图拆视频 · 产品需求

> **JSON 契约**：同目录 [`table-format.md`](./table-format.md)  
> **System Prompt 真源**：[`skill.md`](./skill.md)（`ecom-media-decompose-prompts.ts` 运行时读取）

## 1. 定位

电商工具箱内的 **图片/视频反推拆解** 单页工具：用户上传或粘贴素材 URL，经 Vision LLM 输出可落地的 **分镜拆解表**（视频）或 **画面要素 + 生图/实拍方案**（静态图）。

与「种草视频」对齐的是 **交付机制**（仅 `media-decompose` 围栏 JSON + Zod 校验；界面由 JSON 渲染），**不是**种草的业务字段（脚本/模式/成片）。

## 2. 入口与菜单

| 项 | 值 |
|----|-----|
| 技术 id | `media-decompose` |
| 路由 | `/ecom/media-decompose` |
| 侧栏 | **电商** 菜单（详情页 / 种草视频附近） |
| 手伴创作 | 从 **电商** 移至 **营销** 菜单 |

## 3. 输入方式

单项目 **仅 1 条素材**（图片或视频二选一）：

1. **本地文件**：拖拽 / 选择图片（jpg/png/webp 等）或视频（mp4 等）
2. **公网 HTTPS 链接**：粘贴图片或视频的真实网络地址；服务端校验协议、SSRF、Content-Type，必要时转存用户 OSS
3. **我的资产**：从 `EcomAssetPickerDialog` 选取已有条目

## 4. 交互流程

```
上传文件 / 粘贴 URL / 选资产
    → 自动识别 image | video
    → Prompt 区切换对应默认指令（用户可编辑）
    → 选择 Vision 模型（视频须 video-understanding 模型）
    → 点击「拆解」
    → 流式接收 ```media-decompose JSON
    → 解析 JSON → 结构化表格/卡片（系统渲染）
```

## 5. 默认 Prompt

见 [`skill.md`](./skill.md)：

- **视频**：JSON `storyboardTable`（17 列）+ 叙事逻辑 / 卡点要点 / 可复刻拍摄脚本
- **图片**：JSON `elements` + 正向/负向生图 Prompt + 实拍复刻方案

## 6. 模型约束

| 素材 | 模型白名单 |
|------|------------|
| 图片 | `isStoryLlmVisionModel`（与种草 `chatModels` 同源） |
| 视频 | `isStoryLlmVideoUnderstandingModel`（Qwen3.8 Max / Qwen3-VL / Qwen3.7–3.5 Plus） |

默认 chat 模型：`qwen3.8-max`。

Gateway 输入：图片 `image_url`；视频 `video_url`。

## 7. 失败策略

- 缺围栏、JSON 非法、Zod 校验失败 → **禁止**把半结构当成功
- UI 展示原文 + 明确 `parseError`，提示重试

## 8. 计费与准入

| 项 | 值 |
|----|-----|
| toolKey | `ecom-toolkit__media-decompose` |
| action | `decompose` |
| navKey | rollup 至 `e-commerce-toolkit` |
| clientPage | `ecom/{userId}/{projectId}/ecom-toolkit__media-decompose` |

## 9. v1 非目标

- 多轮助手工作流 / 脚本点选
- 生成图片或视频成片
- 独立部署 / 新端口

## 10. 与种草格式机制对照

| 机制 | 种草 | 拆图拆视频 |
|------|------|------------|
| 围栏 | `seed-video` | `media-decompose` |
| Zod | `seedVideoStructuredPatchSchema` | `mediaDecomposePatchSchema` |
| 视频 LLM 输入 | 仅 image_url | **video_url** |
| 业务字段 | 脚本/模式/成片 | 反推 15 列分镜 / 图片要素 |
| 交互 | 多步助手 | 单次拆解 |
