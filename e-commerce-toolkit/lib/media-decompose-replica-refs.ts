import {
  listReplicaAssetPlanSlots,
  replicaAssetSlotToken,
  type ReplicaAssetCategory,
  type ReplicaAssetPlan,
  type ReplicaAssetPlanSlot,
} from "@/lib/replica-asset-plan";
import {
  REPLICA_MODEL_REF_ID,
  REPLICA_PRODUCT_REF_ID,
} from "@/lib/media-decompose-replica-constants";
import type { EcomPromptImageRef } from "@/lib/ecom-prompt-mention";
import type { SeedVideoReference } from "@/lib/seed-video-types";

export const REPLICA_REF_MAX_PER_ROLE = 6;

export type ReplicaRefRole = "model" | "product";

const REPLICA_SLOT_REF_PREFIX = "ref-replica-slot-";

export function parseReplicaSlotRefId(refId: string): { category: ReplicaAssetCategory; slotId: string } | null {
  if (!refId.startsWith(REPLICA_SLOT_REF_PREFIX)) return null;
  const rest = refId.slice(REPLICA_SLOT_REF_PREFIX.length);
  const dash = rest.indexOf("-");
  if (dash <= 0) return null;
  const category = rest.slice(0, dash) as ReplicaAssetCategory;
  if (category !== "character" && category !== "product" && category !== "prop" && category !== "scene") {
    return null;
  }
  const slotId = rest.slice(dash + 1);
  if (!slotId) return null;
  return { category, slotId };
}

export function isReplicaSlotRefId(id: string): boolean {
  return parseReplicaSlotRefId(id) != null;
}

export function isReplicaModelRefId(id: string): boolean {
  return id === REPLICA_MODEL_REF_ID || id.startsWith("ref-replica-model-");
}

export function isReplicaProductRefId(id: string): boolean {
  return id === REPLICA_PRODUCT_REF_ID || id.startsWith("ref-replica-product-");
}

export function listReplicaSlotRefs(references: SeedVideoReference[]): SeedVideoReference[] {
  return references.filter((r) => isReplicaSlotRefId(r.id) && r.ossUrl?.trim());
}

export function findReplicaSlotRef(
  references: SeedVideoReference[],
  slotId: string,
): SeedVideoReference | undefined {
  return listReplicaSlotRefs(references).find((r) => parseReplicaSlotRefId(r.id)?.slotId === slotId);
}

export function listReplicaModelRefs(references: SeedVideoReference[]): SeedVideoReference[] {
  return references.filter((r) => isReplicaModelRefId(r.id) && r.ossUrl?.trim());
}

export function listReplicaProductRefs(references: SeedVideoReference[]): SeedVideoReference[] {
  return references.filter((r) => isReplicaProductRefId(r.id) && r.ossUrl?.trim());
}

export function buildReplicaMentionRefs(references: SeedVideoReference[]): EcomPromptImageRef[] {
  const slotRefs = listReplicaSlotRefs(references);
  if (slotRefs.length > 0) {
    return slotRefs.map((ref, i) => {
      const parsed = parseReplicaSlotRefId(ref.id);
      const label = ref.label?.trim() || "参考";
      const token = label.startsWith("@") ? label : `@${label.replace(/\s+/g, "")}`;
      return {
        index: i + 1,
        token,
        kind: parsed?.category === "character" ? "model" : parsed?.category === "product" ? "product" : "style",
        kindIndex: i + 1,
        url: ref.ossUrl,
        label: ref.label,
        role: parsed?.category ?? "style",
      };
    });
  }

  const entries: EcomPromptImageRef[] = [];
  let index = 1;
  for (const ref of listReplicaModelRefs(references)) {
    entries.push({
      index,
      token: `@图片${index}`,
      kind: "model",
      kindIndex: index,
      url: ref.ossUrl,
      label: ref.label?.trim() || `模特 ${index}`,
      role: "model",
    });
    index += 1;
  }
  for (const ref of listReplicaProductRefs(references)) {
    entries.push({
      index,
      token: `@图片${index}`,
      kind: "product",
      kindIndex: index - listReplicaModelRefs(references).length,
      url: ref.ossUrl,
      label: ref.label?.trim() || `产品 ${index}`,
      role: "product",
    });
    index += 1;
  }
  return entries;
}

export function buildReplicaMentionRefsFromPlan(
  plan: ReplicaAssetPlan,
  references: SeedVideoReference[],
): EcomPromptImageRef[] {
  const entries: EcomPromptImageRef[] = [];
  let index = 1;
  for (const slot of listReplicaAssetPlanSlots(plan)) {
    const ref = findReplicaSlotRef(references, slot.id);
    if (!ref?.ossUrl?.trim()) continue;
    entries.push({
      index,
      token: replicaAssetSlotToken(slot),
      kind: slot.category === "character" ? "model" : slot.category === "product" ? "product" : "style",
      kindIndex: index,
      url: ref.ossUrl,
      label: slot.label,
      role: slot.category,
    });
    index += 1;
  }
  if (entries.length > 0) return entries;
  return buildReplicaMentionRefs(references);
}

export function hasReplicaModelRefs(references: SeedVideoReference[]): boolean {
  return (
    listReplicaSlotRefs(references).some((r) => parseReplicaSlotRefId(r.id)?.category === "character") ||
    listReplicaModelRefs(references).length > 0
  );
}

export function hasReplicaProductRefs(references: SeedVideoReference[]): boolean {
  return (
    listReplicaSlotRefs(references).some((r) => parseReplicaSlotRefId(r.id)?.category === "product") ||
    listReplicaProductRefs(references).length > 0
  );
}

export function buildReplicaMentionTokens(references: SeedVideoReference[]): string[] {
  return buildReplicaMentionRefs(references).map((ref) => ref.token);
}
