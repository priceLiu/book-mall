/** 计划槽位空 Prompt 落库占位（满足校验；UI 展示为空） */
export const PRODUCT_DESIGN_PLAN_SLOT_PROMPT_PLACEHOLDER = "（待填写）";

export function productDesignPlanPromptForUi(prompt: string | undefined): string {
  const t = prompt?.trim() ?? "";
  if (!t || t === PRODUCT_DESIGN_PLAN_SLOT_PROMPT_PLACEHOLDER) return "";
  return prompt ?? "";
}

export function productDesignPlanPromptForSave(prompt: string): string {
  const t = prompt.trim();
  return t || PRODUCT_DESIGN_PLAN_SLOT_PROMPT_PLACEHOLDER;
}

export function isProductDesignPlanPromptReady(prompt: string | undefined): boolean {
  const t = prompt?.trim() ?? "";
  return Boolean(t) && t !== PRODUCT_DESIGN_PLAN_SLOT_PROMPT_PLACEHOLDER;
}