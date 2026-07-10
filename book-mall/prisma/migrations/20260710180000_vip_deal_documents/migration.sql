-- VIP 大额预充 · 合同 / 凭证 / 发票附件
CREATE TYPE "VipDealDocumentKind" AS ENUM ('CONTRACT', 'PAYMENT_PROOF', 'INVOICE', 'OTHER');

CREATE TABLE "VipDealDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "ownerUserId" TEXT,
    "kind" "VipDealDocumentKind" NOT NULL,
    "ossUrl" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "note" TEXT,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VipDealDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VipDealDocument_tenantId_createdAt_idx" ON "VipDealDocument"("tenantId", "createdAt");
CREATE INDEX "VipDealDocument_ownerUserId_createdAt_idx" ON "VipDealDocument"("ownerUserId", "createdAt");
