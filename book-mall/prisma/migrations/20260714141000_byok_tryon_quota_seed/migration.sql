-- BYOK 套餐：AI 试衣月度额度（依赖上一迁移已提交的 TRYON 枚举值）
INSERT INTO "ByokTaskQuota" ("id", "scopeKey", "taskKind", "label", "monthlyIncluded", "overageCredits", "active", "updatedAt")
VALUES
  ('byok_quota_personal_tryon', 'personal', 'TRYON', 'AI试衣', 30, 25, true, NOW()),
  ('byok_quota_team_tryon', 'team-seat', 'TRYON', 'AI试衣', 20, 25, true, NOW())
ON CONFLICT ("scopeKey", "taskKind") DO UPDATE SET
  "label" = EXCLUDED."label",
  "monthlyIncluded" = EXCLUDED."monthlyIncluded",
  "overageCredits" = EXCLUDED."overageCredits",
  "active" = true,
  "updatedAt" = NOW();
