/**
 * v006 Round 4 一次性回填：按 `vendor + billingKind` 给所有 ModelCatalog 行填上 5 个 vendor* 字段。
 * 逻辑见 `lib/model-catalog/backfill-vendor-fields.ts`（与 `db:post-billing-setup` 共用）。
 */
import { prisma } from "../lib/prisma";
import { backfillModelCatalogVendorFields } from "../lib/model-catalog/backfill-vendor-fields";

async function main() {
  const result = await backfillModelCatalogVendorFields({ verbose: true });
  console.log("");
  console.log("[backfill] done:", result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
