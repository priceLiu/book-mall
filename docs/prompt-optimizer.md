# 提示词优化器（Prompt Optimizer）

平台接入版基于上游 [linshenkx/prompt-optimizer](https://github.com/linshenkx/prompt-optimizer)（`develop`），**保留原 Vue + Naive UI 界面**，经薄平台壳接入 Book 联邦。

## 文档索引

| 文档 | 路径 |
|------|------|
| 产品说明 | [book-mall/doc/product/prompt-optimizer-platform.md](../book-mall/doc/product/prompt-optimizer-platform.md) |
| 实施计划与进度 | [book-mall/doc/plans/2026-prompt-optimizer-platform-rollout.md](../book-mall/doc/plans/2026-prompt-optimizer-platform-rollout.md) |
| 视觉规范（upstream） | [prompt-optimizer-platform/prompt-optimizer/docs/design.md](../prompt-optimizer-platform/prompt-optimizer/docs/design.md) |
| Gateway 模型管理 UI | [gateway-web/docs/design.md](../gateway-web/docs/design.md) §6 |
| 平台联邦 | [book-mall/doc/product/12-platform-app-federation.md](../book-mall/doc/product/12-platform-app-federation.md) |
| Gateway 用户流程 | [book-mall/doc/product/gateway-user-guide.md](../book-mall/doc/product/gateway-user-guide.md) |

## 本地开发

| 工程 | 端口 | 地址 |
|------|------|------|
| book-mall | 3000 | http://localhost:3000 |
| gateway-web | 3005 | http://localhost:3005 |
| **prompt-optimizer-platform** | **3006** | http://localhost:3006 |

根目录：`pnpm dev:all`（含上述进程）。

### 最短路径

1. 配置 `book-mall/.env.local`：`TOOLS_SSO_*`、`DATABASE_URL`
2. 配置 `prompt-optimizer-platform/.env.local`：`MAIN_SITE_ORIGIN=http://localhost:3000`、`TOOLS_SSO_SERVER_SECRET`（与 book 一致）
3. Book 登录 → 订阅中心开通 **提示词优化器** 月费 → 个人中心关联 Gateway Key → Gateway 绑定厂商凭证
4. 打开 http://localhost:3006

## 生产部署

与 canvas-web / story-web 相同：**CloudBase 目标目录** `prompt-optimizer-platform`，端口 **3006**，`git push` 触发镜像构建（Dockerfile 内含 vendor + Next 多阶段构建，无需提交 `public/` 产物）。详见 [deploy/tencent/README.md](../deploy/tencent/README.md) 与 [deploy/tencent/prompt-optimizer-platform.env.example](../deploy/tencent/prompt-optimizer-platform.env.example)。

## 架构要点

- **鉴权**：Book SSO + `tools_token`（对齐 canvas-web）
- **模型调用**：禁止直连厂商；经 platform BFF → Book `/api/sso/tools/gateway/chat` → Gateway
- **厂商 Key**：仅在 **Gateway 控制台 · 模型管理** 维护
- **计费**：钱包充值 + 工具月费（`navKey: prompt-optimizer`）+ Gateway BYOK

## 上游协议

上游采用 **AGPL-3.0**；对外提供网络服务须满足源码公开义务。
