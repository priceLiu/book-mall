# 腾讯云部署说明

本仓库已带好 **`book-mall/Dockerfile`**、**`tool-web/Dockerfile`**（Next.js `standalone` 镜像）。  
在腾讯云 **自动构建、自动部署** 的场景下，你 **不必** 在自己电脑上执行 `docker compose`，也不必 SSH 上服务器敲命令——流水线会在每次推送后构建镜像并发布。

你需要做的只有：**第一次在控制台里把仓库和两个服务绑好，并把环境变量配齐**。之后日常就是 **`git push`**。

---

## 云托管 CloudBase Run（控制台怎么填）

若你用的是腾讯云 **云托管 CloudBase Run**（控制台「新版云托管」），字段名称与官方文档 **[云托管服务设置](https://cloud.tencent.com/document/product/1243/77197)** 一致。同一 Git 仓库请创建 **两个服务**（主站 + 工具站）；从 Git 自动构建可参考 **[通过 Git 仓库部署](https://docs.cloudbase.net/run/deploy/deploy/deploying-git)**。

| 控制台配置项 | 主站服务 | 工具站服务 |
|-------------|---------|-----------|
| **目标目录**（Monorepo 子目录） | `book-mall` | `tool-web` |
| **Dockerfile** | 默认 `Dockerfile`（须在该目标目录的根目录下；本仓库已满足） | 同上 |
| **端口**（容器监听） | **3000** | **3001** |

要点：**不要把仓库最外层 `private_website/` 设为目标目录**，否则构建上下文不对、`Dockerfile` 也不在根下会报错。每个服务绑定各自域名（生产请在控制台绑定 **自定义域名 + HTTPS 证书**）。

以下「环境变量」「SSO 域名」与下一节 **「一、全自动部署」** 相同。

---

## 一、全自动部署：控制台一次性配置（推荐）

### 1. 准备两个「服务」或两条流水线

同一 Git 仓库拉两次，分别对应 **主站** 和 **工具站**：

| | 主站（book-mall） | 工具站（tool-web） |
|--|------------------|-------------------|
| **代码目录 / 构建上下文** | `book-mall` | `tool-web` |
| **Dockerfile** | 默认 `Dockerfile`（在该目录下） | 同上 |
| **容器监听端口** | **3000** | **3001** |
| **访问域名（示例）** | `https://你的主站域名` | `https://你的工具站域名` |

各云产品的叫法可能不同：**「构建目录」「根目录」「上下文路径」「代码子目录」**，含义都是：不要用最外层仓库根目录，而要填 **`book-mall`** 或 **`tool-web`**。

### 2. 在控制台里配置环境变量（不要提交密钥到 Git）

在 **主站服务** 的环境变量 / 配置中心里填写（名称与本地 `.env` 一致），至少包括：

- `DATABASE_URL` — PostgreSQL（镜像启动时会执行 `prisma migrate deploy`）
- `NEXTAUTH_URL` — **浏览器里打开主站的完整 origin**，如 `https://mall.example.com`
- `NEXTAUTH_SECRET`
- `TOOLS_PUBLIC_ORIGIN` — **浏览器里打开工具站的 origin**，如 `https://tools.example.com`
- `TOOLS_SSO_SERVER_SECRET`、`TOOLS_SSO_JWT_SECRET` — 须与工具站 **完全一致**

在 **工具站服务** 里填写：

- `MAIN_SITE_ORIGIN` — 与主站公网 origin 一致（无末尾 `/`），如 `https://mall.example.com`
- `TOOLS_SSO_SERVER_SECRET`、`TOOLS_SSO_JWT_SECRET` — 与主站相同  

更全的可选项见：`book-mall/.env.example`、`tool-web/.env.example`。

**说明**：仓库里的 `deploy/tencent/book-mall.env.example` 等文件是给 **本地 Docker Compose 对照用** 的；腾讯云全自动部署一般在 **控制台界面** 里录入变量，平台注入容器，**不要求**你把 `.env` 提交进 Git。

### 3. SSO / 域名要点（否则表现为「登录乱跳、工具站打不开」）

- `NEXTAUTH_URL`、`TOOLS_PUBLIC_ORIGIN`、`MAIN_SITE_ORIGIN` 必须与用户浏览器地址栏的 **协议 + 域名 + 端口** 一致。  
- **不要**填 Docker 内部主机名（如 `http://book-mall:3000`）。

配置保存并触发一次发布后，以后你只要 **`git push`**，平台会按各自服务的构建目录重新构建并滚动发布。

---

## 二、可选：本地或自建机用 Docker Compose

若你想在自己电脑或一台 CVM 上 **手动** 起两个容器（与腾讯云全自动无关），可用仓库根目录的 **`docker-compose.yml`**：

```bash
./deploy/tencent/bootstrap-env.sh
# 编辑 deploy/tencent/book-mall.env 与 deploy/tencent/tool-web.env
docker compose up -d --build
```

详见文末变量说明与 **`deploy/tencent/book-mall.env.example`**、**`tool-web.env.example`**。

---

## 三、构建行为摘要（供排障）

- Next.js 使用 **`output: 'standalone'`**，镜像体积较小。  
- **主站**容器启动时会执行 **`prisma migrate deploy`**（需容器能访问 `DATABASE_URL`）。  
- 镜像内构建命令为 **`pnpm run build:docker`**（`prisma generate && next build`，不在构建阶段连库做 migrate）。

---

## 四、故障排查

| 现象 | 可检查项 |
|------|----------|
| SSO / 跳转异常 | `NEXTAUTH_URL`、`TOOLS_PUBLIC_ORIGIN`、`MAIN_SITE_ORIGIN` 是否与线上域名完全一致 |
| 迁移失败 | RDS 白名单 / 安全组、连接串、`DATABASE_URL` |
| 502 / 健康检查失败 | 平台配置的容器端口是否为 **3000** / **3001**，与监听一致 |

---

## 五、CODING 等产品自建流水线

若实际走的是「自建流水线 + 自己写 shell」，可参考 **`deploy/tencent/coding-ci-hints.md`**。纯控制台全自动托管的用户通常不需要该文件。
