# 快速复制（QuickReplica）

独立 Next 子应用：按分类浏览示例模板 → 载入中间工作区 → 选 Gateway 模型、改提示词 → 生成；用户新结果优先展示在模板区。

## 文档索引

| 文档 | 路径 |
|------|------|
| 产品设计（主文档） | [book-mall/doc/product/quick-replica-platform.md](../book-mall/doc/product/quick-replica-platform.md) |
| 实施计划与进度 | [book-mall/doc/plans/2026-quick-replica-rollout.md](../book-mall/doc/plans/2026-quick-replica-rollout.md) |
| UI 规范 | [quick-replica-web/doc/design.md](../quick-replica-web/doc/design.md) |
| 参考图 | [docs/quick-replica/assets/](./quick-replica/assets/) |
| 平台联邦 | [book-mall/doc/product/12-platform-app-federation.md](../book-mall/doc/product/12-platform-app-federation.md) |

## 本地开发

| 工程 | 端口 | 地址 |
|------|------|------|
| book-mall | 3000 | http://localhost:3000 |
| gateway-web | 3005 | http://localhost:3005 |
| **quick-replica-web** | **3008** | http://localhost:3008 |

根目录：`pnpm dev:all`（含 `:3008`）。

### 最短路径

1. 配置 `book-mall/.env.local`：`TOOLS_SSO_*`、`DATABASE_URL`
2. 配置 `quick-replica-web/.env.local`：`MAIN_SITE_ORIGIN=http://localhost:3000`、`TOOLS_SSO_SERVER_SECRET`（与 book 一致）
3. Book 登录 → 开通 **quick-replica** 工具月费 → 关联 Gateway Key
4. 打开 http://localhost:3000/quick-replica-open 或 http://localhost:3008

## 架构要点

- **鉴权**：Book SSO + `tools_token`（`app=quick-replica`）
- **AI**：经 Book Platform API → Gateway BYOK
- **计费**：工具月费 `navKey: quick-replica` + Gateway BYOK（与 canvas/tool 一致）
- **日志**：`clientSource=QUICK_REPLICA`，`clientPage=quick-replica/{toolKey}`

## 生产部署

目标目录 `quick-replica-web`，容器端口 **3008**，域名目标 `replica.ai-code8.com`。  
环境变量模板：`deploy/tencent/quick-replica-web.env.example`。
