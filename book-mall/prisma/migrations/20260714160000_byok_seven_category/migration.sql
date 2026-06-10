-- BYOK 七类计费：TRYON 合并进 TEXT_TO_IMAGE，新增 VIDEO_UNDERSTANDING / TTS

-- 1) 合并 TRYON 月度用量到 TEXT_TO_IMAGE
UPDATE "ByokUsageMonthly" AS t
SET
  "includedUsed" = t."includedUsed" + s."includedUsed",
  "overageUsed" = t."overageUsed" + s."overageUsed",
  "overageCredits" = t."overageCredits" + s."overageCredits",
  "updatedAt" = NOW()
FROM "ByokUsageMonthly" AS s
WHERE s."taskKind" = 'TRYON'
  AND t."taskKind" = 'TEXT_TO_IMAGE'
  AND t."ownerType" = s."ownerType"
  AND t."ownerId" = s."ownerId"
  AND t."periodKey" = s."periodKey";

DELETE FROM "ByokUsageMonthly" AS s
WHERE s."taskKind" = 'TRYON'
  AND EXISTS (
    SELECT 1
    FROM "ByokUsageMonthly" AS t
    WHERE t."taskKind" = 'TEXT_TO_IMAGE'
      AND t."ownerType" = s."ownerType"
      AND t."ownerId" = s."ownerId"
      AND t."periodKey" = s."periodKey"
  );

UPDATE "ByokUsageMonthly"
SET "taskKind" = 'TEXT_TO_IMAGE', "updatedAt" = NOW()
WHERE "taskKind" = 'TRYON';

UPDATE "BillingSettlementLine"
SET "byokTaskKind" = 'TEXT_TO_IMAGE'
WHERE "byokTaskKind" = 'TRYON';

UPDATE "GatewayRequestLog"
SET "byokTaskKind" = 'TEXT_TO_IMAGE'
WHERE "byokTaskKind" = 'TRYON';

DELETE FROM "ByokTaskQuota" WHERE "taskKind" = 'TRYON';

UPDATE "ByokTaskQuota"
SET
  "label" = '文生图（含试衣）',
  "monthlyIncluded" = 130,
  "overageCredits" = 20,
  "active" = true,
  "updatedAt" = NOW()
WHERE "scopeKey" = 'personal' AND "taskKind" = 'TEXT_TO_IMAGE';

UPDATE "ByokTaskQuota"
SET
  "label" = '文生图（含试衣）',
  "monthlyIncluded" = 100,
  "overageCredits" = 20,
  "active" = true,
  "updatedAt" = NOW()
WHERE "scopeKey" = 'team-seat' AND "taskKind" = 'TEXT_TO_IMAGE';

-- 2) 重建枚举（避免 ADD VALUE 同事务不可用问题）
CREATE TYPE "ByokTaskKind_new" AS ENUM (
  'TEXT_TO_IMAGE',
  'IMAGE_TO_VIDEO',
  'VIDEO_TO_VIDEO',
  'VIDEO_UNDERSTANDING',
  'TTS'
);

ALTER TABLE "ByokTaskQuota"
  ALTER COLUMN "taskKind" TYPE "ByokTaskKind_new"
  USING ("taskKind"::text::"ByokTaskKind_new");

ALTER TABLE "ByokUsageMonthly"
  ALTER COLUMN "taskKind" TYPE "ByokTaskKind_new"
  USING ("taskKind"::text::"ByokTaskKind_new");

ALTER TABLE "BillingSettlementLine"
  ALTER COLUMN "byokTaskKind" TYPE "ByokTaskKind_new"
  USING (
    CASE
      WHEN "byokTaskKind" IS NULL THEN NULL
      ELSE "byokTaskKind"::text::"ByokTaskKind_new"
    END
  );

ALTER TABLE "GatewayRequestLog"
  ALTER COLUMN "byokTaskKind" TYPE "ByokTaskKind_new"
  USING (
    CASE
      WHEN "byokTaskKind" IS NULL THEN NULL
      ELSE "byokTaskKind"::text::"ByokTaskKind_new"
    END
  );

DROP TYPE "ByokTaskKind";
ALTER TYPE "ByokTaskKind_new" RENAME TO "ByokTaskKind";

-- 3) 新增两类套餐额度
INSERT INTO "ByokTaskQuota" ("id", "scopeKey", "taskKind", "label", "monthlyIncluded", "overageCredits", "active", "updatedAt")
VALUES
  ('byok_quota_personal_video_understanding', 'personal', 'VIDEO_UNDERSTANDING', '视频理解', 30, 15, true, NOW()),
  ('byok_quota_team_video_understanding', 'team-seat', 'VIDEO_UNDERSTANDING', '视频理解', 24, 15, true, NOW()),
  ('byok_quota_personal_tts', 'personal', 'TTS', 'TTS / 语音', 40, 12, true, NOW()),
  ('byok_quota_team_tts', 'team-seat', 'TTS', 'TTS / 语音', 32, 12, true, NOW())
ON CONFLICT ("scopeKey", "taskKind") DO UPDATE SET
  "label" = EXCLUDED."label",
  "monthlyIncluded" = EXCLUDED."monthlyIncluded",
  "overageCredits" = EXCLUDED."overageCredits",
  "active" = true,
  "updatedAt" = NOW();
