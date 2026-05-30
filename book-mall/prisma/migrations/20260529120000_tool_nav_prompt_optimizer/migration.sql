-- 工具站「提示词优化器」分组

UPDATE "ToolNavVisibility" SET "sortOrder" = "sortOrder" + 1 WHERE "sortOrder" >= 7;

INSERT INTO "ToolNavVisibility" ("navKey", "label", "visible", "sortOrder", "updatedAt")
VALUES ('prompt-optimizer', '提示词优化器', true, 7, CURRENT_TIMESTAMP);

INSERT INTO "ToolServiceFeePlan" ("id", "toolNavKey", "label", "monthlyFeePoints", "active", "sortOrder", "note", "updatedAt")
VALUES (
  'tsfp_prompt_optimizer',
  'prompt-optimizer',
  '提示词优化器',
  2500,
  true,
  65,
  '占位',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("toolNavKey") DO NOTHING;
