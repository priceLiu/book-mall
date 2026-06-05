-- e-commerce-toolkit M5: storyboard projects + pricing seed

CREATE TABLE "EcomStoryboardProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "module" TEXT NOT NULL DEFAULT 'storyboard-micro-drama',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "brief" JSONB,
    "settings" JSONB,
    "references" JSONB,
    "chatHistory" JSONB,
    "sheet" JSONB,
    "sheetPngUrl" TEXT,
    "sheetHtmlUrl" TEXT,
    "videoAssetId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcomStoryboardProject_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EcomStoryboardProject_userId_module_updatedAt_idx" ON "EcomStoryboardProject"("userId", "module", "updatedAt");

ALTER TABLE "EcomStoryboardProject" ADD CONSTRAINT "EcomStoryboardProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ToolBillablePrice" (
  "id", "toolKey", "action", "schemeARefModelKey", "cloudTierRaw", "cloudBillingKind",
  "schemeAUnitCostYuan", "schemeAAdminRetailMultiplier", "pricePoints", "effectiveFrom", "active", "createdAt", "updatedAt"
)
VALUES
  ('tbp_ecom_storyboard_chat', 'ecom-toolkit__storyboard', 'chat', 'deepseek-v4-flash', '无阶梯计价', 'TOKEN_IN_OUT', 0.20, 2, 40, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tbp_ecom_storyboard_video', 'ecom-toolkit__storyboard', 'video', 'doubao-seedance-2.0', '1080P', 'VIDEO_MODEL_SPEC', 0.9, 2, 180, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
