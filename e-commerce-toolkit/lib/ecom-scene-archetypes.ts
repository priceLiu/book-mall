export const ECOM_SCENE_ARCHETYPE_OPTIONS = [
  { value: "studio", label: "影棚/商业棚拍" },
  { value: "outdoor", label: "户外/自然" },
  { value: "street", label: "街拍/都市" },
  { value: "indoor_lifestyle", label: "室内生活" },
  { value: "commercial", label: "商业/宴会" },
] as const;

export type EcomSceneArchetype = (typeof ECOM_SCENE_ARCHETYPE_OPTIONS)[number]["value"];

export function resolveSceneArchetypeFromTags(
  tags?: Record<string, unknown> | null,
): EcomSceneArchetype | "" {
  if (!tags || typeof tags !== "object") return "";
  const raw = tags.archetype;
  if (typeof raw !== "string") return "";
  return ECOM_SCENE_ARCHETYPE_OPTIONS.some((o) => o.value === raw)
    ? (raw as EcomSceneArchetype)
    : "";
}
