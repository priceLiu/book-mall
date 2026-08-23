-- Share code 3.0: prefix registry + workflow shortCode

CREATE TABLE "ShareCodePrefix" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "kind" "ShareRewardChannel" NOT NULL,
    "app" "WorkflowShareApp",
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareCodePrefix_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShareCodePrefix_prefix_key" ON "ShareCodePrefix"("prefix");
CREATE INDEX "ShareCodePrefix_kind_enabled_idx" ON "ShareCodePrefix"("kind", "enabled");

ALTER TABLE "WorkflowShareLink" ADD COLUMN "shortCode" TEXT;

CREATE UNIQUE INDEX "WorkflowShareLink_shortCode_key" ON "WorkflowShareLink"("shortCode");

INSERT INTO "ShareCodePrefix" ("id", "prefix", "kind", "app", "enabled", "note", "createdAt", "updatedAt")
VALUES
  ('share_prefix_referral_rk', 'RK', 'REFERRAL', NULL, true, '邀请注册默认前缀', NOW(), NOW()),
  ('share_prefix_workflow_canvas', 'CVAS', 'WORKFLOW', 'CANVAS', true, '画布工作流', NOW(), NOW()),
  ('share_prefix_workflow_ecom', 'ECOM', 'WORKFLOW', 'ECOM', true, '电商分镜工作流', NOW(), NOW()),
  ('share_prefix_workflow_qrep', 'QREP', 'WORKFLOW', 'QUICK_REPLICA', true, '快速复刻工作流', NOW(), NOW())
ON CONFLICT ("prefix") DO NOTHING;
