-- Pro2 platform prompt templates (docs/画布管理中心.md)

CREATE TYPE "Pro2PromptTemplateRegistry" AS ENUM ('SCRIPT', 'ASSET');

CREATE TYPE "Pro2PromptTemplatePassKind" AS ENUM (
  'OUTLINE',
  'CHARACTER',
  'SCENE',
  'STORYBOARD',
  'CHARACTER_FOUR_VIEW',
  'SCENE_FOUR_PANORAMA',
  'PROP_SIX_VIEW'
);

CREATE TABLE "Pro2PromptTemplate" (
  "id" TEXT NOT NULL,
  "registry" "Pro2PromptTemplateRegistry" NOT NULL,
  "passKind" "Pro2PromptTemplatePassKind" NOT NULL,
  "templateKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "version" TEXT NOT NULL DEFAULT '1',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "blocks" JSONB NOT NULL DEFAULT '[]',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Pro2PromptTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Pro2PromptTemplate_templateKey_key" ON "Pro2PromptTemplate"("templateKey");
CREATE INDEX "Pro2PromptTemplate_registry_passKind_enabled_idx" ON "Pro2PromptTemplate"("registry", "passKind", "enabled");
CREATE INDEX "Pro2PromptTemplate_deletedAt_idx" ON "Pro2PromptTemplate"("deletedAt");

CREATE TABLE "Pro2TemplatePack" (
  "id" TEXT NOT NULL,
  "packKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "categoryDocTitle" TEXT,
  "categoryDocBody" TEXT,
  "outlineTemplateId" TEXT NOT NULL,
  "characterTemplateId" TEXT NOT NULL,
  "sceneTemplateId" TEXT NOT NULL,
  "storyboardTemplateId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Pro2TemplatePack_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Pro2TemplatePack_packKey_key" ON "Pro2TemplatePack"("packKey");
CREATE INDEX "Pro2TemplatePack_enabled_idx" ON "Pro2TemplatePack"("enabled");
CREATE INDEX "Pro2TemplatePack_deletedAt_idx" ON "Pro2TemplatePack"("deletedAt");

ALTER TABLE "Pro2TemplatePack" ADD CONSTRAINT "Pro2TemplatePack_outlineTemplateId_fkey" FOREIGN KEY ("outlineTemplateId") REFERENCES "Pro2PromptTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pro2TemplatePack" ADD CONSTRAINT "Pro2TemplatePack_characterTemplateId_fkey" FOREIGN KEY ("characterTemplateId") REFERENCES "Pro2PromptTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pro2TemplatePack" ADD CONSTRAINT "Pro2TemplatePack_sceneTemplateId_fkey" FOREIGN KEY ("sceneTemplateId") REFERENCES "Pro2PromptTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pro2TemplatePack" ADD CONSTRAINT "Pro2TemplatePack_storyboardTemplateId_fkey" FOREIGN KEY ("storyboardTemplateId") REFERENCES "Pro2PromptTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
