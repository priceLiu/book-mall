# 2026-06-06 — 火山方舟 Gateway 全量补齐

> 架构说明：[gateway-volcengine-architecture.md](../tech/gateway-volcengine-architecture.md)  
> 用户指南：[gateway-user-guide.md](../product/gateway-user-guide.md)

## 修复的问题

| 问题 | 修复 |
|------|------|
| `ep-*` 接入点 ID 误路由到 KIE | `model-router.ts`：`ep-` → `VOLCENGINE` + VIDEO |
| 未知 modelKey 默认落 KIE | 抛出 `UnknownGatewayModelError`，Gateway 返回 400 |
| Story 分镜视频仅 KIE | `story-gateway-client` / `story-task-service` 火山提交与轮询 |
| Seedance 多模态 body 不完整 | `canvas-video-volcengine.ts` 支持 video/audio 参考与 `asset://` |
| 文档未列 VOLCENGINE | `gateway-user-guide.md`、`story-gateway-models.md` |
| ecom 定价迁移 SQL 列名错误 | 4 条 `ToolBillablePrice` 迁移对齐 schema |

## 新增能力

- **Story-web**：分镜视频可选 `doubao-seedance-2.0` / `1.5-pro`（火山方舟）
- **电商分镜**：`doubao-seedance-1.5-pro` 入模型列表
- **人像库 Gateway**：`GET/POST … /api/gw/v1/volcengine/portrait/virtual/*`、`…/real/*`
- **Canvas**：视频节点可透传 `reference_video_urls` / `reference_audio_urls`

## 新用户测试步骤

1. Book 注册 → Gateway SSO → 厂商凭证添加 **VOLCENGINE**（北京 Key，baseUrl 可留空）
2. 创建 `sk-gw`，勾选 VOLCENGINE（可与 KIE 并存）→ Book 个人中心关联
3. **Canvas**：Gateway · 火山方舟 + `doubao-seedance-2.0` 生成分镜视频
4. **Story**：分镜视频选「Seedance 2.0（火山方舟）」
5. **电商分镜** `/ecom/storyboard/micro-drama` 选火山视频模型
6. （可选）`curl -H "Authorization: Bearer sk-gw-..." https://…/api/gw/v1/volcengine/portrait/virtual/asset_groups`
7. 对比：选 KIE `bytedance/seedance-2` 应走 KIE 凭证，与火山独立

## 主要改动文件

- `lib/gateway/model-router.ts`
- `lib/canvas/canvas-video-volcengine.ts`
- `lib/gateway/volcengine-portrait-client.ts`
- `lib/story/story-gateway-client.ts`、`story-task-service.ts`
- `story-web/lib/projects/video-models.ts`
- `prisma/migrations/20260605180000_*` … `20260605210000_*`（定价 SQL）
