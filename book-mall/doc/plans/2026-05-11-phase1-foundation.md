# 阶段一：账户、库表与模拟支付（AI Mall）

- **创建日期**：2026-05-11  
- **关联**：`doc/product/02-users-billing-and-balance.md`、`doc/tech/stack-and-environment.md`  
- **库变更**：`doc/database/schema-changelog.md` § 2026-05-11  

## 任务清单

- [x] Prisma + Neon 模型（用户、钱包、订阅、订单、平台配置、NextAuth 表）
- [x] 迁移文件 `20250511040000_init_ai_mall`
- [x] NextAuth 邮箱密码 + 注册 API
- [x] `/login`、`/register`、`/account`（个人中心雏形）
- [x] 开发用模拟充值、模拟订阅 API
- [x] 导航登录/注册/个人中心入口
- [ ] 本机执行 `pnpm run db:deploy && pnpm run db:seed` 并验证注册登录流程

## 验收

1. 迁移可应用到 `ai_mall` 库且无错误。  
2. 注册后登录，`/account` 展示余额与订阅状态；开发环境下模拟按钮可加余额、开通订阅。  
3. `getMembershipFlags` 与产品文档「高级会员状态」定义一致。
