-- Gateway 统一模型注册表

-- CreateEnum
CREATE TYPE "ModelMediaKind" AS ENUM ('TEXT_TO_IMAGE', 'IMAGE_TO_VIDEO', 'VIDEO_TO_VIDEO', 'TEXT_LLM');

-- AlterTable ModelCatalog
ALTER TABLE "ModelCatalog" ADD COLUMN "requestKind" "GatewayRequestKind",
ADD COLUMN "role" "CanvasModelRole",
ADD COLUMN "mediaKind" "ModelMediaKind",
ADD COLUMN "appTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "gatewayPublished" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ModelCatalog_gatewayPublished_active_idx" ON "ModelCatalog"("gatewayPublished", "active");

-- CreateTable GatewayModelRoute
CREATE TABLE "GatewayModelRoute" (
    "id" TEXT NOT NULL,
    "canonicalModelKey" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "modelKey" TEXT NOT NULL,
    "providerKind" "GatewayProviderKind" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GatewayModelRoute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GatewayModelRoute_canonicalModelKey_vendor_modelKey_key" ON "GatewayModelRoute"("canonicalModelKey", "vendor", "modelKey");
CREATE INDEX "GatewayModelRoute_modelKey_active_idx" ON "GatewayModelRoute"("modelKey", "active");
CREATE INDEX "GatewayModelRoute_canonicalModelKey_active_idx" ON "GatewayModelRoute"("canonicalModelKey", "active");

ALTER TABLE "GatewayModelRoute" ADD CONSTRAINT "GatewayModelRoute_canonicalModelKey_fkey" FOREIGN KEY ("canonicalModelKey") REFERENCES "ModelCatalog"("canonicalKey") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable PlatformMediaDefault
CREATE TABLE "PlatformMediaDefault" (
    "mediaKind" "ModelMediaKind" NOT NULL,
    "defaultCanonicalKey" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformMediaDefault_pkey" PRIMARY KEY ("mediaKind")
);

-- AppModelOffering: migrate to canonicalModelKey unique
ALTER TABLE "AppModelOffering" ADD COLUMN "canonicalModelKey" TEXT;
ALTER TABLE "AppModelOffering" ADD COLUMN "activeVendor" TEXT;

UPDATE "AppModelOffering"
SET "canonicalModelKey" = COALESCE("activeCanonicalKey", "appKey" || ':' || "scenarioKey")
WHERE "canonicalModelKey" IS NULL;

DELETE FROM "AppModelOffering" WHERE "canonicalModelKey" IS NULL;

-- 旧 platform + ecom 可能对同一 activeCanonicalKey 有多行：保留 platform 优先，其余删除
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "canonicalModelKey"
      ORDER BY
        CASE WHEN "appKey" = 'platform' THEN 0 WHEN "appKey" = 'ecom' THEN 1 ELSE 2 END,
        "updatedAt" DESC
    ) AS rn
  FROM "AppModelOffering"
  WHERE "canonicalModelKey" IS NOT NULL
)
DELETE FROM "AppModelCandidate"
WHERE "offeringId" IN (SELECT id FROM ranked WHERE rn > 1);

DELETE FROM "AppModelOffering"
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY "canonicalModelKey"
        ORDER BY
          CASE WHEN "appKey" = 'platform' THEN 0 WHEN "appKey" = 'ecom' THEN 1 ELSE 2 END,
          "updatedAt" DESC
      ) AS rn
    FROM "AppModelOffering"
    WHERE "canonicalModelKey" IS NOT NULL
  ) sub
  WHERE rn > 1
);

ALTER TABLE "AppModelOffering" ALTER COLUMN "canonicalModelKey" SET NOT NULL;

DROP INDEX IF EXISTS "AppModelOffering_appKey_scenarioKey_key";
ALTER TABLE "AppModelOffering" DROP COLUMN IF EXISTS "appKey";
ALTER TABLE "AppModelOffering" DROP COLUMN IF EXISTS "scenarioKey";

CREATE UNIQUE INDEX "AppModelOffering_canonicalModelKey_key" ON "AppModelOffering"("canonicalModelKey");

DROP INDEX IF EXISTS "AppModelOffering_appKey_role_status_idx";
CREATE INDEX "AppModelOffering_role_status_idx" ON "AppModelOffering"("role", "status");
