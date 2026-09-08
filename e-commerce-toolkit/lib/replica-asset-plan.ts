export type ReplicaAssetCategory = "character" | "product" | "prop" | "scene";

export type ReplicaAssetPlanSlot = {
  id: string;
  category: ReplicaAssetCategory;
  label: string;
  description: string;
  wardrobe?: string;
  roleInShot?: string;
};

export type ReplicaAssetPlan = {
  characters: ReplicaAssetPlanSlot[];
  products: ReplicaAssetPlanSlot[];
  props: ReplicaAssetPlanSlot[];
  scenes: ReplicaAssetPlanSlot[];
};

export function readReplicaAssetPlan(meta: Record<string, unknown> | null | undefined): ReplicaAssetPlan | null {
  if (!meta || typeof meta !== "object") return null;
  const raw = meta.replicaAssetPlan;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const pick = (key: keyof ReplicaAssetPlan): ReplicaAssetPlanSlot[] => {
    const arr = o[key];
    if (!Array.isArray(arr)) return [];
    return arr.filter((item): item is ReplicaAssetPlanSlot => {
      if (!item || typeof item !== "object") return false;
      const s = item as Record<string, unknown>;
      return typeof s.id === "string" && typeof s.label === "string";
    }) as ReplicaAssetPlanSlot[];
  };
  return {
    characters: pick("characters"),
    products: pick("products"),
    props: pick("props"),
    scenes: pick("scenes"),
  };
}

export function listReplicaAssetPlanSlots(plan: ReplicaAssetPlan): ReplicaAssetPlanSlot[] {
  return [...plan.characters, ...plan.products, ...plan.props, ...plan.scenes];
}

export function replicaAssetSlotToken(slot: Pick<ReplicaAssetPlanSlot, "label">): string {
  const compact = slot.label.replace(/\s+/g, "");
  return compact.startsWith("@") ? compact : `@${compact}`;
}

export function replicaAssetCategoryTitle(category: ReplicaAssetCategory): string {
  switch (category) {
    case "character":
      return "全身人物";
    case "product":
      return "产品";
    case "prop":
      return "道具";
    case "scene":
      return "场景";
  }
}
