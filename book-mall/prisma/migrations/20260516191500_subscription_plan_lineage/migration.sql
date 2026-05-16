-- SubscriptionPlan 版本谱系：发布新版本时把旧 plan 归档（active=false + archivedAt + 改让 slug），
-- 通过 parentPlanId 形成单向溯源链；老 Subscription.planId 仍指向归档 plan，溯源不变。
ALTER TABLE "SubscriptionPlan"
  ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "SubscriptionPlan"
  ADD COLUMN "parentPlanId" TEXT;

ALTER TABLE "SubscriptionPlan"
  ADD CONSTRAINT "SubscriptionPlan_parentPlanId_fkey"
  FOREIGN KEY ("parentPlanId") REFERENCES "SubscriptionPlan"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SubscriptionPlan_active_archivedAt_idx"
  ON "SubscriptionPlan"("active", "archivedAt");
