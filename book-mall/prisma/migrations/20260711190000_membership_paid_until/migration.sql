-- AlterTable: 个人会员付费服务截止（与积分 31 天刷新周期解耦）
ALTER TABLE "CreditAccount" ADD COLUMN "membershipPaidUntil" TIMESTAMP(3);
