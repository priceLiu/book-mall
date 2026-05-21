# 腾讯云部署说明

本仓库已带好 **`book-mall/Dockerfile`**、**`tool-web/Dockerfile`**、**`finance-web/Dockerfile`**（Next.js `standalone` 镜像）。  
在腾讯云 **自动构建、自动部署** 的场景下，你 **不必** 在自己电脑上执行 `docker compose`，也不必 SSH 上服务器敲命令——流水线会在每次推送后构建镜像并发布。

你需要做的只有：**第一次在控制台里把仓库和三个服务绑好，并把环境变量配齐**。之后日常就是 **`git push`**。

---

## 为什么 Git 仓库列表里看不到「finance-web」？

云托管「新建 Git 平台部署」的下拉框列出的是 **GitHub 仓库名**，不是 Monorepo 里的子目录。

| 你以为的 | 实际情况 |
|----------|----------|
| 单独仓库 `finance-web` | **不存在**；与主站、工具站同在 **`priceLiu/book-mall`** |
| 再选一次同一仓库 | 再 **新建一个服务**，**目标目录** 填 `finance-web` |

三个线上服务 = **同一仓库、三次部署配置、三个不同子目录**。

---

## 云托管 CloudBase Run（控制台怎么填）

若你用的是腾讯云 **云托管 CloudBase Run**（控制台「新版云托管」），字段名称与官方文档 **[云托管服务设置](https://cloud.tencent.com/document/product/1243/77197)** 一致。同一 Git 仓库请创建 **三个服务**；从 Git 自动构建可参考 **[通过 Git 仓库部署](https://docs.cloudbase.net/run/deploy/deploy/deploying-git)**。

| 控制台配置项 | 主站 | 工具站 | **财务控制台** |
|-------------|------|--------|----------------|
| **Git 仓库** | `priceLiu/book-mall` | 同上 | 同上 |
| **分支** | `main`（或你的发布分支） | 同上 | 同上 |
| **目标目录**（Monorepo 子目录） | `book-mall` | `tool-web` | **`finance-web`** |
| **Dockerfile** | 默认 `Dockerfile`（在该目标目录下） | 同上 | 同上 |
| **容器监听端口** | **3000** | **3001** | **3000** |
| **自定义域（示例）** | `book.ai-code8.com` | `tool.ai-code8.com` | **`f.ai-code8.com`** |

要点：

- **不要把仓库最外层**（含 `book-mall/`、`finance-web/` 的父目录）设为目标目录，否则 `Dockerfile` 找不到、构建失败。
- **财务服务**与主站一样，容器内 Next 监听 **3000**（对外映射由控制台「端口映射」决定）。
- 每个服务绑定各自域名；TLS 在「访问设置」里绑定。

### 新建 finance-web 服务（逐步）

1. 云托管 → **新建 Git 平台部署**（或「新建服务」）。
2. **Git 仓库**：选 **`priceLiu/book-mall`**（与主站相同，不是新仓库）。
3. **分支**：选 `main`（必填，否则会提示「仓库分支为必填项」）。
4. **服务名称**：例如 `finance-web` 或 `f-ai-code8`（小写、数字、连字符）。
5. 展开 **构建设置** → **目标目录 / Monorepo 子目录**：填 **`finance-web`**（不要带首尾 `/`）。
6. **端口**：服务端口 **3000**；访问端口按平台默认或自定义域 443 即可。
7. **环境变量**（见下表）→ 保存并触发构建。
8. **访问设置** → 绑定 **`f.ai-code8.com`**（DNS 先解析到云托管 CNAME）。

---

## 一、全自动部署：控制台一次性配置（推荐）

### 1. 准备三个「服务」

同一 Git 仓库部署三次：

| | 主站 | 工具站 | 财务 |
|--|------|--------|------|
| **代码目录** | `book-mall` | `tool-web` | `finance-web` |
| **容器端口** | 3000 | 3001 | 3000 |

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

本地端口：主站 **3000**、工具站 **3001**、财务 **3002**（映射到 finance-web 容器内 3000）。

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
| 502 | 容器端口：主站/财务 **3000**，工具站 **3001** |

---

## 五、CODING 等产品自建流水线

若走自建流水线，可参考 **`deploy/tencent/coding-ci-hints.md`**。纯控制台 Git 部署通常不需要。
