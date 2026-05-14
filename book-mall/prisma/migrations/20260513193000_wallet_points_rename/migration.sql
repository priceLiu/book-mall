-- Rename monetary minor-unit columns to *Points (1 点 = ¥0.01，与历史「分」同值).

ALTER TABLE "ToolUsageEvent" RENAME COLUMN "costMinor" TO "costPoints";

ALTER TABLE "ToolBillablePrice" RENAME COLUMN "priceMinor" TO "pricePoints";

ALTER TABLE "PlatformConfig" RENAME COLUMN "minBalanceLineMinor" TO "minBalanceLinePoints";
ALTER TABLE "PlatformConfig" RENAME COLUMN "balanceWarnHighMinor" TO "balanceWarnHighPoints";
ALTER TABLE "PlatformConfig" RENAME COLUMN "balanceWarnMidMinor" TO "balanceWarnMidPoints";
ALTER TABLE "PlatformConfig" RENAME COLUMN "llmInputPer1kTokensMinor" TO "llmInputPer1kTokensPoints";
ALTER TABLE "PlatformConfig" RENAME COLUMN "llmOutputPer1kTokensMinor" TO "llmOutputPer1kTokensPoints";
ALTER TABLE "PlatformConfig" RENAME COLUMN "toolInvokePerCallMinor" TO "toolInvokePerCallPoints";

ALTER TABLE "Wallet" RENAME COLUMN "balanceMinor" TO "balancePoints";
ALTER TABLE "Wallet" RENAME COLUMN "frozenMinor" TO "frozenPoints";

ALTER TABLE "WalletEntry" RENAME COLUMN "amountMinor" TO "amountPoints";
ALTER TABLE "WalletEntry" RENAME COLUMN "balanceAfterMinor" TO "balanceAfterPoints";

ALTER TABLE "SubscriptionPlan" RENAME COLUMN "priceMinor" TO "pricePoints";

ALTER TABLE "Order" RENAME COLUMN "amountMinor" TO "amountPoints";

ALTER TABLE "WalletRefundRequest" RENAME COLUMN "requestedAmountMinor" TO "requestedAmountPoints";
ALTER TABLE "WalletRefundRequest" RENAME COLUMN "pendingSettlementMinor" TO "pendingSettlementPoints";
ALTER TABLE "WalletRefundRequest" RENAME COLUMN "refundAmountMinor" TO "refundAmountPoints";
