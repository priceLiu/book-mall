import type { EcomSceneLibraryEntry } from "@/lib/ecom/ecom-scene-library-service";

export type SceneArchetype =
  | "studio"
  | "outdoor"
  | "street"
  | "indoor_lifestyle"
  | "commercial";

export const SCENE_ARCHETYPE_LABELS: Record<SceneArchetype, string> = {
  studio: "影棚/商业棚拍",
  outdoor: "户外/自然",
  street: "街拍/都市",
  indoor_lifestyle: "室内生活",
  commercial: "商业/宴会",
};

export const SCENE_POSE_PRIORITY: Record<SceneArchetype, string[]> = {
  studio: ["A", "J", "K", "C"],
  outdoor: ["B", "H", "E"],
  street: ["B", "I", "C"],
  indoor_lifestyle: ["I", "A", "J"],
  commercial: ["A", "K", "J"],
};

export const SCENE_POSE_FORBIDDEN: Record<SceneArchetype, string[]> = {
  studio: ["H", "L"],
  outdoor: ["J"],
  street: ["L"],
  indoor_lifestyle: ["H", "L"],
  commercial: ["H"],
};

const ARCHETYPE_SET = new Set<string>(Object.keys(SCENE_POSE_PRIORITY));

export function isSceneArchetype(value: string): value is SceneArchetype {
  return ARCHETYPE_SET.has(value);
}

export function resolveSceneArchetype(
  scene?: Pick<EcomSceneLibraryEntry, "tags"> | null,
): SceneArchetype | null {
  if (!scene?.tags || typeof scene.tags !== "object") return null;
  const raw = scene.tags.archetype ?? scene.tags.archetypes;
  if (typeof raw === "string" && isSceneArchetype(raw)) return raw;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string" && isSceneArchetype(item)) return item;
    }
  }
  return null;
}

/** 风格优先列表与场景优先取并集，剔除场景禁止项 */
export function mergeStyleScenePriority(
  stylePriority: string[],
  sceneArchetype: SceneArchetype | null,
): string[] {
  if (!sceneArchetype) return stylePriority;
  const forbidden = new Set(SCENE_POSE_FORBIDDEN[sceneArchetype]);
  const merged: string[] = [];
  for (const cat of stylePriority) {
    if (!forbidden.has(cat)) merged.push(cat);
  }
  for (const cat of SCENE_POSE_PRIORITY[sceneArchetype]) {
    if (!forbidden.has(cat) && !merged.includes(cat)) merged.push(cat);
  }
  return merged;
}

export function sceneForbidsCategory(
  sceneArchetype: SceneArchetype | null,
  category: string,
): boolean {
  if (!sceneArchetype) return false;
  return SCENE_POSE_FORBIDDEN[sceneArchetype].includes(category);
}

export function tagsForArchetype(archetype: SceneArchetype): Record<string, unknown> {
  return { archetype };
}
