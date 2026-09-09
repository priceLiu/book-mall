-- Billing tech refactor (release_20260906)
-- 完整 DDL 已于 2026-09-06 在 dev/prod 手工落库（见 prisma/migrations/manual_tech_refactor_credit_model/up.sql）。
-- 本迁移仅登记 Prisma 历史并对齐锚点；对已同步库为幂等 no-op。

UPDATE "PlatformPricingConfig"
SET "creditAnchorYuan" = 0.03
WHERE id = 'default'
  AND "creditAnchorYuan" <> 0.03;
