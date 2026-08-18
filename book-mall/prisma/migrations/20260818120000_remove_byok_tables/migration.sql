-- BYOK 产品退役：存量用户归平台代付，删除 BYOK 配置/订阅/资源计量表

UPDATE "User"
SET "billingPersona" = 'PLATFORM_CREDIT'
WHERE "billingPersona" = 'BYOK';

UPDATE "User"
SET "ecomBillingMode" = 'PLATFORM_METERED'
WHERE "ecomBillingMode" = 'BYOK_SERVICE_FEE';

DROP TABLE IF EXISTS "ByokUsageMonthly";
DROP TABLE IF EXISTS "ByokSubscription";
DROP TABLE IF EXISTS "ByokTaskQuota";
DROP TABLE IF EXISTS "ByokServiceConfig";
DROP TABLE IF EXISTS "ResourceMeterEvent";
DROP TABLE IF EXISTS "ResourceMeterRate";

DROP TYPE IF EXISTS "ByokSubscriptionStatus";
