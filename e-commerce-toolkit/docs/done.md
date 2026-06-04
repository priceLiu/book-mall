# 电商工具箱 · 进度跟踪

与 [plan.md](./plan.md) 同步。

## 里程碑

- [x] 文档：plan / done / price-baseline / book 产品分册
- [x] M0 骨架与 SSO
- [x] M1 双计费与价目
- [x] M2 图类全模块
- [x] M3 视频族全 preset
- [x] M4 品牌长片与部署

## M0 骨架与 SSO

- [x] `package.json`、Next 14、Tailwind、端口 3007
- [x] `globals.css` 设计 Token（DESIGN.md）
- [x] 全屏布局 + 门户首页 Tile
- [x] `/auth/sso/callback`、`/api/tools-session`
- [x] `dev:all` 与 `docs/dev.md` 端口表

## M1 双计费

- [x] `User.ecomBillingMode` 迁移
- [x] `e-commerce-toolkit` navKey + ToolServiceFeePlan seed
- [x] `isEcomToolkitToolKey` + usage 分支
- [x] `ECOM_PLATFORM_GATEWAY_API_KEY_ID` + `E_COMMERCE` clientSource
- [x] 个人中心：计费模式切换 + 打开电商工具箱
- [x] introspect 返回 `ecom_billing_mode`

## M2 图类

- [x] 主图 / 详情 / 模特 / 海报 / IP / VI 工作台
- [x] `EcomAsset` + OSS 入库 API
- [x] Dialog 二次确认删除

## M3 视频

- [x] 8 个 `/ecom/video/[preset]` 页面
- [x] reserve / settle 联调（6a）
- [x] 口播 / 数字人等 preset 共用视频管线

## M4 部署

- [x] 宣传片 / 广告工作台（脚本+视频占位）
- [x] Dockerfile + `deploy/tencent/e-commerce-toolkit.env.example`
- [x] [docs/全站架构图与配置表.md](../../docs/全站架构图与配置表.md) 更新

## 本地启动前

1. `book-mall` 执行 `pnpm db:deploy`（迁移 `20260604120000_ecommerce_toolkit`）
2. `.env.local` 配置 `TOOLS_SSO_*`、`NEXT_PUBLIC_ECOMMERCE_WEB_ORIGIN=http://localhost:3007`
3. 6a 代付：配置 `ECOM_PLATFORM_GATEWAY_API_KEY_ID`（PLATFORM sk-gw）
4. `cd e-commerce-toolkit && pnpm install && pnpm dev`
