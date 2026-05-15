# private_website（单仓库：主站 + 工具站）

Git 仓库根目录为 **`private_website/`**（与 `book-mall/`、`tool-web/` 同级）。一次 `git commit` / `git push` 可同时带上两个 Next 应用。

```
private_website/          # ← git 根目录（.git 在此处）
├── book-mall/            # 主站（默认 http://localhost:3000）
├── tool-web/             # 工具站（默认 http://localhost:3001）
├── scripts/
│   └── move-git-root-to-private-website.sh   # 已由仓库根上移使用时可忽略
└── README.md             # 本文件
```

## 首次 Clone 后

在两个子项目里分别安装依赖（各自有独立的 `package.json` / lockfile）：

```bash
cd book-mall && pnpm install && cd ..
cd tool-web && pnpm install && cd ..
```

主站若使用 Prisma，按需配置 `book-mall/.env.local` 并执行迁移（见 `book-mall/README.md`）。

## 日常怎么跑（两个终端）

**终端 A — 主站**

```bash
cd book-mall
pnpm dev
```

浏览器：<http://localhost:3000>

**终端 B — 工具站**

```bash
cd tool-web
pnpm dev
```

浏览器：<http://localhost:3001>（`package.json` 里已写死 `-p 3001`）

SSO 联调时：主站 `.env.local` 设置 `TOOLS_PUBLIC_ORIGIN=http://localhost:3001`（与地址栏访问工具站的 host **一致**，勿混用 `127.0.0.1`），工具站 `.env.local` 设置 `MAIN_SITE_ORIGIN=http://localhost:3000`，两端 Secret 一致。详见 **`book-mall/doc/tech/tools-sso-environment.md`**、**`tool-web/README.md`**。

## 工具站清理重装（可选）

若在迁移目录后依赖路径怪异，可在 **`tool-web/`** 下：

```bash
rm -rf node_modules .next
pnpm install
```

## 提交约定

在 **`private_website/`** 根目录执行 `git add` / `git commit` / `git push` 即可同时包含 `book-mall` 与 `tool-web`。

只改主站时可：`git add book-mall/`、`git status` 核对后在根目录提交并推送。**不要在 `cd book-mall` 后再执行 `git commit`**（该目录下没有 `.git`，会继续用到上一级仓库或报错）。

若 **`git push` 被 GitHub 拒绝并提示 secret / push protection**：说明某次提交里带了密钥文件。切勿提交 `book-mall/.env.local`（及误建的 `.env`；已由 `book-mall/.gitignore` 忽略）；若已误提交，需从历史中移除后再推送。工具站侧同类说明见 **`tool-web/doc/product/fitting-room-and-ai-fit.md`** 第 3.1 节。

**请勿提交 `.pnpm-store/`**（已在根 `.gitignore` 忽略）。若曾经误执行过 `git add -A` 把 store 加进索引，请执行：

```bash
git rm -r --cached .pnpm-store
```

再提交。

## 历史说明

若仓库曾在「仅有 `book-mall` 为根」的时期有过提交，旧提交里的路径树与当前「一切在 `book-mall/` 下」的布局不一致；日常开发不影响。若需要整条历史都改成 monorepo 布局，需另行使用 `git filter-repo` 等重写历史（可选）。

## 腾讯云部署（Docker / 云托管）

主站与工具站已含 Dockerfile。**云托管 CloudBase Run**：同一仓库建两个服务，**目标目录**分别填 `book-mall`、`tool-web`，端口 **3000** / **3001**，环境变量在控制台填写（勿提交密钥）。详见 **`deploy/tencent/README.md`** 中的「云托管 CloudBase Run」小节；构建失败与 SSO 排障见根目录 **`deploy.md`**。

**当前生产域名约定**（自动部署时在控制台对齐即可；本地仍用 `localhost`）：

| 服务 | 浏览器 Origin | book-mall | tool-web |
|------|----------------|-----------|----------|
| 主站 | `https://book.ai-code8.com` | `NEXTAUTH_URL` | `MAIN_SITE_ORIGIN` |
| 工具站 | `https://tool.ai-code8.com` | `TOOLS_PUBLIC_ORIGIN` | `TOOLS_PUBLIC_ORIGIN`（与主站完全一致） |

`TOOLS_SSO_SERVER_SECRET` / `TOOLS_SSO_JWT_SECRET` 两端必须相同。模板见 **`deploy/tencent/book-mall.env.example`**、**`deploy/tencent/tool-web.env.example`**。

若在本机或自建机编排，可用根目录 **`docker-compose.yml`**。

## 仓库根上移（仅需做一次）

若你的 `.git` 仍在 `book-mall/` 内，可在 **`private_website/`** 执行：

```bash
chmod +x scripts/move-git-root-to-private-website.sh
./scripts/move-git-root-to-private-website.sh
```

按脚本末尾提示检查 `git status` 后提交。
