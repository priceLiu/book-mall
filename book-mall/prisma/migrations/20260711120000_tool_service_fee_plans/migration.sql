-- Phase D：工具按月技术服务费（定价 + 用户周期）

CREATE TYPE "ToolServicePeriodStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED');

CREATE TABLE "ToolServiceFeePlan" (
    "id" TEXT NOT NULL,
    "toolNavKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "monthlyFeePoints" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolServiceFeePlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ToolServiceFeePlan_toolNavKey_key" ON "ToolServiceFeePlan"("toolNavKey");

CREATE TABLE "UserToolServicePeriod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolNavKey" TEXT NOT NULL,
    "planId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "ToolServicePeriodStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastChargedPoints" INTEGER,
    "walletEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserToolServicePeriod_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserToolServicePeriod_userId_toolNavKey_status_idx" ON "UserToolServicePeriod"("userId", "toolNavKey", "status");
CREATE INDEX "UserToolServicePeriod_userId_periodEnd_idx" ON "UserToolServicePeriod"("userId", "periodEnd");
CREATE INDEX "UserToolServicePeriod_toolNavKey_periodEnd_idx" ON "UserToolServicePeriod"("toolNavKey", "periodEnd");

ALTER TABLE "UserToolServicePeriod" ADD CONSTRAINT "UserToolServicePeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserToolServicePeriod" ADD CONSTRAINT "UserToolServicePeriod_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ToolServiceFeePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 默认定价（TBD 可后台改）
INSERT INTO "ToolServiceFeePlan" ("id", "toolNavKey", "label", "monthlyFeePoints", "active", "sortOrder", "note", "updatedAt")
VALUES
  ('tsfp_fitting_room', 'fitting-room', 'AI 试衣', 3000, true, 10, 'Phase D 示例定价', CURRENT_TIMESTAMP),
  ('tsfp_text_to_image', 'text-to-image', '文生图', 2000, true, 20, '占位', CURRENT_TIMESTAMP),
  ('tsfp_image_to_video', 'image-to-video', '图生视频', 3000, true, 30, '占位', CURRENT_TIMESTAMP),
  ('tsfp_visual_lab', 'visual-lab', '视觉实验室', 1500, true, 40, '占位', CURRENT_TIMESTAMP),
  ('tsfp_story_theater', 'story-theater', '漫剧剧场', 2500, true, 50, '占位', CURRENT_TIMESTAMP),
  ('tsfp_ai_poster_canvas', 'ai-poster-canvas', 'AI 海报画布', 2500, true, 60, '占位', CURRENT_TIMESTAMP),
  ('tsfp_smart_support', 'smart-support', '智能客服', 1000, true, 70, '占位', CURRENT_TIMESTAMP),
  ('tsfp_app_history', 'app-history', '费用明细', 0, true, 80, '免费', CURRENT_TIMESTAMP);
