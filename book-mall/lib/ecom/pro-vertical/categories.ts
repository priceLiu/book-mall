/** 与 e-commerce-toolkit/lib/pro-vertical/categories.ts 对齐（后端识别会话品类选择） */
export const PRO_CATEGORY_PICK_PREFIX = "选择品类·";

export function isProCategoryPickMessage(message: string): boolean {
  return message.trim().startsWith(PRO_CATEGORY_PICK_PREFIX);
}
