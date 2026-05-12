-- 计费重置：清空工具扣费流水；移除消耗类钱包分录并按剩余流水重算余额（恢复充值入账口径）。
TRUNCATE TABLE "ToolUsageEvent";

DELETE FROM "WalletEntry" WHERE "type" = 'CONSUME';

UPDATE "Wallet" AS w
SET
    "balanceMinor" = COALESCE(
        (
            SELECT SUM(we."amountMinor")::integer
            FROM "WalletEntry" AS we
            WHERE we."walletId" = w."id"
        ),
        0
    ),
    "updatedAt" = CURRENT_TIMESTAMP;
