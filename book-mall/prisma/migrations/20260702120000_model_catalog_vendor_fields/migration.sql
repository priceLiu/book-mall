-- v006（2026-05-17）：ModelCatalog 加 5 个 vendor* 字段，承载费用明细"厂商产品 5 列"展示
-- 1 catalog : 1 primary vendor 映射；未来扩展为 1:N 时把这 5 列迁到 ModelCatalogVendorBinding 表。

ALTER TABLE "ModelCatalog" ADD COLUMN IF NOT EXISTS "vendorProductName"       TEXT;
ALTER TABLE "ModelCatalog" ADD COLUMN IF NOT EXISTS "vendorCommodityCode"     TEXT;
ALTER TABLE "ModelCatalog" ADD COLUMN IF NOT EXISTS "vendorCommodityName"     TEXT;
ALTER TABLE "ModelCatalog" ADD COLUMN IF NOT EXISTS "vendorBillableItemCode"  TEXT;
ALTER TABLE "ModelCatalog" ADD COLUMN IF NOT EXISTS "vendorBillableItemName"  TEXT;
