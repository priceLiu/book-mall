-- 工具站「AI 海报画布」分组：插入菜单可见性，sortOrder >= 6 的顺延

UPDATE "ToolNavVisibility" SET "sortOrder" = "sortOrder" + 1 WHERE "sortOrder" >= 6;

INSERT INTO "ToolNavVisibility" ("navKey", "label", "visible", "sortOrder", "updatedAt")
VALUES ('ai-poster-canvas', 'AI 海报画布', true, 6, CURRENT_TIMESTAMP);
