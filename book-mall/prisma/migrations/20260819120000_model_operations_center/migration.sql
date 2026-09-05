-- Model Operations Center: sourceLabel on ModelCatalog + AppModelShelf

CREATE TYPE "AppModelShelfStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'DEPRECATED');

ALTER TABLE "ModelCatalog" ADD COLUMN IF NOT EXISTS "sourceLabel" TEXT;

CREATE TABLE IF NOT EXISTS "AppModelShelf" (
    "id" TEXT NOT NULL,
    "appTag" TEXT NOT NULL,
    "sceneKey" TEXT NOT NULL DEFAULT '',
    "canonicalModelKey" TEXT NOT NULL,
    "status" "AppModelShelfStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "displayNameOverride" TEXT,
    "sourceLabelOverride" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppModelShelf_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AppModelShelf_appTag_sceneKey_canonicalModelKey_key"
    ON "AppModelShelf"("appTag", "sceneKey", "canonicalModelKey");

CREATE INDEX IF NOT EXISTS "AppModelShelf_appTag_sceneKey_status_idx"
    ON "AppModelShelf"("appTag", "sceneKey", "status");

CREATE INDEX IF NOT EXISTS "AppModelShelf_canonicalModelKey_idx"
    ON "AppModelShelf"("canonicalModelKey");
