-- v005（2026-05-18）：WalletHold 默认 TTL 从 30 → 10 分钟
-- 视频任务多数 < 5 分钟内回 settle，10 分钟兜底足够；旧 30 分钟会让长尾未 settle 的 hold 长期占住用户余额。
-- 同时把已存在的 default 行也回填到 10（如果当前仍是 30，且没有被运营手动改过）。

ALTER TABLE "PlatformConfig"
  ALTER COLUMN "walletHoldDefaultTtlMin" SET DEFAULT 10;

UPDATE "PlatformConfig"
SET "walletHoldDefaultTtlMin" = 10
WHERE "id" = 'default'
  AND "walletHoldDefaultTtlMin" = 30;
