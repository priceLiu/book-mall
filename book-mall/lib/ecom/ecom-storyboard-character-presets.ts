/** 无上传角色图时，系统预设的人物外观（供生图 prompt 与角色参考图生成） */

export type CharacterPresetKey = "female_ugc" | "male_ugc";

export const CHARACTER_PRESET_FEMALE_CHOICE = "女主素人";
export const CHARACTER_PRESET_MALE_CHOICE = "男主素人";

const PRESET_BASE: Record<CharacterPresetKey, string> = {
  female_ugc:
    "Chinese woman age 26-32, shoulder-length natural black hair, minimal everyday makeup, warm friendly expression, cream knit cardigan over white t-shirt, approachable UGC creator look, same face and outfit in every shot",
  male_ugc:
    "Chinese man age 28-35, short neat black hair, clean-shaven, natural smile, light blue casual oxford shirt, approachable UGC creator look, same face and outfit in every shot",
};

const UGC_PERSONA_TWEAKS: Record<string, string> = {
  精致宝妈: "gentle motherly vibe, soft warm home lighting on face",
  都市白领: "polished urban commuter style, smart casual",
  学生党: "youthful university student, age 20-24, relaxed campus casual",
  专业评测师: "confident reviewer posture, neutral professional backdrop",
  本土素人: "authentic local UGC creator, unpolished natural charm",
};

export function characterPresetKeyFromChoice(choice: string): CharacterPresetKey | null {
  if (choice === CHARACTER_PRESET_FEMALE_CHOICE) return "female_ugc";
  if (choice === CHARACTER_PRESET_MALE_CHOICE) return "male_ugc";
  return null;
}

export function characterPresetLabelFromKey(key?: string | null): string | undefined {
  if (key === "female_ugc") return CHARACTER_PRESET_FEMALE_CHOICE;
  if (key === "male_ugc") return CHARACTER_PRESET_MALE_CHOICE;
  return undefined;
}

export function resolveCharacterPresetAppearance(
  key: CharacterPresetKey,
  ugcPersona?: string | null,
): string {
  const base = PRESET_BASE[key];
  const persona = ugcPersona?.trim();
  if (!persona) return base;
  for (const [kw, tweak] of Object.entries(UGC_PERSONA_TWEAKS)) {
    if (persona.includes(kw)) return `${base}, ${tweak}`;
  }
  return `${base}, persona: ${persona}`;
}
