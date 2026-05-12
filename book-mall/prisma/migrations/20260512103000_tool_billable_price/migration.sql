-- CreateTable
CREATE TABLE "ToolBillablePrice" (
    "id" TEXT NOT NULL,
    "toolKey" TEXT NOT NULL,
    "action" TEXT,
    "priceMinor" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolBillablePrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ToolBillablePrice_toolKey_effectiveFrom_idx" ON "ToolBillablePrice"("toolKey", "effectiveFrom");

-- 初始定价（按 payment.md）：试衣间 AI 试衣 1 元/次；文生图 0.5 元/次；今日起生效、无结束时间
-- effectiveFrom：业务「今日」按 UTC 日历日 2026-05-12 00:00
INSERT INTO "ToolBillablePrice" ("id", "toolKey", "action", "priceMinor", "effectiveFrom", "effectiveTo", "active", "note", "createdAt", "updatedAt")
VALUES
    ('seed_tbprice_ai_fit_tryon', 'fitting-room__ai-fit', 'try_on', 100, TIMESTAMP '2026-05-12 00:00:00', NULL, true, '试衣间·AI试衣（大模型），1元/次', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('seed_tbprice_text_img_invoke', 'text-to-image', 'invoke', 50, TIMESTAMP '2026-05-12 00:00:00', NULL, true, '文生图（大模型），0.5元/次', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
