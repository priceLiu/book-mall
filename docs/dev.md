# 本地开发：一键启动

在仓库**根目录**执行（需先在各子工程完成过 `pnpm install`，并配置好 `book-mall/.env.local` 等）：

```bash
pnpm install                        # 根目录 concurrently
pnpm --dir e-commerce-toolkit install   # 首次：电商工具箱依赖（dev:all 会起 :3007）
pnpm --dir book-mall install            # 主站与其它子站按需在各自目录 install
pnpm dev:all                        # 同时启动 3000–3008（含 e-commerce-toolkit、quick-replica-web）
```

`dev:all` 进程表见仓库根 `scripts/dev-all.mjs`；终端里电商工具箱日志前缀为 `[ecom]`。

启动后在浏览器打开 **开发导航页**（需 book-mall 已起来）：

**http://localhost:3000/dev**

可查看各子站的链接与在线状态（绿点 = 已响应），并说明 `story:poll-loop` 后台进程。该页面仅在 `NODE_ENV=development` 时存在。

**全站架构、端口、Gateway 密钥逻辑**：见 [全站架构图与配置表.md](./全站架构图与配置表.md)。

## 端口与服务

| 工程 | 端口 | 地址 |
|------|------|------|
| book-mall（主站 / API / DB） | 3000 | http://localhost:3000 |
| tool-web（工具站） | 3001 | http://localhost:3001 |
| finance-web（财务） | 3002 | http://localhost:3002 |
| story-web（漫剧） | 3003 | http://localhost:3003 |
| canvas-web（画布） | 3004 | http://localhost:3004 |
| gateway-web（Gateway BYOK） | 3005 | http://localhost:3005 |
| prompt-optimizer-platform（提示词优化器） | 3006 | http://localhost:3006 |
| e-commerce-toolkit（电商工具箱） | 3007 | http://localhost:3007 |
| quick-replica-web（快速复制） | 3008 | http://localhost:3008 |

## 漫剧：带上 KIE 轮询

本地没有公网回调时，生成任务靠 poll worker 拉结果。在 `dev:all` 基础上多加一条 poll-loop：

```bash
pnpm dev:all:story
```

等价于 8 个子站 `pnpm dev`（含 **e-commerce-toolkit :3007**）+ `story` / `canvas` / `gateway` 三条 poll-loop。

## 数据库连接（DB-Resilience-R1 · Phase C）

`dev:all` + 三条 poll-loop 会**同时**连同一 `DATABASE_URL`。腾讯云 CDB **直连**时务必限制每进程连接数，否则易出现 `Can't reach database server` / `Server has closed the connection`（P1001）。

**推荐**在 `book-mall/.env.local` 的 `DATABASE_URL` query 追加：

```
connection_limit=10&pool_timeout=30&connect_timeout=15
```

| 场景 | 建议 |
|------|------|
| 全量 `pnpm dev:all:story` | `connection_limit=10`，改 URL 后**必须重启** dev:all |
| 仍频繁 P1001 | `pnpm dev:all:nopoll`，手动单开 poll；或暂时只起 book-mall + canvas |
| 对账排队任务 | `pnpm --dir book-mall canvas:queued-reconcile` |
| 洗误标 Gateway log | `pnpm --dir book-mall gateway:repair-insufficient-mislabel -- --apply` |

poll-loop 子进程已在 `package.json` 设 `PRISMA_CONNECTION_LIMIT=1`。生产 PgBouncer 见 `deploy/tencent/pgbouncer/README.md`。

Release 全文：`docs/releases/2026-06-db-resilience-r1.md`。

## 说明

- `Ctrl+C` 会结束全部子进程（`concurrently -k`）。
- 本命令**不会**启动 PostgreSQL；请确保 `book-mall/.env.local` 里 `DATABASE_URL` 可用。
- 各工程 `.env.local` 仍按 `deploy.md` §1 配置（`TOOLS_PUBLIC_ORIGIN`、`NEXT_PUBLIC_BOOK_MALL_URL` 等须与上表端口一致）。

---

## 提示词优化器 · 构建要求

与 canvas-web / story-web 一样，**生产环境靠 CloudBase `git push` 自动构建**；本地开发与 CI 须遵守下列约定。

### 目录

| 路径 | 说明 |
|------|------|
| `prompt-optimizer-platform/` | Next 平台壳（SSO、BFF、`middleware`） |
| `prompt-optimizer-platform/prompt-optimizer/` | 上游 Vue vendor（git subtree，**必须在平台目录内**） |

vendor 不可放在仓库根目录：CloudBase **目标目录**为 `prompt-optimizer-platform` 时，构建上下文无法访问同级文件夹。

### 不要提交的内容

`prompt-optimizer-platform/.gitignore` 已忽略：

- `public/assets/`、`public/index.html`、`public/config.js`、`public/favicon.ico`

这些由 Docker 多阶段构建或本地 `pnpm build:prompt-vendor` 生成，**不要** `git add` 进仓库。

### 本地首次 / vendor 变更后

`:3006` 默认只起 Next 壳；要看完整 Vue UI 需先构建 vendor：

```bash
# 上游要求 Node ^22（与 Dockerfile 一致）
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"

cd prompt-optimizer-platform/prompt-optimizer
pnpm install
cd ../..
pnpm build:prompt-vendor
```

根目录快捷命令：

```bash
pnpm build:prompt-vendor       # 构建 vendor 并拷贝到 public/
pnpm build:prompt-vendor:copy  # 仅拷贝已有 packages/web/dist（跳过 build）
```

本地构建时的环境变量（脚本默认）：

- `VITE_PLATFORM_GATEWAY=1`
- `VITE_GATEWAY_WEB_ORIGIN=http://localhost:3005`

### 生产 / CloudBase 部署

与 canvas、story 相同：**新建云托管服务**，Monorepo 子目录填 `prompt-optimizer-platform`，端口 **3006**，域名 `prompt.ai-code8.com`。

`Dockerfile` 会自动：

1. 在镜像内 `pnpm build:core && build:ui && build:web`（`VITE_GATEWAY_WEB_ORIGIN=https://gateway.ai-code8.com`）
2. 拷贝 `dist` → `public/`，再 `next build` standalone

环境变量见 `deploy/tencent/prompt-optimizer-platform.env.example`；book-mall 须配置 `PROMPT_OPTIMIZER_PUBLIC_ORIGIN` 且 `TOOLS_SSO_*` 与各子站一致。

详细说明：[docs/prompt-optimizer.md](./prompt-optimizer.md)、[deploy/tencent/README.md](../deploy/tencent/README.md)。

Agent 约束见 `.cursor/rules/prompt-optimizer-platform-build.mdc`。
