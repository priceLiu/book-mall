/** 与 book-mall/lib/ecom/ecom-storyboard-character-presets.ts 选项文案一致 */

export const CHARACTER_PRESET_FEMALE_CHOICE = "女主素人";
export const CHARACTER_PRESET_MALE_CHOICE = "男主素人";

export const CHARACTER_PRESET_CHOICES = [
  CHARACTER_PRESET_FEMALE_CHOICE,
  CHARACTER_PRESET_MALE_CHOICE,
] as const;

export function characterPresetLabelFromKey(key?: string | null): string | undefined {
  if (key === "female_ugc") return CHARACTER_PRESET_FEMALE_CHOICE;
  if (key === "male_ugc") return CHARACTER_PRESET_MALE_CHOICE;
  return undefined;
}
