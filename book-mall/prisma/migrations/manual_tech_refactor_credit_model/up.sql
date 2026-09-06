-- ============================================================
-- 计费与模型管理技术改造 · 手动 DDL（已剔除历史漂移）
-- 说明：
--   1) 新增字段全部可空或带默认值，不影响现有数据
--   2) 积分字段 Int→Decimal(18,2) 为无损转换
--   3) 大表（GatewayRequestLog/Archive、CreditLedger、CreditLot）ALTER 会锁表，建议低峰执行
-- ============================================================

-- 1. 新增枚举
CREATE TYPE "ModelType" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'MULTIMODAL');
CREATE TYPE "GatewayApiKeyType" AS ENUM ('USER', 'PLATFORM_ONLY');

-- 2. 新建厂商表
CREATE TABLE "PlatformVendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerKind" "GatewayProviderKind" NOT NULL,
    "baseUrl" TEXT,
    "apiKeyEncrypted" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformVendor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformVendor_name_key" ON "PlatformVendor"("name");
CREATE INDEX "PlatformVendor_providerKind_active_idx" ON "PlatformVendor"("providerKind", "active");

-- 3. 积分字段 Int → Decimal(18,2)（无损，值不变）
ALTER TABLE "CreditAccount"
    ALTER COLUMN "balanceCredits" SET DEFAULT 0,
    ALTER COLUMN "balanceCredits" SET DATA TYPE DECIMAL(18,2),
    ALTER COLUMN "monthlyGrantCredits" SET DEFAULT 0,
    ALTER COLUMN "monthlyGrantCredits" SET DATA TYPE DECIMAL(18,2),
    ALTER COLUMN "perSeatCapCredits" SET DATA TYPE DECIMAL(18,2),
    ALTER COLUMN "reservedCredits" SET DEFAULT 0,
    ALTER COLUMN "reservedCredits" SET DATA TYPE DECIMAL(18,2);

ALTER TABLE "CreditLedger"
    ALTER COLUMN "credits" SET DATA TYPE DECIMAL(18,2),
    ALTER COLUMN "balanceAfter" SET DATA TYPE DECIMAL(18,2);

ALTER TABLE "CreditLot"
    ALTER COLUMN "originalCredits" SET DATA TYPE DECIMAL(18,2),
    ALTER COLUMN "remainingCredits" SET DATA TYPE DECIMAL(18,2);

-- 大表（锁表较久，低峰执行）
ALTER TABLE "GatewayRequestLog" ALTER COLUMN "creditsCharged" SET DATA TYPE DECIMAL(18,2);
ALTER TABLE "GatewayRequestLogArchive" ALTER COLUMN "creditsCharged" SET DATA TYPE DECIMAL(18,2);

ALTER TABLE "MembershipPlan" ALTER COLUMN "monthlyCredits" SET DATA TYPE DECIMAL(18,2);
ALTER TABLE "TeamSeatTier" ALTER COLUMN "perSeatCredits" SET DATA TYPE DECIMAL(18,2);

ALTER TABLE "ModelCreditPrice"
    ALTER COLUMN "creditsPerUnit" SET DATA TYPE DECIMAL(18,2),
    ALTER COLUMN "inputCreditsPerKToken" SET DATA TYPE DECIMAL(18,2),
    ALTER COLUMN "outputCreditsPerKToken" SET DATA TYPE DECIMAL(18,2);

ALTER TABLE "AppModelOffering" ALTER COLUMN "publishedCreditsPerUnit" SET DATA TYPE DECIMAL(18,2);

ALTER TABLE "BillingSettlementLine"
    ALTER COLUMN "creditsCharged" SET DEFAULT 0,
    ALTER COLUMN "creditsCharged" SET DATA TYPE DECIMAL(18,2);

-- 4. 新增字段
ALTER TABLE "GatewayApiKey" ADD COLUMN "keyType" "GatewayApiKeyType" NOT NULL DEFAULT 'USER';

ALTER TABLE "ModelCatalog"
    ADD COLUMN "defaultStreaming" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "defaultTemperature" DECIMAL(5,2),
    ADD COLUMN "defaultTopP" DECIMAL(5,3),
    ADD COLUMN "maxTokens" INTEGER,
    ADD COLUMN "modelType" "ModelType" NOT NULL DEFAULT 'TEXT',
    ADD COLUMN "rpm" INTEGER,
    ADD COLUMN "supportsStreaming" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "supportsThinking" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "temperature" DECIMAL(5,2),
    ADD COLUMN "topP" DECIMAL(5,3),
    ADD COLUMN "tpm" INTEGER,
    ADD COLUMN "vendorId" TEXT;

ALTER TABLE "ModelCostProfile"
    ADD COLUMN "cachedListCostYuan" DECIMAL(16,8),
    ADD COLUMN "durationBucket" TEXT,
    ADD COLUMN "durationCostYuan" DECIMAL(16,8),
    ADD COLUMN "marginM" DECIMAL(6,3) NOT NULL DEFAULT 1.0,
    ADD COLUMN "size" TEXT,
    ADD COLUMN "sizeCostYuan" DECIMAL(16,8),
    ADD COLUMN "vendorId" TEXT;

ALTER TABLE "PlatformPricingConfig"
    ADD COLUMN "minChargeCredits" DECIMAL(18,2) NOT NULL DEFAULT 0.01,
    ALTER COLUMN "welcomeGiftGeneralCredits" SET DEFAULT 600,
    ALTER COLUMN "welcomeGiftGeneralCredits" SET DATA TYPE DECIMAL(18,2),
    ALTER COLUMN "referralRewardCredits" SET DEFAULT 20,
    ALTER COLUMN "referralRewardCredits" SET DATA TYPE DECIMAL(18,2),
    ALTER COLUMN "workflowShareRewardCredits" SET DEFAULT 40,
    ALTER COLUMN "workflowShareRewardCredits" SET DATA TYPE DECIMAL(18,2);

-- 5. 模型 → 厂商 外键
ALTER TABLE "ModelCatalog" ADD CONSTRAINT "ModelCatalog_vendorId_fkey"
    FOREIGN KEY ("vendorId") REFERENCES "PlatformVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. 积分兑换率：默认值 0.04→0.03（现有记录手动更新，仅此一条）
UPDATE "PlatformPricingConfig" SET "creditAnchorYuan" = 0.03 WHERE id = 'default';
