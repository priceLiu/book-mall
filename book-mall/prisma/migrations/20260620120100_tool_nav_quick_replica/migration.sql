-- 工具站「快速复制」分组

UPDATE "ToolNavVisibility" SET "sortOrder" = "sortOrder" + 1 WHERE "sortOrder" >= 8;

INSERT INTO "ToolNavVisibility" ("navKey", "label", "visible", "sortOrder", "updatedAt")
VALUES ('quick-replica', '快速复制', true, 8, CURRENT_TIMESTAMP)
ON CONFLICT ("navKey") DO NOTHING;

INSERT INTO "ToolServiceFeePlan" ("id", "toolNavKey", "label", "monthlyFeePoints", "active", "sortOrder", "note", "updatedAt")
VALUES (
  'tsfp_quick_replica',
  'quick-replica',
  '快速复制',
  2500,
  true,
  66,
  '占位',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("toolNavKey") DO NOTHING;
