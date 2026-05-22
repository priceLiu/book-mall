-- 工具站「漫剧剧场」分组：插入菜单可见性，sortOrder >= 5 的顺延

UPDATE "ToolNavVisibility" SET "sortOrder" = "sortOrder" + 1 WHERE "sortOrder" >= 5;

INSERT INTO "ToolNavVisibility" ("navKey", "label", "visible", "sortOrder", "updatedAt")
VALUES ('story-theater', '漫剧剧场', true, 5, CURRENT_TIMESTAMP);
