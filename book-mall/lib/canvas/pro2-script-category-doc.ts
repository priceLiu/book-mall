/**
 * Pro2 剧本类别参考 · book-mall 最小实现（与 canvas-web 默认正文同步）
 */
import { PRO2_GU_FENG_CATEGORY_DOC_SOURCE_MD } from "./data/pro2-gu-feng-category-doc-source";
import type { Pro2ScriptCategoryId } from "./pro2-script-category-presets";

export const PRO2_GU_FENG_CATEGORY_DOC_DEFAULT = PRO2_GU_FENG_CATEGORY_DOC_SOURCE_MD;

export function defaultPro2ScriptCategoryDocBody(
  categoryId: Pro2ScriptCategoryId | undefined,
): string | undefined {
  if (categoryId === "gu-feng-tian-chong") return PRO2_GU_FENG_CATEGORY_DOC_DEFAULT;
  return undefined;
}
