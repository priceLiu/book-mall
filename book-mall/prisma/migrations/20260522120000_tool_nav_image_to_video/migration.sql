-- 工具站「图生视频」分组：插入菜单可见性，sortOrder >= 3 的顺延

UPDATE "ToolNavVisibility" SET "sortOrder" = "sortOrder" + 1 WHERE "sortOrder" >= 3;

INSERT INTO "ToolNavVisibility" ("navKey", "label", "visible", "sortOrder", "updatedAt")
VALUES ('image-to-video', '图生视频', true, 3, CURRENT_TIMESTAMP);
