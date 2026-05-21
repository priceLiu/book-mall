# 腾讯云 CloudBase Run 构建文档（book-mall / tool-web / finance-web）

> 受众：第一次（或重建）在腾讯云控制台为本仓库三个 Next.js 工程开通自动构建/自动部署的人。  
> 关联文档：[`README.md`](./README.md)（同目录概览）、根目录 [`DEPLOY.md`](../../DEPLOY.md)（端到端部署指南）、[`coding-ci-hints.md`](./coding-ci-hints.md)（自建流水线）。

## 1. 一句话结论

**本仓库（`priceLiu/book-mall`）是 Monorepo**，在云托管为它开 **三个独立服务**，三者共享 GitHub 仓库，仅靠「**目标目录 / Monorepo 子目录**」字段区分构建上下文。**不需要新建任何 GitHub 仓库**。

```text
priceLiu/book-mall （唯一 Git 仓库）
├── book-mall/      → 服务一：主站
├── tool-web/       → 服务二：工具站
└── finance-web/    → 服务三：财务控制台
```

## 2. 三服务总表

| 字段（控制台） | book-mall | tool-web | finance-web |
|---------------|-----------|----------|-------------|
| Git 仓库 | `priceLiu/book-mall` | `priceLiu/book-mall` | `priceLiu/book-mall` |
| 分支 | `main` | `main` | `main` |
| **目标目录** | `book-mall` | `tool-web` | `finance-web` |
| Dockerfile | 默认（在该目录下） | 默认 | 默认 |
| **服务端口** | **3000** | **3001** | **3002** |
| 自定义域（示例） | `book.ai-code8.com` | `tool.ai-code8.com` | `f.ai-code8.com` |
| 启动时执行 `prisma migrate deploy` | ✅（entrypoint） | ❌ | ❌ |

> 端口与各 `Dockerfile` 中的 `EXPOSE` / `PORT=` / `HOSTNAME=0.0.0.0` 一致；与本机 `pnpm dev` 端口也对齐，便于调试。

## 3. 控制台逐步流程

### 3.1 前置：DNS

DNSPod 把三个子域 CNAME 到云托管分配的网关域：

```text
book.ai-code8.com → CloudBase Run 默认域
tool.ai-code8.com → CloudBase Run 默认域
f.ai-code8.com    → CloudBase Run 默认域
```

### 3.2 第一次创建：依次新建 3 个服务

云托管 → **新建服务 / 新建 Git 平台部署** → 重复 3 次：

1. **Git 仓库**：从下拉里选 **`priceLiu/book-mall`**（**不要**搜 `tool-web` / `finance-web`，下拉里它们都不存在）。
2. **分支**：`main`。
3. **服务名称**：分别填 `book-mall`、`tool-web`、`finance-web`（小写、数字、连字符）。
4. **构建设置**：
   - **目标目录 / Monorepo 子目录**：`book-mall` / `tool-web` / `finance-web`（**关键差异点**）。
   - **Dockerfile**：默认即可（位于上述目标目录下）。
5. **服务端口**：`3000` / `3001` / `3002`（与 Dockerfile 一致，否则健康检查失败 502）。
6. **环境变量**：见 §4。
7. **访问设置**：保存后再绑自定义域名（HTTPS 自动签发）。

### 3.3 后续重发

- **代码改完直接 `git push origin main`** → 三个服务的 Webhook 都会触发，但 **只重建动到的子目录**（CloudBase 会基于路径过滤），其它服务不动。
- 改 schema：写迁移 → push → book-mall entrypoint 自动 `prisma migrate deploy`。
- 改环境变量：在控制台改完，**手动「重启服务」** 一次即可。

## 4. 环境变量（控制台录入，勿提交密钥）

> 模板见 [`book-mall.env.example`](./book-mall.env.example)、[`tool-web.env.example`](./tool-web.env.example)、[`finance-web.env.example`](./finance-web.env.example)。

### 4.1 book-mall（主站）

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/tool_mall?sslmode=require
NEXTAUTH_URL=https://book.ai-code8.com
NEXTAUTH_SECRET=长随机串

TOOLS_PUBLIC_ORIGIN=https://tool.ai-code8.com
TOOLS_SSO_SERVER_SECRET=须与tool-web完全一致
TOOLS_SSO_JWT_SECRET=须与tool-web完全一致

NEXT_PUBLIC_FINANCE_WEB_ORIGIN=https://f.ai-code8.com
FINANCE_WEB_ORIGINS=https://f.ai-code8.com

ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

> **管理后台「账单明细」菜单**：须在 **book-mall 服务**（不是 finance-web）配置上述两行财务变量。`docker-entrypoint.sh` 会在生产且未显式配置时自动改写为 `https://f.ai-code8.com`；改完环境变量后 **重启 book-mall 服务** 即可（不必等 finance-web 重建）。

### 4.2 tool-web（工具站）

```env
MAIN_SITE_ORIGIN=https://book.ai-code8.com
TOOLS_PUBLIC_ORIGIN=https://tool.ai-code8.com
TOOLS_SSO_SERVER_SECRET=与book-mall一致
TOOLS_SSO_JWT_SECRET=与book-mall一致
```

### 4.3 finance-web（财务控制台）

```env
NEXT_PUBLIC_BOOK_MALL_URL=https://book.ai-code8.com
BOOK_MALL_URL=https://book.ai-code8.com
```

> 主站 **book-mall** 的 `FINANCE_WEB_ORIGINS` 必须包含 `https://f.ai-code8.com`，否则财务页跨域请求会被 CORS 拦。  
> `NEXT_PUBLIC_BOOK_MALL_URL` 在客户端组件中会在 **构建时内联**；代码已改为服务端 layout 注入，**改环境变量后重启 finance-web 即可**（仍建议重新构建一次以更新前端包）。

### 4.4 调试用（默认不要开）

| 变量 | 影响 |
|------|------|
| `ALLOW_CLOUDBASE_DEFAULT_ORIGINS=1` | 允许 entrypoint 保留 `*.sh.run.tcloudbase.com` 默认域，跳过自动改写为正式域 |
| `NEXT_PUBLIC_FINANCE_USE_DEV_PROXY=1` | 财务页走 finance-web 服务端代理（仅本地） |
| `FINANCE_DEV_USER_ID=...` | 替你模拟某个用户拉账单（**生产严禁开**） |

## 5. 镜像构建行为

各 `Dockerfile` 多阶段：`base`（Node 22）→ `deps` → `builder` → `runner`。要点：

- **Node 版本**：统一 `node:22-bookworm-slim` + `NODE_OPTIONS=--experimental-sqlite`（Prisma 6.19 用到 `node:sqlite`）。
- **包管理**：`corepack` 启用 **pnpm 9.15.5**（与本地 `packageManager` 字段一致；CI 用 `--frozen-lockfile`）。
- **构建命令**：`pnpm run build:docker`（每个工程都有此 script）。
- **运行命令**：`runner` 复用 Next.js `output: "standalone"`，启动 `node server.js`，前置 `docker-entrypoint.sh`。
- **book-mall 启动**：`entrypoint` 执行 `prisma migrate deploy`，因此首次部署前须保证 `DATABASE_URL` 可达。
- **finance-web 启动**：`entrypoint` 自动把空 / 默认域的 `NEXT_PUBLIC_BOOK_MALL_URL` 改写为 `https://book.ai-code8.com`。

## 6. 验收清单

部署完三个服务后逐项打勾：

- [ ] 浏览器打开 `https://book.ai-code8.com` → 正常登录
- [ ] 主站点击「工具站」入口 → 跳到 `https://tool.ai-code8.com` 自动登录（SSO 换票 OK）
- [ ] 主站点击「费用与明细」→ 跳到 `https://f.ai-code8.com/...` 能看到当前账号余额与明细
- [ ] 三个服务的「访问日志」无 4xx/5xx 突增
- [ ] book-mall 启动日志含 `prisma migrate deploy` 完成
- [ ] DevTools Network：finance-web 调用 `https://book.ai-code8.com/api/...`，响应头含 `access-control-allow-origin: https://f.ai-code8.com`

## 7. 故障排查

| 现象 | 排查项 |
|------|--------|
| Git 下拉里搜 `priceLiu/finance-web` 无结果 | 正常；选 `priceLiu/book-mall` + 目标目录 `finance-web` |
| 构建过程报 `Dockerfile not found` | 「目标目录」误填为仓库根；改为 `book-mall` / `tool-web` / `finance-web` |
| `502 Bad Gateway` | 服务端口与 `Dockerfile` 不一致；分别改回 `3000` / `3001` / `3002` |
| 财务页 403 / 拉不到用户 | 检查主站 `FINANCE_WEB_ORIGINS` 是否含财务域；管理员是否在主站登录 |
| SSO 跳转地址带 `/:3001` | `TOOLS_PUBLIC_ORIGIN` 把端口写到了路径里；改成 `https://tool.ai-code8.com`（端口紧跟域名） |
| `node:sqlite` 报错 | 镜像是 Node 20；本仓库要求 Node 22+，重建即可 |
| `prisma migrate deploy` 失败 | RDS 白名单 / 安全组 / `DATABASE_URL`；本地用 `pnpm db:apply-pending` 临时绕过 |

## 8. 常见误区

| 误区 | 实情 |
|------|------|
| 「我没看到 `priceLiu/finance-web` 是不是 push 没成功？」 | push 是成功的；`finance-web` 是 Monorepo 里的 **子目录**，**不是独立 Git 仓库**，下拉永远不会出现 |
| 「`tool-web` 不是有独立仓库吗？」 | 没有；下拉里的 `priceLiu/ai_tools_site` 是 **另一个老项目**，与当前 `tool-web/` 子目录是两份代码 |
| 「我得先 `docker compose build`？」 | 全自动模式不需要；CloudBase 会按各服务的目标目录直接构建 |
| 「服务端口都填 3000 行不行？」 | 不行；必须与 Dockerfile 中 `EXPOSE` / `PORT` 一致，否则健康检查 502 |

## 9. 本机镜像构建（自检用）

仅当你想在本地复现 CloudBase 的构建过程时使用：

```bash
# 在仓库根
docker build -f book-mall/Dockerfile     -t book-mall:dev   book-mall
docker build -f tool-web/Dockerfile      -t tool-web:dev    tool-web
docker build -f finance-web/Dockerfile   -t finance-web:dev finance-web

# 或一次性起三个容器（需先 ./deploy/tencent/bootstrap-env.sh）
docker compose up -d --build
```

本机端口：主站 `3000` / 工具站 `3001` / 财务 `3002`。
