-- AI 试衣：用户衣柜收藏（成片 OSS URL）

CREATE TYPE "AiFitClosetGarmentMode" AS ENUM ('TWO_PIECE', 'ONE_PIECE');

CREATE TABLE "AiFitClosetItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "garmentMode" "AiFitClosetGarmentMode" NOT NULL,
    "personImageUrl" TEXT,
    "topGarmentUrl" TEXT,
    "bottomGarmentUrl" TEXT,
    "note" TEXT,
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiFitClosetItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiFitClosetItem_userId_createdAt_idx" ON "AiFitClosetItem"("userId", "createdAt");

ALTER TABLE "AiFitClosetItem" ADD CONSTRAINT "AiFitClosetItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
