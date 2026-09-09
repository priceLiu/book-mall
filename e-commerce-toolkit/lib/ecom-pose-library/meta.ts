import type { EcomPoseGender, EcomPoseLibraryEntry } from "./types";

export type { EcomPoseGender };

export const ECOM_POSE_GENDER_OPTIONS: ReadonlyArray<{
  value: EcomPoseGender;
  label: string;
}> = [
  { value: "female", label: "女性" },
  { value: "male", label: "男性" },
  { value: "unisex", label: "全性别" },
];

export const ECOM_POSE_SCENE_TAG_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "电商", label: "电商" },
  { value: "通勤", label: "通勤" },
  { value: "扫街", label: "扫街" },
  { value: "夸张", label: "夸张" },
  { value: "游玩", label: "游玩" },
  { value: "运动", label: "运动" },
  { value: "商务", label: "商务" },
  { value: "生活", label: "生活" },
  { value: "影棚", label: "影棚" },
  { value: "户外", label: "户外" },
  { value: "红毯", label: "红毯" },
  { value: "戏剧", label: "戏剧" },
];

const VALID_GENDERS = new Set<EcomPoseGender>(["male", "female", "unisex"]);

const POSE_CATEGORY_SCENE_TAGS: Record<string, string[]> = {
  A: ["电商", "影棚"],
  B: ["电商", "扫街", "运动"],
  C: ["电商", "扫街"],
  D: ["夸张", "戏剧"],
  E: ["电商", "影棚"],
  H: ["夸张", "游玩", "运动", "户外"],
  I: ["扫街", "生活", "游玩"],
  J: ["电商", "商务", "通勤"],
  K: ["夸张", "红毯", "商务"],
  L: ["夸张", "戏剧"],
  M: ["电商", "生活", "影棚"],
};

export function normalizePoseGenders(raw: unknown): EcomPoseGender[] {
  if (!Array.isArray(raw)) return ["unisex"];
  const out = raw.filter(
    (g): g is EcomPoseGender => typeof g === "string" && VALID_GENDERS.has(g as EcomPoseGender),
  );
  return out.length ? [...new Set(out)] : ["unisex"];
}

export function normalizePoseSceneTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(ECOM_POSE_SCENE_TAG_OPTIONS.map((o) => o.value));
  const out = raw.filter((t): t is string => typeof t === "string" && allowed.has(t));
  return [...new Set(out)];
}

export function resolvePoseGenders(entry: Pick<EcomPoseLibraryEntry, "genders" | "tags">): EcomPoseGender[] {
  if (entry.genders?.length) return normalizePoseGenders(entry.genders);
  const tags = entry.tags;
  if (tags && typeof tags === "object" && !Array.isArray(tags)) {
    return normalizePoseGenders((tags as Record<string, unknown>).genders);
  }
  return ["unisex"];
}

export function resolvePoseSceneTags(entry: Pick<EcomPoseLibraryEntry, "sceneTags" | "tags" | "category">): string[] {
  if (entry.sceneTags?.length) return normalizePoseSceneTags(entry.sceneTags);
  const tags = entry.tags;
  if (tags && typeof tags === "object" && !Array.isArray(tags)) {
    const fromTags = normalizePoseSceneTags((tags as Record<string, unknown>).sceneTags);
    if (fromTags.length) return fromTags;
  }
  const key = (entry.category ?? "").trim().toUpperCase();
  return normalizePoseSceneTags(POSE_CATEGORY_SCENE_TAGS[key] ?? ["电商"]);
}

export function poseGenderLabel(gender: EcomPoseGender): string {
  return ECOM_POSE_GENDER_OPTIONS.find((o) => o.value === gender)?.label ?? gender;
}

export function matchesPoseGenderFilter(
  entry: Pick<EcomPoseLibraryEntry, "genders" | "tags">,
  selected: EcomPoseGender[],
): boolean {
  if (!selected.length) return true;
  const entryGenders = resolvePoseGenders(entry);
  if (entryGenders.includes("unisex")) return true;
  return selected.some((g) => entryGenders.includes(g));
}

export function matchesPoseSceneTagFilter(
  entry: Pick<EcomPoseLibraryEntry, "sceneTags" | "tags" | "category">,
  selected: string[],
): boolean {
  if (!selected.length) return true;
  const tags = resolvePoseSceneTags(entry);
  return selected.some((t) => tags.includes(t));
}

export function filterPoseEntries<T extends EcomPoseLibraryEntry>(
  entries: T[],
  filters: { genders?: EcomPoseGender[]; sceneTags?: string[] },
): T[] {
  const genders = filters.genders ?? [];
  const sceneTags = filters.sceneTags ?? [];
  if (!genders.length && !sceneTags.length) return entries;
  return entries.filter(
    (e) => matchesPoseGenderFilter(e, genders) && matchesPoseSceneTagFilter(e, sceneTags),
  );
}
