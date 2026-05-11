# 数据库结构变更登记

按时间 **倒序或正序一致即可**，建议 **新记录追加在文件底部**。  
大变更可另行新增 `doc/database/YYYY-MM-DD-简短标题.md` 并在此文件首行链接。

---

## 2026-05-12 — 计费配置扩展与退款审核

- **迁移目录**：`prisma/migrations/20250512120000_billing_refunds/`  
- **PlatformConfig**：`llmInputPer1kTokensMinor`、`llmOutputPer1kTokensMinor`、`toolInvokePerCallMinor`、`usageAnomalyRatioPercent`。  
- **Order**：`refundedAt`（订阅退款完成后标记，避免重复退）。  
- **新表**：`WalletRefundRequest`、`SubscriptionRefundRequest`，枚举 `RefundRequestStatus`。  
- **应用**：`pnpm run db:deploy`。

## 2026-05-11 — 用户角色 `User.role`

- **迁移目录**：`prisma/migrations/20250511120000_add_user_role/`  
- **变更**：枚举 `UserRole`（`USER` | `ADMIN`）；`User.role` 默认 `USER`。  
- **运营**：在 `.env.local` 配置 `ADMIN_EMAILS`（逗号分隔）后执行 `pnpm db:seed` 提升对应账号；**须重新登录**后 JWT 才带 `ADMIN`。  
- **入口**：前台导航「管理后台」→ `/admin`（middleware 拦截非管理员）。

## 2026-05-11 — `init_ai_mall` 首版表结构

- **迁移目录**：`prisma/migrations/20250511040000_init_ai_mall/`  
- **表**：NextAuth（`User`, `Account`, `Session`, `VerificationToken`）、`PlatformConfig`、`Wallet`、`WalletEntry`、`SubscriptionPlan`、`Subscription`、`Order`  
- **枚举**：`WalletEntryType`、`SubscriptionInterval`、`SubscriptionStatus`、`OrderType`、`OrderStatus`  
- **回滚**：开发环境可 `DROP SCHEMA public CASCADE` 后重建（**生产禁止**）；生产需逆向迁移或备份后操作。  
- **本机应用**：`pnpm run db:deploy`（依赖 `.env.local` 中 `DATABASE_URL`），然后 `pnpm run db:seed`。当前团队环境使用 Neon 默认库 **`neondb`** 亦可。

## 2026-05-10 — 初始化

- **库名（逻辑）**：文档曾用 `ai_mall`；**Neon 控制台默认 database 多为 `neondb`**，将 `DATABASE_URL` 指向实际库名即可（见 `doc/tech/stack-and-environment.md`）。  
- **说明**：原占位；**2026-05-11** 起已有正式迁移，见上条。

## 2026-05-10 — 产品分类与产品（知识型 / 工具型）

- **迁移目录**：`prisma/migrations/20260510120000_products/`  
- **新表**：`ProductCategory`（`parentId` 自关联子分类）、`Product`。  
- **枚举**：`ProductKind`、`ProductTier`、`ProductStatus`。  
- **首页推荐**：`Product.featuredHome`、`featuredSort`（仅 `PUBLISHED` 且勾选后在首页展示）。  
- **应用**：`pnpm run db:deploy`，再 `pnpm db:seed`（会写入默认「AI 课程」「AI 应用」分类）。

<!-- 模板（复制使用）
## YYYY-MM-DD — 标题
- **迁移/脚本**：
- **表/字段**：
- **原因**：
- **回滚**：
-->
