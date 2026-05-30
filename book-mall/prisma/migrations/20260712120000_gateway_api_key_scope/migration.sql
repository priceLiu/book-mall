-- Gateway sk-gw 区分全站管理员密钥与个人密钥

CREATE TYPE "GatewayApiKeyScope" AS ENUM ('PLATFORM', 'PERSONAL');

ALTER TABLE "GatewayApiKey" ADD COLUMN "scope" "GatewayApiKeyScope" NOT NULL DEFAULT 'PERSONAL';

-- 历史「Canvas Pilot / 全站 Gateway」→ Platform Admin
UPDATE "GatewayApiKey"
SET "name" = 'Platform Admin', "scope" = 'PLATFORM'
WHERE "name" IN ('Canvas Pilot', '全站 Gateway');
