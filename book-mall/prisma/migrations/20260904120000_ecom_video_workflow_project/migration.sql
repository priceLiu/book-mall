-- CreateTable
CREATE TABLE IF NOT EXISTS "EcomVideoWorkflowProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "module" TEXT NOT NULL DEFAULT 'video-outfit',
    "templateId" TEXT NOT NULL DEFAULT 'outfit-v1',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "phase" TEXT NOT NULL DEFAULT 'upload',
    "settings" JSONB,
    "references" JSONB,
    "structured" JSONB,
    "sceneList" JSONB,
    "composeResult" JSONB,
    "meta" JSONB,
    "tenantId" TEXT,
    "ownerUserId" TEXT,
    "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcomVideoWorkflowProject_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EcomVideoWorkflowProject_userId_module_updatedAt_idx"
  ON "EcomVideoWorkflowProject"("userId", "module", "updatedAt");

CREATE INDEX IF NOT EXISTS "EcomVideoWorkflowProject_userId_templateId_updatedAt_idx"
  ON "EcomVideoWorkflowProject"("userId", "templateId", "updatedAt");

CREATE INDEX IF NOT EXISTS "EcomVideoWorkflowProject_tenantId_visibility_updatedAt_idx"
  ON "EcomVideoWorkflowProject"("tenantId", "visibility", "updatedAt");

ALTER TABLE "EcomVideoWorkflowProject" DROP CONSTRAINT IF EXISTS "EcomVideoWorkflowProject_userId_fkey";
ALTER TABLE "EcomVideoWorkflowProject" ADD CONSTRAINT "EcomVideoWorkflowProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
