# 部署与构建排障（private_website）

本文汇总 **主站 `book-mall` + 工具站 `tool-web`** 在云托管 / Docker 部署过程中出现过的问题、注意事项与仓库内对应处理方式。  
腾讯云控制台逐项配置仍以 **[deploy/tencent/README.md](./deploy/tencent/README.md)** 为准；本文侧重 **构建失败、环境变量与 SSO 跳转** 的共性原因。

---

## 1. 架构要点

| 项目 | 目录 | 容器监听端口 | 说明 |
|------|------|----------------|------|
| 主站 | `book-mall/` | **3000** | Prisma、NextAuth、工具站 SSO 签发 |
| 工具站 | `tool-web/` | **3001** | 独立域名；换票回调 `/auth/sso/callback` |

- **同一 Git 仓库，一般需要两套部署（两个云托管服务）**，分别绑定上述目录与端口；不要把仓库根目录当成构建根目录。  
- GitHub 上仓库名可能仍为 `book-mall`，工具站在子目录 **`tool-web/`** 下。

---

## 2. 控制台必填（易错）

| 配置项 | book-mall | tool-web |
|--------|-----------|----------|
| 目标目录 / 构建上下文 | `book-mall` | `tool-web` |
| Dockerfile | 有，`Dockerfile` | 同上 |
| **服务端口（进程监听）** | **3000** | **3001** |

勿把「访问端口 / 网关 80」与「容器内进程端口」混填：进程必须与健康检查一致（3000 / 3001）。

---

## 3. 环境变量与 SSO（高频故障）

### 3.1 主站 `book-mall`（至少）

`NODE_ENV`、`DATABASE_URL`、`NEXTAUTH_URL`、`NEXTAUTH_SECRET`、`TOOLS_PUBLIC_ORIGIN`、`TOOLS_SSO_SERVER_SECRET`、`TOOLS_SSO_JWT_SECRET`（可选 `ADMIN_EMAILS` 等）。

### 3.2 工具站 `tool-web`（至少）

`NODE_ENV`、`MAIN_SITE_ORIGIN`、与主站完全一致的 **`TOOLS_PUBLIC_ORIGIN`**（浏览器访问工具站的 Origin；生产必填，否则换票失败页可能跳到 **`http://0.0.0.0:3001`**）、`TOOLS_SSO_SERVER_SECRET`、`TOOLS_SSO_JWT_SECRET`；AI/OSS 见 `tool-web/.env.example`。

### 3.3 Origin 写法（必读）

- 必须使用 **`https://`**（生产），与用户浏览器地址栏 **协议 + 主机 + 端口** 一致。  
- **`NEXTAUTH_URL`（主站）** 与 **`MAIN_SITE_ORIGIN`（工具站）** 语义对齐（同一主站访问入口）。  
- **`TOOLS_PUBLIC_ORIGIN`（主站）** = 用户打开 **工具站** 的 Origin。  
- **禁止**写成 `https://域名/:3001`（端口写在路径里）。错误示例会导致跳转  
  `…tcloudbase.com/:3001/auth/sso/callback`，Next 无法匹配路由 → **404**。  
  正确示例：`https://tool-web-xxx.sh.run.tcloudbase.com`（云托管多数无需在 URL 里写 `:3001`），或 `https://主机:3001`（端口紧跟主机名）。

仓库已在 **`book-mall/lib/sso-tools-env.ts`**（`TOOLS_PUBLIC_ORIGIN`）与 **`tool-web/lib/site-origin.ts`**（`MAIN_SITE_ORIGIN`）对「域名/:端口」误填做 **自动纠正**，仍建议在控制台改为规范写法。

---

## 4. 构建阶段常见问题与处理

### 4.1 自动部署开启失败：仓库里找不到 Dockerfile

**原因**：平台默认在 **仓库根** 查找 `Dockerfile`；本仓库 Dockerfile 在子目录。  

**处理**：目标目录填 **`book-mall`** 或 **`tool-web`**；确认对应分支已推送且该目录下存在 `Dockerfile`。

### 4.2 book-mall：`pnpm install` 阶段 Prisma 找不到 `schema.prisma`

**现象**：`schema.prisma: file not found`，发生在 Docker `deps` 层执行 `pnpm install` 时（触发了 `postinstall` → `prisma generate`）。  

**原因**：`Dockerfile` 原先只复制了 `package.json` / lockfile，未复制 `prisma/`。  

**处理**：已在 **`book-mall/Dockerfile`** 的 `deps` 阶段于 `pnpm install` **之前**增加 `COPY prisma ./prisma`。

### 4.3 book-mall：`next build` 报 Prisma `groupBy` 缺少 `orderBy`

**现象**：`Property 'orderBy' is missing … toolUsageEvent.groupBy`。  

**原因**：Prisma 6 类型要求 `groupBy` 显式 `orderBy`。  

**处理**：在相关 `groupBy` 上补充 `orderBy`（如 `{ toolKey: "asc" }`）；并对 `_count` / `_sum` 聚合结果做安全读取（见 `app/admin/page.tsx`、`app/api/sso/tools/usage/route.ts`）。

### 4.4 book-mall：构建或静态分析阶段报 `DATABASE_URL` 未定义

**现象**：日志中出现 `Environment variable not found: DATABASE_URL`，栈涉及页面或 **Route Handler** 的预收集。  

**原因**：多数云平台 **构建镜像时不注入** `DATABASE_URL`，仅运行时注入；Next 默认会对部分路由做构建期处理，从而执行带 Prisma 的代码。  

**处理（仓库已做）**：  
- 在 **`app/(site)/layout.tsx`**、**`app/admin/layout.tsx`**、**`app/(account)/layout.tsx`** 声明 **`export const dynamic = "force-dynamic"`**，避免依赖数据库的页面在构建期预渲染。  
- 对所有 **`app/api/**/route.ts`** 中可能间接命中数据库的路由补充 **`export const dynamic = "force-dynamic"`**。

本地可模拟：  
`env -u DATABASE_URL pnpm run build:docker`（在 `book-mall/` 下）。

### 4.5 tool-web：`Route` 导出非法字段导致类型检查失败

**现象**：`"AI_FIT_USAGE_TOOL_KEY" is not a valid Route export field`。  

**原因**：App Router 的 `route.ts` 只能导出约定字段（如 `GET`、`dynamic`、`runtime` 等），不能把业务常量 **`export`** 出去。  

**处理**：将常量改为模块内 **`const`**（见 **`app/api/ai-fit/try-on/route.ts`**）。

### 4.6 tool-web：`formatTryOnBillingLine` 与 `t` 类型不兼容

**处理**：调用处对 `t` 做收窄（如 `t as (key: string) => string`），见 **`app/fitting-room/ai-fit/ai-fit-client.tsx`**。

### 4.7 tool-web：`next build` 收集路由时 `ali-oss` 触发系统调用失败

**现象**：如 `uv_interface_addresses` / `networkInterfaces` 相关错误（部分 CI / 沙箱环境）。  

**原因**：顶层 `import OSS from "ali-oss"` 在加载模块时初始化 SDK。  

**处理**：在 **`tool-web/lib/oss-client.ts`** 中改为 **`await import("ali-oss")`** 再实例化客户端；**`ai-fit-oss-upload.ts`** 对 `createOssClientFrom` 使用 `await`。

---

## 5. 运行时与联调

| 现象 | 排查方向 |
|------|----------|
| 主站 → 工具站 SSO **404**，URL 含 **`/:3001/`** | 修正 **`TOOLS_PUBLIC_ORIGIN`**；部署含 Origin 规范化代码的版本 |
| 换票后跳到 **`0.0.0.0:3001`**、`ERR_CONNECTION_CLOSED` | 工具站环境变量增加与主站一致的 **`TOOLS_PUBLIC_ORIGIN`**；代码已用其作为 **`/auth/sso/callback`** 重定向基地址（见 **`tool-web/lib/site-origin.ts`**） |
| **`/sso-error?reason=exchange_401`** | 主站 **`/api/sso/tools/exchange`** 校验 **`Authorization: Bearer`** 未通过：核对两端 **`TOOLS_SSO_SERVER_SECRET`** 是否完全一致（无空格、换行、引号） |
| Cookie / 登录异常 | `NEXTAUTH_URL`、`TOOLS_PUBLIC_ORIGIN`、`MAIN_SITE_ORIGIN` 是否与浏览器完全一致；勿混用 `http`/`https`、勿漏协议 |
| Prisma 迁移失败 | 运行时 **`DATABASE_URL`**、数据库白名单、容器能否连库 |
| 502 / 健康检查失败 | 平台端口是否为 **3000** / **3001** |

---

## 6. 本地快速自检

```bash
# 主站类型检查 + 无库构建（验证 DATABASE_URL 不设时能否通过构建）
cd book-mall && pnpm exec tsc --noEmit && env -u DATABASE_URL pnpm run build:docker

# 工具站
cd tool-web && pnpm exec tsc --noEmit && pnpm run build:docker
```

---

## 7. 相关文件索引

| 文件 | 用途 |
|------|------|
| [deploy/tencent/README.md](./deploy/tencent/README.md) | 腾讯云步骤、变量列表、官方文档链接 |
| [deploy/tencent/book-mall.env.example](./deploy/tencent/book-mall.env.example) | 主站 Compose / 对照用变量模板 |
| [deploy/tencent/tool-web.env.example](./deploy/tencent/tool-web.env.example) | 工具站模板 |
| [docker-compose.yml](./docker-compose.yml) | 本地双容器编排 |
| `book-mall/.env.example`、`tool-web/.env.example` | 开发与文档说明 |

---

## 8. 修订说明

文档随部署踩坑更新；若云平台行为变更（构建是否注入构建期环境变量等），以控制台说明为准，并可在本节追加条目。
