# 发布说明：Gateway 统一模型注册表

## 面向用户

- 各应用（Canvas、Story、工具站、电商分镜等）共用同一套 Gateway 模型目录；同一逻辑模型在选模框中只出现一次。
- **平台代付**：可选所有已上架、且适用于该应用的模型。
- **自带 Key（BYOK）**：仅展示已在 Gateway 注册、且与您已绑定厂商凭证匹配的模型；平台不代选路由，由您在选模框自行选择。

## 面向管理员 / 财务

- 「平台模型」后台按 **媒介类型 + 模型（canonical）** 管理，不再单独出现 `ecom` 应用块。
- 每个模型（canonicalKey）一行；**候选厂商 = 同一 canonical 的多条路由**（不同 vendor / modelKey）。
- 系统自动在毛利达标前提下选择 **净成本最低** 的厂商路由；运营可 **设为当前** 并 **锁定**。
- 毛利护栏、积分报价规则不变。

## 迁移与兼容

- 新增表 `GatewayModelRoute`；`ModelCatalog` 扩展 `appTags` / `gatewayPublished` 等字段。
- `AppModelOffering` 改为按 `canonicalModelKey` 唯一；旧 `appKey=ecom` 场景行废弃。
- 平行硬编码清单（`ecom-storyboard-chat-models` 等）逐步改为读 DB 注册表。

## 升级步骤

1. `cd book-mall && pnpm prisma migrate deploy`
2. `pnpm tsx scripts/seed-gateway-model-registry.ts --confirm`
3. `pnpm tsx scripts/auto-publish-platform-offerings.ts`（或财务后台「同步自动上架」）
4. 重启 book-mall / finance-web / gateway-web
5. 可选校验：`pnpm tsx scripts/verify-gateway-model-registry.ts`

## 回滚

- 保留迁移前 DB 快照；回滚后需恢复旧 `AppModelOffering(appKey, scenarioKey)` 语义（不推荐与新区并存）。

## 参考

- 技术 ADR：`book-mall/doc/tech/gateway-unified-model-registry.md`
