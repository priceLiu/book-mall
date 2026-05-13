-- AlterTable: 产品 catalog 不再维护标价（计费：订阅解锁课程；工具单价见 ToolBillablePrice）
ALTER TABLE "Product" DROP COLUMN IF EXISTS "priceMinor";
