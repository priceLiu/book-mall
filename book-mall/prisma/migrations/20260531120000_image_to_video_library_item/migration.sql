CREATE TABLE "ImageToVideoLibraryItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "prompt" TEXT,
    "mode" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "seed" TEXT,
    "modelLabel" TEXT,
    "retainUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageToVideoLibraryItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImageToVideoLibraryItem_userId_createdAt_idx" ON "ImageToVideoLibraryItem"("userId", "createdAt");

CREATE INDEX "ImageToVideoLibraryItem_retainUntil_idx" ON "ImageToVideoLibraryItem"("retainUntil");

ALTER TABLE "ImageToVideoLibraryItem" ADD CONSTRAINT "ImageToVideoLibraryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
