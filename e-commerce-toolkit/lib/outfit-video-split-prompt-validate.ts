import { OUTFIT_SPLIT_FENCE } from "@/lib/outfit-video-split-prompts";

export const OUTFIT_SPLIT_REQUIRED_OUTPUT_FIELDS = [
  "sceneId",
  "cameraMove",
  "characterAction",
  "lightingSetup",
  "sceneBackground",
  "parseIncomplete",
] as const;

export type OutfitSplitPromptValidation = {
  ok: boolean;
  errors: string[];
};

export function validateOutfitSplitSystemPrompt(text: string): OutfitSplitPromptValidation {
  const t = text.trim();
  const errors: string[] = [];
  if (!t) errors.push("System 角色不能为空");
  for (const field of OUTFIT_SPLIT_REQUIRED_OUTPUT_FIELDS) {
    if (!t.includes(field)) {
      errors.push(`System 须说明输出字段「${field}」`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function validateOutfitSplitUserPrompt(text: string): OutfitSplitPromptValidation {
  const t = text.trim();
  const errors: string[] = [];
  if (!t) errors.push("User 指令不能为空");
  if (!t.includes(OUTFIT_SPLIT_FENCE)) {
    errors.push(`User 须含围栏标记 \`${OUTFIT_SPLIT_FENCE}\``);
  }
  if (!t.includes("scenes")) {
    errors.push("User 须要求输出 scenes 数组");
  }
  const hasRootContract =
    t.includes("scene_split_enrich_complete") ||
    (t.includes("action") && t.includes("templateId"));
  if (!hasRootContract) {
    errors.push("User 须说明 JSON 根字段 action=scene_split_enrich_complete 与 templateId");
  }
  return { ok: errors.length === 0, errors };
}

export function validateOutfitSplitPrompts(
  systemPrompt: string,
  userPrompt: string,
): OutfitSplitPromptValidation {
  const sys = validateOutfitSplitSystemPrompt(systemPrompt);
  const usr = validateOutfitSplitUserPrompt(userPrompt);
  return {
    ok: sys.ok && usr.ok,
    errors: [...sys.errors, ...usr.errors],
  };
}

export function formatOutfitSplitPromptValidationError(v: OutfitSplitPromptValidation): string {
  return v.errors.join("\n");
}
