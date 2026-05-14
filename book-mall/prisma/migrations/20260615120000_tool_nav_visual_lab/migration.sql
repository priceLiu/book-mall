-- 工具站「视觉实验室」分组：插入菜单可见性，sortOrder >= 4 的顺延

UPDATE "ToolNavVisibility" SET "sortOrder" = "sortOrder" + 1 WHERE "sortOrder" >= 4;

INSERT INTO "ToolNavVisibility" ("navKey", "label", "visible", "sortOrder", "updatedAt")
VALUES ('visual-lab', '视觉实验室', true, 4, CURRENT_TIMESTAMP);
