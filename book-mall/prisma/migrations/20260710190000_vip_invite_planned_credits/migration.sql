-- VIP 大额预充 · 邀请预分配积分
ALTER TABLE "TenantInvite" ADD COLUMN IF NOT EXISTS "plannedGeneralCredits" INTEGER;
ALTER TABLE "TenantInvite" ADD COLUMN IF NOT EXISTS "plannedVideoCredits" INTEGER;
