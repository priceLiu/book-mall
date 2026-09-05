-- 管理后台 · 待开发功能清单
CREATE TABLE IF NOT EXISTS "AdminPendingFeature" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "docPath" TEXT NOT NULL DEFAULT '',
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminPendingFeature_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminPendingFeature_completed_sortOrder_idx"
  ON "AdminPendingFeature"("completed", "sortOrder");

CREATE INDEX IF NOT EXISTS "AdminPendingFeature_sortOrder_idx"
  ON "AdminPendingFeature"("sortOrder");
