# 分镜视频 1.0 · 火山 Seedance 真人与 Gateway

> 分镜视频 1.0（`sbv1`）**仅**经 Gateway 调用火山方舟，禁止 Canvas 直连 `ARK_API_KEY`。

## 1. 模型列表（替换原即梦展示层）

工具条模型下拉改为 **Gateway VOLCENGINE · Seedance 真人** 变体，数据见 `canvas-web/lib/canvas/sbv1-video-models.ts`：

| 展示名 | Gateway modelKey | 说明 |
|--------|------------------|------|
| Seedance 2.0 · 720P | `doubao-seedance-2.0` | 默认；真人人像库 |
| Seedance 2.0 · 720P 有声 | `doubao-seedance-2.0` | `generate_audio: true` |
| Seedance 2.0 Fast · 720P | `doubao-seedance-2.0` | Fast 参数档 |
| Seedance 2.0 · 1080P | `doubao-seedance-2.0` | 1080P |
| Seedance 1.5 Pro · 1080P | `doubao-seedance-1.5-pro` | 首尾帧/有声 |
| `ep-*` 接入点 | 用户控制台接入点 | Gateway introspect 动态展示 |

列表经 **Gateway 模型 introspect** 过滤：未开通的 modelKey 不展示。

## 2. 真人人像 · 审核与过审

火山官方要求（[真人人像库指南](https://www.volcengine.com/docs/82379/2333589)）：

> 如需使用**真人人像**作为主体参考生成视频，须经**本人验证**或事先取得**合法授权**。

### 2.1 流程

1. **录入**：真人人像库 API（Gateway 代理 `/api/gw/v1/volcengine/portrait/real/*`）  
   - 教程：https://www.volcengine.com/docs/82379/2333589  
   - API：https://www.volcengine.com/docs/82379/2333602  
2. **审核**：素材提交后由火山侧审核；仅 **审核通过** 的资产可用于生成。  
3. **引用**：视频任务 `content[]` 中使用 `asset://{AssetId}`（见 `canvas-video-volcengine.ts`）。  
4. **普通 HTTPS 参考图**：仍可用于非真人主体；**真人人脸**须走人像库，否则上游可能拒单。

### 2.2 Gateway 人像库代理（已实现）

| 库 | Gateway 路径 |
|----|----------------|
| 私域虚拟人像（9 接口） | `/api/gw/v1/volcengine/portrait/virtual/*` |
| 真人人像库（2 接口） | `/api/gw/v1/volcengine/portrait/real/*` |

凭证：与用户 `sk-gw` 绑定的 **VOLCENGINE** 厂商 Key（与视频任务共用）。

## 3. Gateway Key · 分镜视频 1.0 专用

**勿将 ARK Key 写入仓库。** Key 来源为 Book 环境变量 **`VOLCENGINE_API_KEY`**（平台新 Key），经 Gateway 凭证解密后调用上游；**禁止** Canvas / book-mall 业务层直连 `ark.cn-beijing.volces.com`。

本地初始化：

```bash
cd book-mall
# 在 .env.local 设 VOLCENGINE_API_KEY，或单次 export
VOLCENGINE_API_KEY='ark-...' pnpm exec dotenv -e .env.local -- tsx scripts/setup-sbv1-volcengine-gateway.ts your@email.com
```

脚本会：

1. 创建别名 **「火山方舟 · 分镜视频1.0」** 的 VOLCENGINE 凭证（Key 值与平台 **「火山方舟」** 相同，便于 sk-gw 分池）  
2. 创建 **「分镜视频 1.0 · Personal」** sk-gw 并绑定该凭证  
3. 尝试关联 Book 个人中心 Gateway Key  

运行时 Gateway 路由：`pickVolcengineCredentialForGatewayJob`（sbv1 上下文 → 上述别名；Seedance 2.0 默认平台 Key）。

生成时 `clientPage` = `canvas/{projectId}/sbv1`，便于 Gateway 日志筛选。

## 4. 计费与明细记录

### 4.1 官方参考价（2026-06 火山文档）

| 项 | 数值 |
|----|------|
| 纯视频生成（无视频输入） | **46 元 / 百万 tokens** |
| 含视频编辑输入 | **28 元 / 百万 tokens** |
| 15 秒参考消耗 | 约 **30.888 万 tokens** → 纯生成约 **1 元/秒** |
| 720P 档位参考 | 约 **0.99 元/秒**（B 表挂牌，见 `video-model-seeds.ts`） |

文档：[模型价格](https://www.volcengine.com/docs/82379/1544106) · [视频 API](https://www.volcengine.com/docs/82379/1520758)

### 4.2 每次生成落库字段

`CanvasGenerationTask.inputPayload` 与 Gateway `GatewayRequestLog` 含：

- `sbv1Billing`：参考模式、比例、时长、分辨率、modelKey、变体 id、图片数量、参数快照、计价参考链接  
- `volcengineBody`：完整 Ark 请求体（脱敏后）  
- `clientPage`：`canvas/{id}/sbv1`  

Gateway 控制台 **Params** 列可查看完整 JSON；**Usage** 列为挂牌参考费用（BYOK 不扣 Book 钱包）。

## 5. 相关文件

| 区域 | 文件 |
|------|------|
| 模型展示 | `canvas-web/lib/canvas/sbv1-video-models.ts` |
| 模型下拉 | `canvas-web/components/canvas/sbv1/sbv1-volcengine-model-picker.tsx` |
| Runner | `book-mall/lib/canvas/sbv1-video-engine-runner.ts` |
| 凭证路由 | `book-mall/lib/gateway/volcengine-credential-pick.ts` |
| Gateway 目录 | `book-mall/lib/gateway/volcengine-chat-models.ts` |
| B 表 seed | `book-mall/lib/billing/video-model-seeds.ts` |
| 初始化脚本 | `book-mall/scripts/setup-sbv1-volcengine-gateway.ts` |
