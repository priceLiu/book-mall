# 图生视频（首帧 i2v）· 阿里云百炼 HTTP 备忘

> **定位**：与仓库实现代码对照用的 **华北2（北京）** 异步「视频合成」接口摘要。  
> **官方长文档**：百炼控制台与 [首次调用图像与视频 API](https://help.aliyun.com/zh/model-studio/first-call-to-image-and-video-api) 等。  
> **站内平行摘录**：参考生（多图）见 [`chanaosheng.md`](./chanaosheng.md)，文生视频见 [`wen-video.md`](./wen-video.md)。

---

## 1. 与工具站实现的对应关系

| 项目 | 说明 |
|------|------|
| 产品入口 | `/image-to-video`（首页）、`/image-to-video/lab`（实验室）、`/image-to-video/library`（我的视频库） |
| 流程说明 | [`app/image-to-video/implementation/page.tsx`](../app/image-to-video/implementation/page.tsx) |
| 创建 / 查询封装 | [`lib/image-to-video-dashscope.ts`](../lib/image-to-video-dashscope.ts)（`i2vCreateVideoTask`、`i2vGetVideoTask` 等） |
| 模型列表 | [`config/lab-video-models.json`](../config/lab-video-models.json) → [`lib/image-to-video-models.ts`](../lib/image-to-video-models.ts) |
| API Key | 服务端 [`lib/qwen-env.ts`](../lib/qwen-env.ts)：优先 `QWEN_API_KEY`，否则 `DASHSCOPE_API_KEY`（参见 [`.env.example`](../.env.example)） |

计费与主站上报、入库 OSS 等 **不** 在本篇展开，见实现逻辑页与 [`learning-pricing-solution.md`](./product/learning-pricing-solution.md)。

---

## 2. 地域与 Endpoint（北京）

与参考生、文生视频相同：**模型、Base URL、API Key 须同一地域**，否则调用失败。

- **创建任务**：`POST https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis`
- **查询任务**：`GET https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}`

新加坡、美东等域名见 [`chanaosheng.md`](./chanaosheng.md) 首节表格；**本站实现目前固定北京**（见 `image-to-video-dashscope.ts` 常量）。

---

## 3. 异步调用（必带头）

HTTP 必须为 **异步**：

- 请求头 **`X-DashScope-Async: enable`**（缺失会报不支持同步调用类错误）
- 请求头 **`Authorization: Bearer <API_KEY>`**
- 请求头 **`Content-Type: application/json`**

创建成功后保存 **`output.task_id`**，**不要重复创建同一语义任务**，仅轮询查询直至终态。

---

## 4. 图生视频（首帧）请求体要点（i2v）

与实现中 `i2vCreateVideoTask` 一致：

- **`model`**：DashScope 侧模型名（如 `happyhorse-1.0-i2v`、`wan2.7-i2v-…`，以 `lab-video-models.json` 为准）。
- **`input.prompt`**：文本提示词（长度与同系列文档一致，过长会被截断）。
- **`input.media`**：数组；图生首帧为 **单元素**：
  - `type`: **`first_frame`**
  - `url`: 公网 **`https://` / `http://` 图片 URL**，或 **`data:image/...;base64,...`**（体积过大时实现侧会拒绝，见代码常量）。
- **`parameters`**（与代码对齐的常见项）：
  - **`resolution`**：`720P` | `1080P`
  - **`duration`**：整数秒，站点侧会约束在 **`3`～`15`** 之间再提交
  - **`watermark`**：布尔，是否加水印
  - **`seed`**：可选，`0`～`2147483647` 整数
  - 其他键可按模型由 `parameterExtras` 合并（见 `start/route.ts`）

参考生（`reference_image` 多图、`[Image 1]` 指代）与文生（仅 `prompt`、无 `media` 首帧）的请求体形状不同，分别见 [`chanaosheng.md`](./chanaosheng.md)、[`wen-video.md`](./wen-video.md)。

---

## 5. 任务状态与结果链接

- 状态枚举：**PENDING → RUNNING → SUCCEEDED | FAILED | CANCELED**（与参考生/文生相同）。
- **`task_id` 查询有效期**约 **24 小时**；成功后响应中带 **`video_url`**（或等价字段，以实际 JSON 为准），**链接通常短时有效**，长期留存需在业务侧下载并转存（本站入库走 OSS + 主站 library，见实现逻辑页）。
- 轮询间隔建议 **数秒～十余秒** 量级，避免过密请求。

---

## 6. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-05-15 | 从空文件补齐：i2v 首帧要点、Endpoint、异步头、与 `lib/image-to-video-dashscope.ts` 及兄弟文档分工 |
