# 发布说明：计费身份划分与 Finance 2.0 全链路

## 面向用户

- 注册时需选择「平台代付」或「自带 Key」，选定后不可混用
- 平台代付用户无需绑定 Gateway Key，AI 费用从会员积分实时扣除
- 定价页可直达结账（会员 / BYOK / 轻量包）
- 财务中心可查看按工具 / 模型的用量与扣分明细

## 面向管理员 / 财务

- 员工账号前台与普通用户同样计费，报表中以「员工」标签区分
- 管理后台可按 平台代付 / BYOK / 个人 / 团队 / 员工 筛选对账
- legacy 课程订阅不再解锁 AI 工具

## 迁移与兼容

- 存量用户自动 backfill persona 与平台托管 Key
- 历史 ToolBillingDetailLine 保留只读；新明细以 GatewayRequestLog 为准

## 环境变量

- `PLATFORM_VENDOR_CREDENTIAL_IDS` — 平台托管 Key 绑定的凭证 ID 列表（逗号分隔）
- `PLATFORM_GATEWAY_API_KEY_ID` — 可选，从已有 PLATFORM sk-gw 复制凭证绑定

## 升级步骤

1. `cd book-mall && pnpm prisma migrate deploy`
2. `pnpm tsx scripts/backfill-billing-persona.ts`
3. 重启 book-mall / finance-web / gateway-web
