-- 成本价目：版本 + 明细行 + 变更事件（主站为唯一源，tool-web catalog 由脚本自 DB 生成）
CREATE TYPE "PricingBillingKind" AS ENUM ('TOKEN_IN_OUT', 'OUTPUT_IMAGE', 'COST_PER_IMAGE', 'VIDEO_MODEL_SPEC');

CREATE TABLE "PricingSourceVersion" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "regionScope" TEXT NOT NULL DEFAULT 'china_mainland',
    "label" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedByUserId" TEXT,
    "parseWarnings" JSONB,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PricingSourceVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PricingSourceVersion_isCurrent_idx" ON "PricingSourceVersion"("isCurrent");
CREATE INDEX "PricingSourceVersion_importedAt_idx" ON "PricingSourceVersion"("importedAt");

CREATE TABLE "PricingSourceLine" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sectionH2" TEXT NOT NULL DEFAULT '',
    "sectionH3" TEXT NOT NULL DEFAULT '',
    "modelKey" TEXT NOT NULL,
    "modelLabelRaw" TEXT NOT NULL,
    "tierRaw" TEXT NOT NULL DEFAULT '',
    "billingKind" "PricingBillingKind" NOT NULL DEFAULT 'TOKEN_IN_OUT',
    "inputYuanPerMillion" DOUBLE PRECISION,
    "outputYuanPerMillion" DOUBLE PRECISION,
    "costJson" JSONB,
    "fingerprint" TEXT NOT NULL,
    "sourceLine" INTEGER,

    CONSTRAINT "PricingSourceLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PricingSourceLine_versionId_fingerprint_key" ON "PricingSourceLine"("versionId", "fingerprint");
CREATE INDEX "PricingSourceLine_versionId_modelKey_idx" ON "PricingSourceLine"("versionId", "modelKey");

ALTER TABLE "PricingSourceLine" ADD CONSTRAINT "PricingSourceLine_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "PricingSourceVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PricingLineChangeEvent" (
    "id" TEXT NOT NULL,
    "fromVersionId" TEXT,
    "toVersionId" TEXT NOT NULL,
    "modelKey" TEXT NOT NULL,
    "tierRaw" TEXT NOT NULL DEFAULT '',
    "billingKind" "PricingBillingKind" NOT NULL,
    "changeType" TEXT NOT NULL,
    "oldSnapshot" JSONB,
    "newSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingLineChangeEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PricingLineChangeEvent_toVersionId_idx" ON "PricingLineChangeEvent"("toVersionId");
CREATE INDEX "PricingLineChangeEvent_modelKey_idx" ON "PricingLineChangeEvent"("modelKey");

ALTER TABLE "PricingLineChangeEvent" ADD CONSTRAINT "PricingLineChangeEvent_fromVersionId_fkey" FOREIGN KEY ("fromVersionId") REFERENCES "PricingSourceVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PricingLineChangeEvent" ADD CONSTRAINT "PricingLineChangeEvent_toVersionId_fkey" FOREIGN KEY ("toVersionId") REFERENCES "PricingSourceVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
