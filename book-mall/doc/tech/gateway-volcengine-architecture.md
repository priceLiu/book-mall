# Gateway · 火山方舟（VOLCENGINE）架构说明

> 单一真源：路由见 `book-mall/lib/gateway/model-router.ts`；模型目录见 `volcengine-chat-models.ts`、`model-catalog.ts`；用户流程见 [gateway-user-guide.md](../product/gateway-user-guide.md)。

## 1. 设计原则

### 1.1 不与 KIE 混合

- 平台在模型目录登记 **`modelKey` + `providerKind`**；运行时 `routeGatewayModel(modelKey)` 决定厂商。
- 统一注册表见 `book-mall/doc/tech/gateway-unified-model-registry.md` 与 `GatewayModelRoute` 表。
- KIE Seedance（`bytedance/seedance-2`）与火山 Seedance（`doubao-seedance-2.0`、`ep-*`）是 **不同 modelKey**，各自扣对应厂商账户。
- 用户可同时绑定 KIE 与 VOLCENGINE 凭证到同一 `sk-gw`；前端按 **来源 Provider + 模型** 选择，Gateway 只取匹配 `providerKind` 的凭证。

### 1.2 系统先行、用户 BYOK

```text
GatewayModelCatalog / volcengine-chat-models（平台登记）
  → 用户 Gateway 控制台绑定 VOLCENGINE 凭证
  → sk-gw 勾选该凭证
  → Canvas / Story / 电商分镜 展示「Gateway · 火山方舟」下模型
```

### 1.3 地域与链接（三层）

| 层 | 作用 |
|----|------|
| **providerKind** | `VOLCENGINE` / `KIE` / `BAILIAN` … 决定用哪把 Key |
| **apiFamily** | 同一厂商内分 client：`chat`、`video_tasks`、`portrait_lib` |
| **baseUrl** | 凭证级可选覆盖；默认北京 `https://ark.cn-beijing.volces.com/api/v3` |

错误 baseUrl 会导致 401/404；**不能把不同 apiFamily 混在同一 HTTP 路径假设下**（阿里百炼 vs DashScope 已是先例）。

## 2. 路由链路

```mermaid
sequenceDiagram
  participant App as Canvas_Story_Ecom
  participant GW as Gateway
  participant Cred as VOLCENGINE_Credential
  participant Ark as ark.cn-beijing.volces.com

  App->>GW: modelKey + body
  GW->>GW: routeGatewayModel
  GW->>GW: pickVolcengineCredentialForGatewayJob
  GW->>Cred: apiKey + baseUrl
  GW->>Ark: apiFamily client
```

### 2.1 modelKey 规则（火山视频）

| modelKey | providerKind | 上游 model |
|----------|--------------|------------|
| `doubao-seedance-2.0` | VOLCENGINE / VIDEO | `doubao-seedance-2-0-260128`（别名表） |
| `doubao-seedance-1.5-pro` | VOLCENGINE / VIDEO | `doubao-seedance-1-5-pro-251215` |
| `ep-20260604145826-rsvt7` | VOLCENGINE / VIDEO | 原样透传（控制台接入点 ID） |

### 2.2 未知模型

未登记 modelKey **不得**默认落 KIE；`routeGatewayModel` 抛出 `UnknownGatewayModelError`，Gateway 返回 400。

## 3. apiFamily 与代码模块

| apiFamily | 上游路径 | 模块 |
|-----------|----------|------|
| `chat` | `POST /chat/completions` | `proxy-common.ts` → `forwardChatCompletions` |
| `video_tasks` | `POST/GET /contents/generations/tasks` | `volcengine-client.ts`, `volcengine-jobs.ts` |
| `portrait_lib` | `/{portrait/virtual\|real}/...`（透明代理） | `volcengine-portrait-client.ts` |

Gateway 对外：

- 视频任务：现有 `POST /api/gw/v1/jobs/createTask`（`providerKind=VOLCENGINE` 分支）
- 人像库：`/api/gw/v1/volcengine/portrait/virtual/*`、`.../real/*`

## 4. Seedance 2.0 多模态 body

`buildCanvasVideoVolcengineInput` 组装 `content[]`（**首/尾帧与参考媒体互斥**，不可同请求混用）：

**纯图生视频（无 @ 参考）**

1. `text` — 提示词  
2. `image_url` + `role: first_frame` — 主分镜图  

**多模态参考（有 @ 参考图/视频/音频或 asset）**

1. `text` — 提示词  
2. `image_url` + `role: reference_image` — 主分镜图 + 额外参考图（最多 9）  
3. `video_url` + `role: reference_video` — 参考视频  
4. `audio_url` + `role: reference_audio` — 参考音频  
5. `asset://asset-xxx` — 人像库资产 URI（见 §5）

## 5. 人像库与 asset://

- **管理**：私域虚拟人像（9 接口）、真人人像库（2 接口）经 Gateway 透明代理 + Canvas BFF（`/api/canvas/portrait/*`），共用 VOLCENGINE 凭证。
- **使用**：视频生成 API 的 `content` 中引用 `asset://{AssetId}`，无需单独下载 URL。
- **产品 UI**：LibTV 图片节点工具条「私域人像入库」；真人人像 H5 活体见 sbv1 画布工具条。

官方文档：

- [私域虚拟人像](https://www.volcengine.com/docs/82379/2333601)
- [真人人像库](https://www.volcengine.com/docs/82379/2333602)
- [录入真人形象](https://www.volcengine.com/docs/82379/2315856)

## 6. KIE vs 火山对照（分镜视频）

| 维度 | KIE | 火山方舟 |
|------|-----|----------|
| modelKey | `bytedance/seedance-2` | `doubao-seedance-2.0` |
| 凭证 | KIE API Key | 火山 ARK API Key |
| 任务 API | `createTask` / `recordInfo` | `contents/generations/tasks` |
| 多视频/音频参考 | KIE input 字段 | Ark `content[]` 条目 |
| 接入点 | 无 | 支持 `ep-*` |

## 7. 多凭证路由（Seedance 生视频）

实现：`book-mall/lib/gateway/volcengine-credential-pick.ts`（`pickVolcengineCredentialForGatewayJob`）。

**禁止直连 ARK**：Canvas / Story / 分镜视频 1.0 / 影视专业版 2.0 生视频须 `sk-gw` → `POST /api/gw/v1/jobs/createTask` → `volcengine-client.ts`；业务层不得 `fetch ark.cn-beijing.volces.com`。

| 场景 | 默认凭证别名 | 可选覆盖 |
|------|-------------|----------|
| **分镜视频 1.0**（`clientPage` 含 `/sbv1`、`input.sbv1Billing`、或 `gateway:sbv1-volcengine`） | **火山方舟 · 分镜视频1.0** → 兜底「火山方舟」 | 否（固定 sbv1 池） |
| **影视专业版 2.0** Seedance 生视频（`doubao-seedance-2.0` / `ep-*`） | **火山方舟**（`VOLCENGINE_API_KEY` 平台池） | 是 · `input.gatewayCredentialId` |
| Story / 电商分镜等其它 VOLCENGINE VIDEO | **火山方舟** | 是 · `gatewayCredentialId` |

Seedance 2.0 在 sbv1 与 Pro2 **默认均走平台新 Key**（经 Gateway 凭证解密，勿写入仓库）。sbv1 专用别名与平台别名 **Key 值相同**，便于日志与 sk-gw 绑定隔离。

本地初始化 sbv1 凭证：`book-mall/scripts/setup-sbv1-volcengine-gateway.ts`。

## 8. 相关文件

| 文件 | 说明 |
|------|------|
| `lib/gateway/volcengine-credential-pick.ts` | sbv1 / Pro2 Seedance 凭证 alias 路由 |
| `lib/gateway/model-router.ts` | 路由与 defaultBaseUrl |
| `lib/gateway/volcengine-chat-models.ts` | 目录与 upstream 别名 |
| `lib/gateway/volcengine-client.ts` | 视频 tasks HTTP |
| `lib/gateway/volcengine-portrait-client.ts` | 人像库代理 |
| `lib/canvas/canvas-video-volcengine.ts` | 产品层 body 构建 |
| `lib/canvas/canvas-gateway-providers.ts` | 前端虚拟 Provider `gateway:volcengine` |
