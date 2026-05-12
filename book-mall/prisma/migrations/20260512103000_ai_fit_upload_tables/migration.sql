-- AI 试衣：自定义模特与服装上传（图片以 Data URL / base64 存 TEXT）

CREATE TYPE "AiFitGarmentSlot" AS ENUM ('TOP', 'BOTTOM', 'ONE_PIECE');

CREATE TABLE "AiFitCustomModel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "style" TEXT NOT NULL DEFAULT '',
    "height" TEXT NOT NULL DEFAULT '',
    "weight" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "bust" TEXT,
    "waist" TEXT,
    "hips" TEXT,
    "imageDataUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiFitCustomModel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiFitGarmentUpload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slot" "AiFitGarmentSlot" NOT NULL,
    "imageDataUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiFitGarmentUpload_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiFitCustomModel_userId_createdAt_idx" ON "AiFitCustomModel"("userId", "createdAt");

CREATE INDEX "AiFitGarmentUpload_userId_createdAt_idx" ON "AiFitGarmentUpload"("userId", "createdAt");

ALTER TABLE "AiFitCustomModel" ADD CONSTRAINT "AiFitCustomModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiFitGarmentUpload" ADD CONSTRAINT "AiFitGarmentUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
