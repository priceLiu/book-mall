-- AI 试衣 v1.0.0：累计用量表 + parsing/refiner 价目行（D 表）
-- 需求：doc/product/11-ai-tryon-cost-template-v1.0.md

CREATE TABLE IF NOT EXISTS "ToolModelUsageCounter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modelKey" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolModelUsageCounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ToolModelUsageCounter_userId_modelKey_periodKey_key"
    ON "ToolModelUsageCounter"("userId", "modelKey", "periodKey");
CREATE INDEX IF NOT EXISTS "ToolModelUsageCounter_userId_modelKey_idx"
    ON "ToolModelUsageCounter"("userId", "modelKey");

ALTER TABLE "ToolModelUsageCounter" DROP CONSTRAINT IF EXISTS "ToolModelUsageCounter_userId_fkey";
ALTER TABLE "ToolModelUsageCounter" ADD CONSTRAINT "ToolModelUsageCounter_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- D 表：试衣 parsing（按输入张）
INSERT INTO "ToolBillablePrice" (
  "id", "toolKey", "action", "pricePoints", "effectiveFrom", "active", "note",
  "schemeARefModelKey", "schemeAUnitCostYuan", "schemeAAdminRetailMultiplier",
  "cloudModelKey", "cloudTierRaw", "cloudBillingKind", "createdAt", "updatedAt"
)
SELECT
  'tb_tryon_parsing_v1',
  'fitting-room__ai-fit',
  'try_on',
  1,
  TIMESTAMPTZ '2026-05-19 00:00:00+00',
  true,
  'AI 试衣-图片分割 aitryon-parsing-v1（输入 0.004 元/张×M）',
  'aitryon-parsing-v1',
  0.004,
  2,
  'aitryon-parsing-v1',
  '',
  'COST_PER_IMAGE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "ToolBillablePrice"
  WHERE "toolKey" = 'fitting-room__ai-fit'
    AND "action" = 'try_on'
    AND "schemeARefModelKey" = 'aitryon-parsing-v1'
    AND COALESCE("cloudTierRaw", '') = ''
);

-- D 表：aitryon-refiner 七档阶梯
INSERT INTO "ToolBillablePrice" ("id","toolKey","action","pricePoints","effectiveFrom","active","note","schemeARefModelKey","schemeAUnitCostYuan","schemeAAdminRetailMultiplier","cloudModelKey","cloudTierRaw","cloudBillingKind","createdAt","updatedAt")
SELECT 'tb_tryon_refiner_t1','fitting-room__ai-fit','try_on',60,TIMESTAMPTZ '2026-05-19 00:00:00+00',true,'AI 试衣精修 生成≤25张','aitryon-refiner',0.30,2,'aitryon-refiner','生成≤25张','OUTPUT_IMAGE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "ToolBillablePrice" WHERE "schemeARefModelKey"='aitryon-refiner' AND "cloudTierRaw"='生成≤25张' AND "active"=true);

INSERT INTO "ToolBillablePrice" ("id","toolKey","action","pricePoints","effectiveFrom","active","note","schemeARefModelKey","schemeAUnitCostYuan","schemeAAdminRetailMultiplier","cloudModelKey","cloudTierRaw","cloudBillingKind","createdAt","updatedAt")
SELECT 'tb_tryon_refiner_t2','fitting-room__ai-fit','try_on',55,TIMESTAMPTZ '2026-05-19 00:00:00+00',true,'AI 试衣精修 25<生成≤125张','aitryon-refiner',0.275,2,'aitryon-refiner','25<生成≤125张','OUTPUT_IMAGE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "ToolBillablePrice" WHERE "schemeARefModelKey"='aitryon-refiner' AND "cloudTierRaw"='25<生成≤125张' AND "active"=true);

INSERT INTO "ToolBillablePrice" ("id","toolKey","action","pricePoints","effectiveFrom","active","note","schemeARefModelKey","schemeAUnitCostYuan","schemeAAdminRetailMultiplier","cloudModelKey","cloudTierRaw","cloudBillingKind","createdAt","updatedAt")
SELECT 'tb_tryon_refiner_t3','fitting-room__ai-fit','try_on',50,TIMESTAMPTZ '2026-05-19 00:00:00+00',true,'AI 试衣精修 125<生成≤250张','aitryon-refiner',0.25,2,'aitryon-refiner','125<生成≤250张','OUTPUT_IMAGE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "ToolBillablePrice" WHERE "schemeARefModelKey"='aitryon-refiner' AND "cloudTierRaw"='125<生成≤250张' AND "active"=true);

INSERT INTO "ToolBillablePrice" ("id","toolKey","action","pricePoints","effectiveFrom","active","note","schemeARefModelKey","schemeAUnitCostYuan","schemeAAdminRetailMultiplier","cloudModelKey","cloudTierRaw","cloudBillingKind","createdAt","updatedAt")
SELECT 'tb_tryon_refiner_t4','fitting-room__ai-fit','try_on',45,TIMESTAMPTZ '2026-05-19 00:00:00+00',true,'AI 试衣精修 250<生成≤1250张','aitryon-refiner',0.225,2,'aitryon-refiner','250<生成≤1250张','OUTPUT_IMAGE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "ToolBillablePrice" WHERE "schemeARefModelKey"='aitryon-refiner' AND "cloudTierRaw"='250<生成≤1250张' AND "active"=true);

INSERT INTO "ToolBillablePrice" ("id","toolKey","action","pricePoints","effectiveFrom","active","note","schemeARefModelKey","schemeAUnitCostYuan","schemeAAdminRetailMultiplier","cloudModelKey","cloudTierRaw","cloudBillingKind","createdAt","updatedAt")
SELECT 'tb_tryon_refiner_t5','fitting-room__ai-fit','try_on',40,TIMESTAMPTZ '2026-05-19 00:00:00+00',true,'AI 试衣精修 1250<生成≤2500张','aitryon-refiner',0.20,2,'aitryon-refiner','1250<生成≤2500张','OUTPUT_IMAGE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "ToolBillablePrice" WHERE "schemeARefModelKey"='aitryon-refiner' AND "cloudTierRaw"='1250<生成≤2500张' AND "active"=true);

INSERT INTO "ToolBillablePrice" ("id","toolKey","action","pricePoints","effectiveFrom","active","note","schemeARefModelKey","schemeAUnitCostYuan","schemeAAdminRetailMultiplier","cloudModelKey","cloudTierRaw","cloudBillingKind","createdAt","updatedAt")
SELECT 'tb_tryon_refiner_t6','fitting-room__ai-fit','try_on',35,TIMESTAMPTZ '2026-05-19 00:00:00+00',true,'AI 试衣精修 2500<生成≤2.5万张','aitryon-refiner',0.175,2,'aitryon-refiner','2500<生成≤2.5万张','OUTPUT_IMAGE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "ToolBillablePrice" WHERE "schemeARefModelKey"='aitryon-refiner' AND "cloudTierRaw"='2500<生成≤2.5万张' AND "active"=true);

INSERT INTO "ToolBillablePrice" ("id","toolKey","action","pricePoints","effectiveFrom","active","note","schemeARefModelKey","schemeAUnitCostYuan","schemeAAdminRetailMultiplier","cloudModelKey","cloudTierRaw","cloudBillingKind","createdAt","updatedAt")
SELECT 'tb_tryon_refiner_t7','fitting-room__ai-fit','try_on',30,TIMESTAMPTZ '2026-05-19 00:00:00+00',true,'AI 试衣精修 >2.5万张','aitryon-refiner',0.15,2,'aitryon-refiner','>2.5万张','OUTPUT_IMAGE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "ToolBillablePrice" WHERE "schemeARefModelKey"='aitryon-refiner' AND "cloudTierRaw"='>2.5万张' AND "active"=true);
