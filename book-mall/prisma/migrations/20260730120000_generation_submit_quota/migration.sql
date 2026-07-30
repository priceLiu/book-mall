-- Gateway 新生成请求 10s burst 限流：User/Tenant 配置 + GenerationTrafficState stamp

CREATE TYPE "GenerationSubmitTier" AS ENUM ('STANDARD', 'ELEVATED', 'HEAVY');

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "generationSubmitTier" "GenerationSubmitTier",
  ADD COLUMN IF NOT EXISTS "generationSubmitBurstOverride" INTEGER;

ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "generationSubmitTier" "GenerationSubmitTier",
  ADD COLUMN IF NOT EXISTS "generationSubmitBurstOverride" INTEGER;

ALTER TABLE "GenerationTrafficState"
  ADD COLUMN IF NOT EXISTS "submitBurstLimit" INTEGER,
  ADD COLUMN IF NOT EXISTS "submitTier" "GenerationSubmitTier",
  ADD COLUMN IF NOT EXISTS "submitWindowSec" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "submitCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "submitWindowStartAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "quotaConfigVersion" INTEGER NOT NULL DEFAULT 0;
