-- ModelCreditPrice：与现网一致，唯一键为 (canonicalModelKey, tierRaw)

UPDATE "ModelCreditPrice" SET "tierRaw" = '' WHERE "tierRaw" IS NULL;

ALTER TABLE "ModelCreditPrice"
  ALTER COLUMN "tierRaw" SET DEFAULT '',
  ALTER COLUMN "tierRaw" SET NOT NULL;

DROP INDEX IF EXISTS "ModelCreditPrice_canonicalModelKey_key";

CREATE UNIQUE INDEX IF NOT EXISTS "ModelCreditPrice_canonicalModelKey_tierRaw_key"
  ON "ModelCreditPrice"("canonicalModelKey", "tierRaw");
