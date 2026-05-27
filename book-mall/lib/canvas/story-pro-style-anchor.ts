/**
 * 影视专业版 · 风格锚定词注入（Gateway run 前调用）
 */
export type StoryProStyleAnchorInput = {
  styleAnchorZh?: string | null;
  styleAnchorEn?: string | null;
  negativePrompt?: string | null;
};

export function prependStoryProStyleAnchor(
  prompt: string,
  style: StoryProStyleAnchorInput | null | undefined,
): string {
  if (!style) return prompt;
  const anchorEn = style.styleAnchorEn?.trim() ?? "";
  const anchorZh = style.styleAnchorZh?.trim() ?? "";
  const negative = style.negativePrompt?.trim() ?? "";
  const parts = [anchorEn, anchorZh, prompt.trim()].filter(Boolean);
  let out = parts.join("\n");
  if (negative) {
    out += `\n\nNegative: ${negative}`;
  }
  return out;
}

export function storyProStyleGateError(): never {
  const err = new Error("请先完成风格定义并定稿（styleFinalized）");
  (err as Error & { code?: string; status?: number }).code = "STYLE_NOT_FINALIZED";
  (err as Error & { status?: number }).status = 403;
  throw err;
}
