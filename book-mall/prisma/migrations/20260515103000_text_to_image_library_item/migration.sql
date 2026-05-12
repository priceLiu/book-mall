-- CreateTable
CREATE TABLE "TextToImageLibraryItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "prompt" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TextToImageLibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TextToImageLibraryItem_userId_createdAt_idx" ON "TextToImageLibraryItem"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "TextToImageLibraryItem" ADD CONSTRAINT "TextToImageLibraryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
