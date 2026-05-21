# 腾讯云部署说明

本仓库已带好 **`book-mall/Dockerfile`**、**`tool-web/Dockerfile`**、**`finance-web/Dockerfile`**（Next.js `standalone` 镜像）。  
在腾讯云 **自动构建、自动部署** 的场景下，你 **不必** 在自己电脑上执行 `docker compose`，也不必 SSH 上服务器敲命令——流水线会在每次推送后构建镜像并发布。

> **第一次开服务 / 重建服务**：直接看 **[`cloudbase-build-guide.md`](./cloudbase-build-guide.md)**（控制台逐步流程、字段对照、环境变量、验收清单、故障排查）。本文档保留为概览。

你需要做的只有：**第一次在控制台里把仓库和三个服务绑好，并把环境变量配齐**。之后日常就是 **`git push`**。

---

## Git 仓库与本地文件夹（先看懂这张图）

云托管「请选择仓库地址」列出的是 **GitHub 上的仓库全名**（如 `priceLiu/book-mall`），**不会**列出仓库里的子文件夹（`book-mall/`、`tool-web/`、`finance-web/`）。

本地工程结构（你 IDE 里看到的）与下拉框 **不是一一对应**：

```text
priceLiu/book-mall（一个 Git 仓库，推送后云构建可选这一条）
├── book-mall/      ← 主站：目标目录填 book-mall
├── tool-web/       ← 工具站：目标目录填 tool-web（与主站同仓库）
└── finance-web/    ← 财务：目标目录填 finance-web（与主站同仓库，无需新仓库）
```

| 你 IDE 里的文件夹 | 是否要在 Git 下拉里单独出现一行 | 云构建正确做法 |
|------------------|-------------------------------|----------------|
| `book-mall/` | 否；选 **`priceLiu/book-mall`** | 目标目录 **`book-mall`** |
| `tool-web/` | 否；同上 | 目标目录 **`tool-web`** |
| `finance-web/` | 否；同上 | 目标目录 **`finance-web`** |

**财务不需要、也不应该单独建 `priceLiu/finance-web` 仓库**，做法与 `tool-web` 在 Monorepo 里一致。

若下拉里还有 **`priceLiu/ai_tools_site`** 等其它仓库，那是 **另外的 Git 项目**，不是当前这个 Monorepo 里的 `tool-web/` 文件夹名；本仓库三个应用 **都绑定 `priceLiu/book-mall`** 即可。

---

## 云托管 CloudBase Run（控制台怎么填）

若你用的是腾讯云 **云托管 CloudBase Run**（控制台「新版云托管」），字段名称与官方文档 **[云托管服务设置](https://cloud.tencent.com/document/product/1243/77197)** 一致。同一 Git 仓库请创建 **三个服务**；从 Git 自动构建可参考 **[通过 Git 仓库部署](https://docs.cloudbase.net/run/deploy/deploy/deploying-git)**。

| 控制台配置项 | 主站 | 工具站 | **财务控制台** |
|-------------|------|--------|----------------|
| **Git 仓库** | `priceLiu/book-mall` | 同上 | 同上 |
| **分支** | `main`（或你的发布分支） | 同上 | 同上 |
| **目标目录**（Monorepo 子目录） | `book-mall` | `tool-web` | **`finance-web`** |
| **Dockerfile** | 默认 `Dockerfile`（在该目标目录下） | 同上 | 同上 |
| **容器监听端口** | **3000** | **3001** | **3002** |
| **自定义域（示例）** | `book.ai-code8.com` | `tool.ai-code8.com` | **`f.ai-code8.com`** |

要点：

- **不要把仓库最外层**（含 `book-mall/`、`finance-web/` 的父目录）设为目标目录，否则 `Dockerfile` 找不到、构建失败。
- **财务服务**与工具站一样，容器内 Next 监听 **3002**（与本地 `pnpm dev` 端口一致）。
- 每个服务绑定各自域名；TLS 在「访问设置」里绑定。

### 新建 finance-web 服务（逐步）

1. 云托管 → **新建 Git 平台部署**（或「新建服务」）。
2. **Git 仓库**：选 **`priceLiu/book-mall`**（与主站相同，不是新仓库）。
3. **分支**：选 `main`（必填，否则会提示「仓库分支为必填项」）。
4. **服务名称**：例如 `finance-web` 或 `f-ai-code8`（小写、数字、连字符）。
5. 展开 **构建设置** → **目标目录 / Monorepo 子目录**：填 **`finance-web`**（不要带首尾 `/`）。
6. **端口**：服务端口 **3002**（与 `tool-web` 填 **3001** 同理）；访问端口按平台默认或自定义域 443 即可。
7. **环境变量**（见下表）→ 保存并触发构建。
8. **访问设置** → 绑定 **`f.ai-code8.com`**（DNS 先解析到云托管 CNAME）。

---

## 一、全自动部署：控制台一次性配置（推荐）

### 1. 准备三个「服务」

同一 Git 仓库部署三次：

| | 主站 | 工具站 | 财务 |
|--|------|--------|------|
| **代码目录** | `book-mall` | `tool-web` | `finance-web` |
| **容器端口** | 3000 | 3001 | 3002 |

各云产品字段可能叫 **「构建目录」「根目录」「上下文路径」「代码子目录」**，含义相同。

### 2. 环境变量（控制台录入，勿提交密钥）

**主站 `book-mall`**（至少）：

- `DATABASE_URL`、`NEXTAUTH_URL`、`NEXTAUTH_SECRET`
- `TOOLS_PUBLIC_ORIGIN`、`TOOLS_SSO_SERVER_SECRET`、`TOOLS_SSO_JWT_SECRET`
- `NEXT_PUBLIC_FINANCE_WEB_ORIGIN=https://f.ai-code8.com`
- `FINANCE_WEB_ORIGINS=https://f.ai-code8.com`

**工具站 `tool-web`**（至少）：

- `MAIN_SITE_ORIGIN`、`TOOLS_PUBLIC_ORIGIN`
- `TOOLS_SSO_SERVER_SECRET`、`TOOLS_SSO_JWT_SECRET`（与主站一致）

**财务 `finance-web`**（至少）：

- `NEXT_PUBLIC_BOOK_MALL_URL=https://book.ai-code8.com`

对照文件：`deploy/tencent/book-mall.env.example`、`tool-web.env.example`、**`finance-web.env.example`**。  
更全说明见仓库根目录 [`DEPLOY.md`](../../DEPLOY.md)。

### 3. SSO / 域名要点

- `NEXTAUTH_URL`、`TOOLS_PUBLIC_ORIGIN`、`MAIN_SITE_ORIGIN`、`NEXT_PUBLIC_BOOK_MALL_URL`、`NEXT_PUBLIC_FINANCE_WEB_ORIGIN` 必须与浏览器地址栏 **协议 + 域名** 一致。
- **不要**填 Docker 内部主机名（如 `http://book-mall:3000`）。

配置保存并发布后，日常 **`git push`** 即可触发各服务按各自目标目录重新构建。

---

## 二、可选：本地 Docker Compose

```bash
./deploy/tencent/bootstrap-env.sh
# 编辑 deploy/tencent/book-mall.env、tool-web.env、finance-web.env
docker compose up -d --build
```

本地端口：主站 **3000**、工具站 **3001**、财务 **3002**（与容器内监听端口一致）。

---

## 三、构建行为摘要（供排障）

- Next.js **`output: 'standalone'`**。
- **主站** entrypoint 会执行 **`prisma migrate deploy`**（需 `DATABASE_URL`）。
- 镜像构建使用 **`pnpm run build:docker`** 或 **`npm run build`**（视各工程 `package.json` 而定）。
- **finance-web** 使用 Node 22 + `NODE_OPTIONS=--experimental-sqlite`（Prisma 相关依赖）。

---

## 四、故障排查

| 现象 | 可检查项 |
|------|----------|
| 列表里没有 finance-web 仓库 | 正常；选 **`priceLiu/book-mall`** + 目标目录 **`finance-web`** |
| 财务页 403 / 拉不到用户 | 先在 **book.ai-code8.com** 管理员登录；`FINANCE_WEB_ORIGINS` 是否含财务域 |
| SSO / 跳转异常 | 各 `*_ORIGIN` 是否与线上一致 |
| 502 | 容器端口：主站 **3000**，工具站 **3001**，财务 **3002** |

---

## 五、CODING 等产品自建流水线

若走自建流水线，可参考 **`deploy/tencent/coding-ci-hints.md`**。纯控制台 Git 部署通常不需要。
