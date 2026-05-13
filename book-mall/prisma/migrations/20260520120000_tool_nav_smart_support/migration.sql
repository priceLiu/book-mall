-- 工具站「智能客服」分组：插入菜单可见性，并把「费用」排序顺延

UPDATE "ToolNavVisibility" SET "sortOrder" = 4 WHERE "navKey" = 'app-history';

INSERT INTO "ToolNavVisibility" ("navKey", "label", "visible", "sortOrder", "updatedAt")
VALUES ('smart-support', '智能客服', true, 3, CURRENT_TIMESTAMP);
