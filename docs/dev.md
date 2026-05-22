# 本地开发：一键启动

在仓库**根目录**执行（需先在各子工程完成过 `pnpm install`，并配置好 `book-mall/.env.local` 等）：

```bash
pnpm install          # 仅首次：安装根目录 concurrently
pnpm dev:all          # 同时启动 3000–3003
```

启动后在浏览器打开 **开发导航页**（需 book-mall 已起来）：

**http://localhost:3000/dev**

可查看四个子站的链接与在线状态（绿点 = 已响应），并说明 `story:poll-loop` 后台进程。该页面仅在 `NODE_ENV=development` 时存在。

## 端口与服务

| 工程 | 端口 | 地址 |
|------|------|------|
| book-mall（主站 / API / DB） | 3000 | http://localhost:3000 |
| tool-web（工具站） | 3001 | http://localhost:3001 |
| finance-web（财务） | 3002 | http://localhost:3002 |
| story-web（漫剧） | 3003 | http://localhost:3003 |

## 漫剧：带上 KIE 轮询

本地没有公网回调时，生成任务靠 poll worker 拉结果。在 `dev:all` 基础上多加一条 poll-loop：

```bash
pnpm dev:all:story
```

等价于同时跑四个 `pnpm dev` + `book-mall` 的 `pnpm story:poll-loop`。

## 说明

- `Ctrl+C` 会结束全部子进程（`concurrently -k`）。
- 本命令**不会**启动 PostgreSQL；请确保 `book-mall/.env.local` 里 `DATABASE_URL` 可用。
- 各工程 `.env.local` 仍按 `deploy.md` §1 配置（`TOOLS_PUBLIC_ORIGIN`、`NEXT_PUBLIC_BOOK_MALL_URL` 等须与上表端口一致）。
