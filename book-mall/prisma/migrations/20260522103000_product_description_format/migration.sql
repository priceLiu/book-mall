-- CreateEnum
CREATE TYPE "ProductDescriptionFormat" AS ENUM ('PLAIN', 'MARKDOWN');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "descriptionFormat" "ProductDescriptionFormat" NOT NULL DEFAULT 'PLAIN';
