/* eslint-disable no-console */
/**
 * 把 e-commerce-toolkit 的分类登记表同步到 book-mall/lib/ecom/ecom-template-categories.json。
 *
 * 分类的唯一事实源在工具箱（前端 Tab、类型联合、文件名推断都由它派生），
 * 但两个包不共享 tsconfig paths，管理后台只能读这份生成物。
 * 不同步的后果：后台能建「化妆品」，工具箱却不显示该 Tab。
 *
 * 使用：
 *   pnpm ecom:sync-categories            # 写入
 *   pnpm ecom:sync-categories --check    # 仅校验（CI 用，不一致则非零退出）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { ECOM_TEMPLATE_CATEGORY_META } from "../../e-commerce-toolkit/lib/ecom-template-gallery/types";

const DST = resolve(__dirname, "..", "lib", "ecom", "ecom-template-categories.json");

function main() {
  const checkOnly = process.argv.includes("--check");
  const next =
    JSON.stringify(
      ECOM_TEMPLATE_CATEGORY_META.map((c) => ({ id: c.id, label: c.label })),
      null,
      2,
    ) + "\n";

  let current: string | null;
  try {
    current = readFileSync(DST, "utf8");
  } catch {
    current = null;
  }

  if (current === next) {
    console.log(
      `[sync-ecom-template-categories] OK · ${ECOM_TEMPLATE_CATEGORY_META.length} 个分类`,
    );
    return;
  }

  if (checkOnly) {
    console.error("[sync-ecom-template-categories] DRIFT");
    console.error("Run `pnpm ecom:sync-categories` to update.");
    process.exit(1);
  }

  writeFileSync(DST, next);
  console.log(
    `[sync-ecom-template-categories] wrote ${DST} (${ECOM_TEMPLATE_CATEGORY_META.length} 个分类)`,
  );
}

main();
