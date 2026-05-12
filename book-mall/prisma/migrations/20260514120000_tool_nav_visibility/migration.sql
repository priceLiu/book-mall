-- CreateTable
CREATE TABLE "ToolNavVisibility" (
    "navKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolNavVisibility_pkey" PRIMARY KEY ("navKey")
);

INSERT INTO "ToolNavVisibility" ("navKey", "label", "visible", "sortOrder", "updatedAt")
VALUES
    ('fitting-room', '试衣间', true, 1, CURRENT_TIMESTAMP),
    ('text-to-image', '文生图', true, 2, CURRENT_TIMESTAMP),
    ('app-history', '费用使用明细', true, 3, CURRENT_TIMESTAMP);
