# 智选 AI Mall（前台与后台）

面向 **知识型 + 工具型** 产品的订阅与充值余额站点：**营销首页**、**产品与订阅**、**邮箱密码登录（NextAuth）**、**用户中心（账户 / 钱包 / 订阅）**、**管理后台 `/admin`**（分类、商品、计费公示、退款与用户管理）。业务规则详见仓库内 [`doc/product/`](./doc/product/) 与 [`doc/README.md`](./doc/README.md)。

技术栈：[Next.js 14](https://nextjs.org/) · [TypeScript](https://www.typescriptlang.org/) · [Tailwind CSS](https://tailwindcss.com/) · [shadcn/ui](https://ui.shadcn.com/) · [Prisma](https://www.prisma.io/) · [Neon PostgreSQL](https://neon.tech/) · [NextAuth.js](https://next-auth.js.org/)

![站点示意](./public/demo-img.jpg)

---

## 功能概览

| 区域 | 路径 / 说明 |
|------|-------------|
| 首页 | `/` — Hero、权益、功能、评价、定价、FAQ、计费公示等 |
| 登录 / 注册 | `/login`、`/register` |
| 订阅说明与下单入口 | `/subscribe` |
| 产品列表与详情 | `/products`、`/products/[slug]`，`/products/ai-courses`、`/products/ai-apps` |
| 用户中心（需登录） | `/account` — 资料、钱包、订阅与模拟支付相关入口 |
| 管理后台（需管理员） | `/admin/*` — 分类、商品、平台配置、账单公示、退款审批、用户列表 |
| API | `/api/auth/*`（NextAuth）、`/api/auth/register`；开发环境另有 `/api/dev/mock-subscribe`、`/api/dev/mock-topup`（模拟支付 / 充值） |

支付链路当前为 **模拟流程**，便于打通订单与权益；后续可替换为真实渠道（见 [`doc/tech/stack-and-environment.md`](./doc/tech/stack-and-environment.md)）。

---

## 环境要求

- **Node.js** ≥ 18.17（推荐 20 LTS）
- **包管理**：推荐使用 **pnpm**（仓库含 `pnpm-lock.yaml`）；亦可用 `npm`
- **数据库**：PostgreSQL（文档与脚本以 **Neon** 为例）

---

## 环境变量

复制 [`.env.example`](./.env.example) 为 **`.env.local`**（供 Next.js 与本地脚本），并建议 **再复制一份为 `.env`**（供 Prisma CLI 在 `pnpm build` / `prisma migrate` 等命令下默认读取；二者内容保持一致即可）。

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | ✅ | Neon **Pooled** 连接串（主机名常含 `-pooler`），建议 query 含 `sslmode=require`、`pgbouncer=true`、`connect_timeout=30` |
| `NEXTAUTH_URL` | ✅ | 站点绝对地址；本地 `http://localhost:3000`，生产 `https://你的域名` |
| `NEXTAUTH_SECRET` | ✅ | 随机密钥，如 `openssl rand -base64 32` |
| `ADMIN_EMAILS` | 建议 | 逗号分隔管理员邮箱；用户 **先注册** 后执行 `pnpm db:seed` 会将匹配用户的 `role` 升为 `ADMIN`，**需重新登录** 后 `/admin` 生效 |

---

## 本地开发（从零到可访问）

```bash
cd shadcn-landing-page
pnpm install          # 或 npm install
```

1. 按上文创建 `.env.local` 与 `.env`，填入 `DATABASE_URL`、`NEXTAUTH_URL`、`NEXTAUTH_SECRET`。
2. 初始化数据库结构并写入种子数据：

```bash
pnpm run db:deploy    # prisma migrate deploy（应用 prisma/migrations）
pnpm run db:seed      # 默认订阅档位、分类、平台配置；并按 ADMIN_EMAILS 提升管理员
```

3. 启动：

```bash
pnpm dev              # 默认 http://localhost:3000
```

4. 首次管理员：用 `/register` 注册账号 → 将邮箱写入 `.env.local` / `.env` 的 `ADMIN_EMAILS` → 再执行 `pnpm run db:seed` → 重新登录 → 访问 `/admin`。

可选：`pnpm run db:studio` 打开 Prisma Studio（通过仓库脚本读取 `.env.local`）。

---

## 生产构建与本地预览

```bash
pnpm run build        # 内含 prisma migrate deploy + prisma generate + next build，见 package.json
pnpm run start        # next start
```

构建阶段会向 **`DATABASE_URL` 指向的库** 执行迁移，请确保生产库的变量已在构建环境中配置正确（例如 Vercel 项目 Environment Variables）。

---

## 部署到 Vercel（对接 GitHub）

1. 将本仓库推送到 GitHub，在 [Vercel](https://vercel.com/) 中 **Import** 该仓库，Framework Preset 选 **Next.js**，**Root Directory** 若 monorepo 则指向 `shadcn-landing-page`。
2. 在 Vercel **Environment Variables**（Production / Preview 按需）中添加：
   - `DATABASE_URL`
   - `NEXTAUTH_URL`（生产域名，如 `https://www.example.com`）
   - `NEXTAUTH_SECRET`
   - `ADMIN_EMAILS`（可先留空，注册后再填并重跑 seed）
3. **Build Command** 保持默认 `pnpm run build`（或 `npm run build`）即可：已与迁移串联。
4. 首次部署成功后，在 **能访问生产数据库** 的环境执行一次种子（写入订阅档位、分类等；`ADMIN_EMAILS` 中的邮箱须已在站点注册）：

```bash
export DATABASE_URL="postgresql://…"    # 与 Vercel 中配置的生产库一致
export ADMIN_EMAILS="you@example.com"    # 可选；逗号分隔多个管理员邮箱

pnpm exec prisma db seed
```

也可将上述变量写入 `.env.local` 后执行 `pnpm run db:seed`。要点：**种子不会自动随 Vercel 构建执行**，上线初期至少需手动跑一次。

5. Neon 免费实例睡眠后首次连接可能较慢；连接串中加 `connect_timeout=30` 并在控制台唤醒项目可减少误报（详见 [`doc/tech/stack-and-environment.md`](./doc/tech/stack-and-environment.md)）。

6. **Preview 环境**：若 Vercel 上 Preview 与 Production 共用同一 `DATABASE_URL`，每次预览构建也会对该库执行迁移。建议为预览部署配置独立数据库或使用 Neon Branching，避免误伤生产数据。

---

## 常用脚本（package.json）

| 脚本 | 作用 |
|------|------|
| `pnpm dev` | 开发服务器 |
| `pnpm build` | 迁移部署 + 生成客户端 + Next 生产构建 |
| `pnpm start` | 生产模式启动 |
| `pnpm lint` | ESLint |
| `pnpm run db:deploy` | 应用迁移（读取 `.env.local`） |
| `pnpm run db:migrate` | 本地新建迁移（开发） |
| `pnpm run db:seed` | 种子数据 + 管理员邮箱绑定 |
| `pnpm run db:studio` | Prisma Studio |

---

## 文档与目录提示

- 产品规则：`doc/product/*.md`
- 环境与故障排查：`doc/tech/stack-and-environment.md`
- 开发流程：`doc/process/development-constraints.md`
- Prisma 模型：`prisma/schema.prisma`
- 迁移：`prisma/migrations/`

---

## 许可证与素材

代码与依赖许可证以各 package 及站内素材为准；商用部署前请自行核对第三方组件与字体、图片授权。
