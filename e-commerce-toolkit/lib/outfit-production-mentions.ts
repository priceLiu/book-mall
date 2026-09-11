/** 穿搭制作表 · @图片1 规范（与 book-mall ecom-outfit-production-mentions 保持一致） */

export const OUTFIT_PRIMARY_MENTION_TOKEN = "@图片1";

const PRIMARY_MENTION_RE = /@图片1\b/;

export function hasOutfitPrimaryMention(text: string): boolean {
  return PRIMARY_MENTION_RE.test(text.trim());
}

export function normalizeOutfitProductionMentionText(text: string): string {
  let t = text.trim();
  if (!t) return t;

  t = t.replace(/(?<![@])图片(\d+)/g, "@图片$1");
  t = t.replace(/(?<!@图片1)模特/g, "@图片1模特");
  t = t.replace(/@图片1@图片1/g, "@图片1");

  if (!hasOutfitPrimaryMention(t)) {
    t = `${OUTFIT_PRIMARY_MENTION_TOKEN} ${t}`;
  }

  return t.replace(/\s{2,}/g, " ").trim();
}

export type OutfitProductionMentionField = {
  characterAction: string;
  positivePrompt: string;
  finalStoryboard: string;
  sceneBackground: string;
  cameraMove: string;
};

function shouldNormalizeOptionalMentionField(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return /模特|图片\d|参考图\d/.test(t);
}

export function normalizeOutfitProductionMentionFields<
  T extends Partial<OutfitProductionMentionField>,
>(fields: T): T {
  const out = { ...fields };
  if (typeof out.characterAction === "string" && out.characterAction.trim()) {
    out.characterAction = normalizeOutfitProductionMentionText(out.characterAction);
  }
  if (typeof out.positivePrompt === "string" && out.positivePrompt.trim()) {
    out.positivePrompt = normalizeOutfitProductionMentionText(out.positivePrompt);
  }
  if (
    typeof out.finalStoryboard === "string" &&
    out.finalStoryboard.trim() &&
    shouldNormalizeOptionalMentionField(out.finalStoryboard)
  ) {
    out.finalStoryboard = normalizeOutfitProductionMentionText(out.finalStoryboard);
  }
  if (
    typeof out.sceneBackground === "string" &&
    out.sceneBackground.trim() &&
    shouldNormalizeOptionalMentionField(out.sceneBackground)
  ) {
    out.sceneBackground = normalizeOutfitProductionMentionText(out.sceneBackground);
  }
  if (
    typeof out.cameraMove === "string" &&
    out.cameraMove.trim() &&
    shouldNormalizeOptionalMentionField(out.cameraMove)
  ) {
    out.cameraMove = normalizeOutfitProductionMentionText(out.cameraMove);
  }
  return out;
}

export function isOutfitProductionMentionFieldName(
  field: string,
): field is keyof OutfitProductionMentionField {
  return (
    field === "characterAction" ||
    field === "positivePrompt" ||
    field === "finalStoryboard" ||
    field === "sceneBackground" ||
    field === "cameraMove"
  );
}
