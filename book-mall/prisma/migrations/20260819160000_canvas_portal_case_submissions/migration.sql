-- 门户案例墙 + 用户提交审核
ALTER TABLE "CanvasProject" ADD COLUMN IF NOT EXISTS "portalCase" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CanvasProject" ADD COLUMN IF NOT EXISTS "portalCaseSort" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CanvasProject" ADD COLUMN IF NOT EXISTS "portalCaseBlurb" TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "CanvasProject_portalCase_portalCaseSort_idx"
  ON "CanvasProject" ("portalCase", "portalCaseSort");

CREATE TYPE "CanvasPortalPublishKind" AS ENUM ('CASE', 'FEATURED', 'TEMPLATE', 'PUBLIC_TEMPLATE');
CREATE TYPE "CanvasPortalSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE IF NOT EXISTS "CanvasPortalSubmission" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "CanvasPortalSubmissionStatus" NOT NULL DEFAULT 'PENDING',
  "requestKind" "CanvasPortalPublishKind" NOT NULL,
  "userNote" TEXT NOT NULL DEFAULT '',
  "adminNote" TEXT NOT NULL DEFAULT '',
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "approvedKind" "CanvasPortalPublishKind",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CanvasPortalSubmission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CanvasPortalSubmission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CanvasProject"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CanvasPortalSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CanvasPortalSubmission_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CanvasPortalSubmission_status_createdAt_idx"
  ON "CanvasPortalSubmission" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CanvasPortalSubmission_projectId_idx"
  ON "CanvasPortalSubmission" ("projectId");
