-- CreateTable
CREATE TABLE "CanvasCharacter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "model" TEXT,
    "sourceTaskId" TEXT,
    "sourceProjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasCharacter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CanvasCharacter_userId_updatedAt_idx" ON "CanvasCharacter"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "CanvasCharacter" ADD CONSTRAINT "CanvasCharacter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
