# 腾讯混元生3D · 接入说明

## 专业版（OpenAI 兼容）

- **文档**：[混元 OpenAI 兼容接口](https://cloud.tencent.com/document/product/1804/126189)
- **base_url**：`https://api.ai3d.cloud.tencent.com`
- **鉴权**：控制台创建的 `sk-` 开头 API Key
- **接口**：`POST /v1/ai3d/submit`、`POST /v1/ai3d/query`
- **画布模型 key**：`hunyuan-3d-pro`

## 极速版 / 普通版（官方 API · 推荐）

- **文档**：[API 概览](https://cloud.tencent.com/document/product/1804/120838)、[SubmitHunyuanTo3DRapidJob](https://cloud.tencent.com/document/api/1804/123463)、[QueryHunyuanTo3DRapidJob](https://cloud.tencent.com/document/api/1804/123464)
- **域名**：`ai3d.tencentcloudapi.com`
- **鉴权**：腾讯云 **SecretId + SecretKey**（访问管理 → API 密钥），TC3-HMAC-SHA256 签名
- **Action**：`SubmitHunyuanTo3DRapidJob` / `QueryHunyuanTo3DRapidJob`
- **Version**：`2025-05-13`
- **Region**：默认 `ap-guangzhou`
- **画布模型 key**：`hunyuan-3d-express`
- **约束**：Prompt 与 ImageUrl 不能同时传（三视图节点有图时优先用图）

### 环境变量（系统 Provider）

```env
HUNYUAN_TC_SECRET_ID=AKID...
HUNYUAN_TC_SECRET_KEY=...
HUNYUAN_TC_REGION=ap-guangzhou
```

### 用户 Provider（画布设置）

添加 Provider → **混元极速版（普通）** → 选择「官方 API · SecretId + SecretKey」，填写 AKID 与 SecretKey。

## 极速版（TokenHub · 可选）

- **base_url**：`https://tokenhub.tencentmaas.com`
- **鉴权**：TokenHub 平台单独签发的 Bearer API Key（**不是** SecretId）
- 与官方 TC3 API 为不同开通路径，仅在 Provider 中显式选择「TokenHub」时使用。

## 专业版 cURL 示例

```bash
curl --location 'https://api.ai3d.cloud.tencent.com/v1/ai3d/submit' \
  --header 'Authorization: sk-...' \
  --header 'Content-Type: application/json' \
  --data '{"Prompt":"小狗"}'
```
