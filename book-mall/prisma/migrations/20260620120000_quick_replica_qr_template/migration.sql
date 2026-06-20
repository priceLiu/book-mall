-- QuickReplica 用户模板表

CREATE TABLE "QrTemplate" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "category" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "toolKey" TEXT,
    "title" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "badges" JSONB,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "reference" JSONB NOT NULL,
    "output" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "gatewayRequestLogId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QrTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QrTemplate_gatewayRequestLogId_key" ON "QrTemplate"("gatewayRequestLogId");
CREATE INDEX "QrTemplate_ownerUserId_category_kind_deletedAt_idx" ON "QrTemplate"("ownerUserId", "category", "kind", "deletedAt");

ALTER TABLE "QrTemplate" ADD CONSTRAINT "QrTemplate_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
