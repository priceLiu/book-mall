# 技术与运行环境

## 1. 数据库

- **引擎**：Neon（PostgreSQL Serverless）。  
- **连接 URI**：环境变量 **`DATABASE_URL`**（path 为 Neon 控制台所选 **Database**，常见默认名为 `neondb`）。仓库内迁移代号仍称 `init_ai_mall`，仅表示「AI Mall 应用」首版表结构，**不要求** Neon 上库名必须为 `ai_mall`。若需与文档字面一致，可在控制台新建 database `ai_mall` 并将 URI 改为 `/ai_mall`。  
- **Pooling**：与控制台一致时可使用 **`-pooler`** 主机；若迁移偶发失败可换控制台提供的 **direct** 连接串重试。  
- **参数**：若出现连接或迁移异常，可尝试仅保留 `?sslmode=require`（去掉 `channel_binding=require`）。**密钥仅放 `.env.local`**，勿提交。  
- **Prisma + Neon 池化**：在 `DATABASE_URL` 的 query 中建议加上 **`pgbouncer=true`**，并设置 **`connect_timeout=30`**（或更大）。免费档项目在长时间无访问后会「睡眠」，**首次连库可能需十余秒**，过短的超时容易报 `Can't reach database server`（Prisma `P1001`）；改大 `connect_timeout` 后多刷新一次页面或重试命令通常可恢复。

### 1.1 经常出现「Can't reach database server」时

1. **Neon 控制台**：打开项目 → 确认 **未暂停**；点一次 **Open** / 在 SQL Editor 执行任意查询，**唤醒计算节点**后再用本站或 `pnpm run db:deploy` 测连接。  
2. **核对连接串**：使用控制台提供的 **Pooled** URI（主机含 `-pooler`）；query 含 `sslmode=require`，建议 **`pgbouncer=true`**、**`connect_timeout=30`**。  
3. **网络**：代理 / VPN / 公司网络可能对海外出口不稳定，可切换网络试；若长期从国内访问，可考虑在 Neon 选择离你更近的 **Region**（仍有跨境时延，但可能更稳）。  
4. **本地验证**：在项目目录执行 `pnpm run db:deploy` 或 `dotenv -e .env.local -- npx prisma db execute --stdin <<< "select 1"`；若 CLI 也超时，问题在 **网络或 Neon 状态**，而非页面代码。  
5. **开发体验**：若冷启动仍烦人，可在 Neon **升级套餐**或启用 **Always-on**（以控制台当前套餐为准），减少睡眠次数。

## 2. 部署

- **平台**：Vercel 自动部署（与仓库绑定后的流水线）。  
- **管理后台**：路径 `/admin`；**仅** `User.role === ADMIN` 可访问（middleware + layout 双检）。管理员邮箱在服务端环境变量 **`ADMIN_EMAILS`**（逗号分隔），部署后执行一次 **`pnpm db:seed`**（或迁移脚本中 `updateMany`）将已注册用户的 `role` 升为 `ADMIN`；**须重新登录** 后导航才会出现「管理后台」。

## 3. 支付

- **当前阶段**：**模拟支付流程**（**订阅 + 钱包充值**），约定见 **[mock-payment-checkout.md](../process/mock-payment-checkout.md)**。  
- **正式接入支付宝等**：见 **[real-payment-integration.md](../process/real-payment-integration.md)**。  
- **实现建议**：统一支付适配层（下单 / 回调 / 入账）。

## 3.1 独立工具站 SSO（黄金会员）

环境变量与接口清单见 **[tools-sso-environment.md](./tools-sso-environment.md)**；需求总览 **[../v1.1](../v1.1)**。

## 4. 前端样式

- **营销站与后续功能页**：在视觉与组件语言上与 **当前首页** 保持一致（Tailwind、现有 layout/主题），避免另立一套 UI。

## 5. 与产品文档的关系

- 本文档描述 **环境与工程约定**；**业务规则** 以 `doc/product/` 为准。  
- 开发纪律见 `doc/process/development-constraints.md`。

## 6. 本地数据库命令

依赖 **`.env.local`** 中的 `DATABASE_URL`（Prisma CLI 默认不读取 `.env.local`，已用 `dotenv-cli` 包装脚本）：

- 首次：`pnpm run db:deploy` 应用迁移，`pnpm run db:seed` 写入默认配置与订阅计划。  
- 迭代结构：`pnpm run db:migrate`（开发）或新迁移 + `db:deploy`（CI/生产）。

