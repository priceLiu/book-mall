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

SSO 联调时：主站 `.env.local` 设置 `TOOLS_PUBLIC_ORIGIN=http://127.0.0.1:3001`，工具站 `.env.local` 设置 `MAIN_SITE_ORIGIN=http://localhost:3000`，两端 Secret 一致。详见 **`book-mall/doc/tech/tools-sso-environment.md`**、**`tool-web/README.md`**。

## 工具站清理重装（可选）

若在迁移目录后依赖路径怪异，可在 **`tool-web/`** 下：

```bash
rm -rf node_modules .next
pnpm install
```

## 提交约定

在 **`private_website/`** 根目录执行 `git add` / `git commit` / `git push` 即可同时包含 `book-mall` 与 `tool-web`。

**请勿提交 `.pnpm-store/`**（已在根 `.gitignore` 忽略）。若曾经误执行过 `git add -A` 把 store 加进索引，请执行：

```bash
git rm -r --cached .pnpm-store
```

再提交。

## 历史说明

若仓库曾在「仅有 `book-mall` 为根」的时期有过提交，旧提交里的路径树与当前「一切在 `book-mall/` 下」的布局不一致；日常开发不影响。若需要整条历史都改成 monorepo 布局，需另行使用 `git filter-repo` 等重写历史（可选）。

## 仓库根上移（仅需做一次）

若你的 `.git` 仍在 `book-mall/` 内，可在 **`private_website/`** 执行：

```bash
chmod +x scripts/move-git-root-to-private-website.sh
./scripts/move-git-root-to-private-website.sh
```

按脚本末尾提示检查 `git status` 后提交。
