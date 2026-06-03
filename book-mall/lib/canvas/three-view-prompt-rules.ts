/**
 * 三视图 · 写入规则（与 canvas-web/lib/canvas/three-view-prompt-rules.ts 语义同步）
 */

/** LLM 写角色 appearance 时的约束 */
export const THREE_VIEW_APPEARANCE_LLM_RULE_ZH =
  "不含场景与大型道具；可描述服装与穿戴饰品，但禁止包袋、手持/夹持物件（含书本）、扶眼镜/触脸等挡脸动作（下游为白底全身无遮挡立绘）";

const THREE_VIEW_IMAGE_RULES_EN = [
  "[COMPOSITION] full body standing, front view facing camera, neutral standing pose, head to toe in frame, arms naturally at sides, hands not touching face or head",
  "[VISIBILITY] unobstructed full-body silhouette in all views; face fully visible, no hands blocking face",
  "[BACKGROUND] pure white background (#FFFFFF), no scene, no props, no text, no ground shadow",
  "[CONSTRAINTS] worn jewelry and accessories allowed; no backpacks, handbags, or carried bags; no held objects (books, documents, props, weapons); nothing tucked under arm or in hands",
  "[QUALITY] high detail, crisp lines, consistent character design for series use",
] as const;

/** story-web 角色头像 imagePrompt 拼装 */
export function buildCharacterImagePrompt(appearance: string): string {
  return [`[CHARACTER] ${appearance}`, ...THREE_VIEW_IMAGE_RULES_EN].join("\n");
}
