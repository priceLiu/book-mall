-- e-commerce-toolkit: billing mode, assets, gateway source, nav + pricing seed

CREATE TYPE "EcomBillingMode" AS ENUM ('BYOK_SERVICE_FEE', 'PLATFORM_METERED');

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ecomBillingMode" "EcomBillingMode" NOT NULL DEFAULT 'BYOK_SERVICE_FEE';

ALTER TYPE "GatewayClientSource" ADD VALUE IF NOT EXISTS 'E_COMMERCE';

CREATE TABLE "EcomAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT,
    "prompt" TEXT,
    "ossUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcomAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EcomAsset_userId_module_createdAt_idx" ON "EcomAsset"("userId", "module", "createdAt");

ALTER TABLE "EcomAsset" ADD CONSTRAINT "EcomAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ToolServiceFeePlan" ("id", "toolNavKey", "label", "monthlyFeePoints", "active", "sortOrder", "note", "updatedAt")
VALUES (
  'tsfp_ecommerce_toolkit',
  'e-commerce-toolkit',
  '电商工具箱',
  4000,
  true,
  45,
  '首期月费（6b BYOK）',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("toolNavKey") DO NOTHING;

INSERT INTO "ToolBillablePrice" (
  "id", "toolKey", "action", "schemeARefModelKey", "cloudTierRaw", "cloudBillingKind",
  "schemeAUnitCostYuan", "schemeAAdminRetailMultiplier", "pricePoints", "effectiveFrom", "active", "createdAt", "updatedAt"
)
VALUES
  ('tbp_ecom_main_img', 'ecom-toolkit__main-image', 'generate', 'seedream-4.5', '', 'OUTPUT_IMAGE', 0.25, 2, 50, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tbp_ecom_detail_panel', 'ecom-toolkit__detail-page', 'panel', 'nano-banana-pro', '', 'OUTPUT_IMAGE', 0.30, 2, 60, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tbp_ecom_poster', 'ecom-toolkit__poster', 'generate', 'flux-2-pro', '', 'OUTPUT_IMAGE', 0.20, 2, 40, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tbp_ecom_ip', 'ecom-toolkit__ip', 'character', 'gpt-image-2', '', 'OUTPUT_IMAGE', 0.35, 2, 70, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tbp_ecom_vi', 'ecom-toolkit__vi', 'emoji-pack', 'seedream-4.5', '', 'OUTPUT_IMAGE', 2.00, 2, 400, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tbp_ecom_video_motion', 'ecom-toolkit__video', 'motion', 'doubao-seedance-1.5-pro', '1080P', 'VIDEO_MODEL_SPEC', 0.9, 2, 180, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tbp_ecom_video_outfit', 'ecom-toolkit__video', 'outfit', 'wan/2-7-image-to-video', '1080P', 'VIDEO_MODEL_SPEC', 0.6, 2, 120, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tbp_ecom_detail_copy', 'ecom-toolkit__detail-page', 'copy', 'qwen3-max', '无阶梯计价', 'TOKEN_IN_OUT', 0.20, 2, 40, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tbp_ecom_promo_script', 'ecom-toolkit__promo', 'script', 'qwen3-max', '无阶梯计价', 'TOKEN_IN_OUT', 0.20, 2, 40, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
