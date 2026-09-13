/**
 * 幂等写入 12 平台 × 3 类目系统模板。
 * 用法：cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/seed-detail-page-suite-templates.ts
 */
import { CATEGORY_SEED_META, sumModuleMax } from "@/lib/ecom/detail-page-suite/category-seeds";
import { upsertSystemTemplates } from "@/lib/ecom/detail-page-suite/template-service";
import { ECOM_DETAIL_PAGE_SUITE_GLOBAL_MAX } from "@/lib/ecom/detail-page-suite/types";

async function main() {
  for (const [key, meta] of Object.entries(CATEGORY_SEED_META)) {
    const sum = sumModuleMax(meta.modules);
    if (sum !== ECOM_DETAIL_PAGE_SUITE_GLOBAL_MAX) {
      throw new Error(`${key} 模块 max_num 合计 ${sum}，须等于 ${ECOM_DETAIL_PAGE_SUITE_GLOBAL_MAX}`);
    }
  }
  const { created, updated } = await upsertSystemTemplates();
  console.log(`[detail-page-suite] 系统模板：新增 ${created}，更新 ${updated}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
