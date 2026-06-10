-- 试衣/分割已并入 TEXT_TO_IMAGE（个人 130/月）；修正迁移前 TRYON 独立额度快照（30）

UPDATE "BillingSettlementLine"
SET
  "monthlyIncluded" = 130,
  "includedRemainingAfter" = GREATEST(0, 130 - COALESCE("includedUsedAfter", 0)),
  "feeDescription" = regexp_replace(
    regexp_replace(
      COALESCE("feeDescription", ''),
      'BYOK 套餐内 · AI试衣',
      'BYOK 套餐内 · 文生图（含试衣）',
      'g'
    ),
    '套餐剩余 [0-9]+',
    '套餐剩余 ' || GREATEST(0, 130 - COALESCE("includedUsedAfter", 0))::text
  ),
  "billingCategory" = 'TEXT_TO_IMAGE'::"BillingCategory"
WHERE "byokTaskKind" = 'TEXT_TO_IMAGE'
  AND "ownerType" = 'USER'
  AND "monthlyIncluded" = 30;

UPDATE "GatewayRequestLog" AS g
SET
  "includedRemainingAfter" = b."includedRemainingAfter",
  "billingCategory" = 'TEXT_TO_IMAGE'::"BillingCategory"
FROM "BillingSettlementLine" AS b
WHERE b."gatewayLogId" = g.id
  AND b."ownerType" = 'USER'
  AND b."monthlyIncluded" = 130
  AND g."requestKind" = 'TRYON'
  AND COALESCE(g."includedRemainingAfter", -1) < 100;

-- 团队：旧 TRYON 每席 20 → 文生图每席 100（3 席起 = 300 总额度）
UPDATE "BillingSettlementLine"
SET
  "monthlyIncluded" = 100 * GREATEST(3, 1),
  "includedRemainingAfter" = GREATEST(
    0,
    100 * GREATEST(3, 1) - COALESCE("includedUsedAfter", 0)
  ),
  "feeDescription" = regexp_replace(
    regexp_replace(
      COALESCE("feeDescription", ''),
      'BYOK 套餐内 · AI试衣',
      'BYOK 套餐内 · 文生图（含试衣）',
      'g'
    ),
    '套餐剩余 [0-9]+',
    '套餐剩余 ' || GREATEST(
      0,
      100 * GREATEST(3, 1) - COALESCE("includedUsedAfter", 0)
    )::text
  )
WHERE "byokTaskKind" = 'TEXT_TO_IMAGE'
  AND "ownerType" = 'TENANT'
  AND "monthlyIncluded" IN (20, 60);
