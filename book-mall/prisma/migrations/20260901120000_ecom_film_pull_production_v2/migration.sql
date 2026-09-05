-- AlterTable
ALTER TABLE "EcomFilmPullProject" ADD COLUMN IF NOT EXISTS "refMatch" JSONB;
ALTER TABLE "EcomFilmPullProject" ADD COLUMN IF NOT EXISTS "productionPlan" JSONB;
