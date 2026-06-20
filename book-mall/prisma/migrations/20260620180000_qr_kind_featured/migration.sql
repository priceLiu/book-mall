-- QuickReplica · 管理员推荐 kind 分类示例

CREATE TABLE "QrKindFeatured" (
    "kind" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateSource" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QrKindFeatured_pkey" PRIMARY KEY ("kind")
);

ALTER TABLE "QrKindFeatured" ADD CONSTRAINT "QrKindFeatured_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
