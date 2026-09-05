-- CreateTable
CREATE TABLE "AiSpaceFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "meta" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSpaceFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiSpaceFavorite_userId_targetKind_targetId_key" ON "AiSpaceFavorite"("userId", "targetKind", "targetId");

-- CreateIndex
CREATE INDEX "AiSpaceFavorite_userId_targetKind_sortOrder_idx" ON "AiSpaceFavorite"("userId", "targetKind", "sortOrder");

-- AddForeignKey
ALTER TABLE "AiSpaceFavorite" ADD CONSTRAINT "AiSpaceFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
