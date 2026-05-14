-- ToolBillablePrice：后台填报的成本与零售系数（单价由二者乘积生成）

ALTER TABLE "ToolBillablePrice" ADD COLUMN "schemeAUnitCostYuan" DOUBLE PRECISION;
ALTER TABLE "ToolBillablePrice" ADD COLUMN "schemeAAdminRetailMultiplier" DOUBLE PRECISION;
