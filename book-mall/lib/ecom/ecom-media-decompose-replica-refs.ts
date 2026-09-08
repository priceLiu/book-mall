import { randomUUID } from "crypto";

import {
  listReplicaAssetPlanSlots,
  replicaAssetSlotToken,
  type ReplicaAssetCategory,
  type ReplicaAssetPlan,
  type ReplicaAssetPlanSlot,
} from "@/lib/ecom/ecom-replica-asset-plan";
import {
  REPLICA_MODEL_REF_ID,
  REPLICA_PRODUCT_REF_ID,
} from "@/lib/ecom/ecom-media-decompose-replica-constants";
import type { SeedVideoReference } from "@/lib/ecom/ecom-seed-video-types";

export const REPLICA_REF_MAX_PER_ROLE = 6;

/** @deprecated 兼容旧 API；新流程用 ReplicaAssetCategory */
export type ReplicaRefRole = "model" | "product";

export type ReplicaMentionEntry = {
  ref: SeedVideoReference;
  token: string;
  index: number;
  role: ReplicaRefRole | ReplicaAssetCategory;
  planSlotId?: string;
};

const REPLICA_SLOT_REF_PREFIX = "ref-replica-slot-";

export function replicaSlotRefId(category: ReplicaAssetCategory, slotId: string): string {
  return `${REPLICA_SLOT_REF_PREFIX}${category}-${slotId}`;
}

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

export function isReplicaManagedRefId(id: string): boolean {
  return isReplicaSlotRefId(id) || isReplicaModelRefId(id) || isReplicaProductRefId(id);
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

/** 识产品 / 卖点：优先四槽 product 上传，回退 legacy product ref */
export function listReplicaProductImageRefs(
  references: SeedVideoReference[],
  plan?: ReplicaAssetPlan | null,
): SeedVideoReference[] {
  if (plan && plan.products.length > 0) {
    const slotRefs = plan.products
      .map((slot) => findReplicaSlotRef(references, slot.id))
      .filter((r): r is SeedVideoReference => Boolean(r?.ossUrl?.trim()));
    if (slotRefs.length > 0) return slotRefs;
  }
  return listReplicaProductRefs(references);
}

export function listReplicaRefs(references: SeedVideoReference[]): SeedVideoReference[] {
  const slots = listReplicaSlotRefs(references);
  if (slots.length > 0) return slots;
  return [...listReplicaModelRefs(references), ...listReplicaProductRefs(references)];
}

export function buildReplicaMentionCatalogFromPlan(
  plan: ReplicaAssetPlan,
  references: SeedVideoReference[],
): ReplicaMentionEntry[] {
  const entries: ReplicaMentionEntry[] = [];
  let index = 1;
  for (const slot of listReplicaAssetPlanSlots(plan)) {
    const ref = findReplicaSlotRef(references, slot.id);
    if (!ref?.ossUrl?.trim()) continue;
    entries.push({
      ref,
      token: replicaAssetSlotToken(slot),
      index,
      role: slot.category,
      planSlotId: slot.id,
    });
    index += 1;
  }
  if (entries.length > 0) return entries;
  return buildReplicaMentionCatalog(references);
}

export function buildReplicaMentionCatalog(references: SeedVideoReference[]): ReplicaMentionEntry[] {
  const slotEntries = listReplicaSlotRefs(references);
  if (slotEntries.length > 0) {
    const entries: ReplicaMentionEntry[] = [];
    let index = 1;
    for (const ref of slotEntries) {
      const parsed = parseReplicaSlotRefId(ref.id);
      const label = ref.label?.trim() || parsed?.slotId || "参考";
      entries.push({
        ref,
        token: label.startsWith("@") ? label : `@${label.replace(/\s+/g, "")}`,
        index,
        role: parsed?.category ?? "character",
        planSlotId: parsed?.slotId,
      });
      index += 1;
    }
    return entries;
  }

  const models = listReplicaModelRefs(references);
  const products = listReplicaProductRefs(references);
  const entries: ReplicaMentionEntry[] = [];
  let index = 1;
  for (const ref of models) {
    entries.push({ ref, token: `@图片${index}`, index, role: "model" });
    index += 1;
  }
  for (const ref of products) {
    entries.push({ ref, token: `@图片${index}`, index, role: "product" });
    index += 1;
  }
  return entries;
}

export function replicaMentionSummary(catalog: ReplicaMentionEntry[]): string {
  if (catalog.length === 0) return "（尚无替换参考图；各槽位将 inherit 原片描述）";
  return catalog.map((e) => `${e.token}：${e.ref.label}`).join("；");
}

export function createReplicaRefId(role: ReplicaRefRole): string {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 10);
  return role === "model" ? `ref-replica-model-${suffix}` : `ref-replica-product-${suffix}`;
}

export function nextReplicaRefLabel(role: ReplicaRefRole, references: SeedVideoReference[]): string {
  const count =
    role === "model"
      ? listReplicaModelRefs(references).length
      : listReplicaProductRefs(references).length;
  return role === "model" ? `模特 ${count + 1}` : `产品 ${count + 1}`;
}

export function upsertReplicaSlotReference(
  references: SeedVideoReference[],
  slot: ReplicaAssetPlanSlot,
  ossUrl: string,
): { references: SeedVideoReference[]; reference: SeedVideoReference } {
  const id = replicaSlotRefId(slot.category, slot.id);
  const reference: SeedVideoReference = {
    id,
    label: slot.label,
    role: "seed-material",
    ossUrl,
  };
  const others = references.filter((r) => r.id !== id);
  const managed = references.filter((r) => isReplicaManagedRefId(r.id) && r.id !== id);
  const nonManaged = references.filter((r) => !isReplicaManagedRefId(r.id));
  const orderedSlots = [...managed.filter((r) => isReplicaSlotRefId(r.id)), reference].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  return { references: [...nonManaged, ...orderedSlots], reference };
}

/** @deprecated 旧多图追加；新流程请用 upsertReplicaSlotReference */
export function appendReplicaReference(
  references: SeedVideoReference[],
  role: ReplicaRefRole,
  ossUrl: string,
): { references: SeedVideoReference[]; reference: SeedVideoReference } {
  const existing =
    role === "model" ? listReplicaModelRefs(references) : listReplicaProductRefs(references);
  if (existing.length >= REPLICA_REF_MAX_PER_ROLE) {
    throw new Error(
      role === "model"
        ? `模特图最多 ${REPLICA_REF_MAX_PER_ROLE} 张`
        : `产品图最多 ${REPLICA_REF_MAX_PER_ROLE} 张`,
    );
  }

  const reference: SeedVideoReference = {
    id: createReplicaRefId(role),
    label: nextReplicaRefLabel(role, references),
    role: "seed-material",
    ossUrl,
  };

  const replicaIds = new Set(
    references.filter((r) => isReplicaModelRefId(r.id) || isReplicaProductRefId(r.id)).map((r) => r.id),
  );
  const others = references.filter((r) => !replicaIds.has(r.id));
  const replicaRefs = listReplicaRefs(references);
  if (role === "model") {
    replicaRefs.splice(listReplicaModelRefs(references).length, 0, reference);
  } else {
    replicaRefs.push(reference);
  }

  return { references: [...others, ...replicaRefs], reference };
}

export function removeReplicaReference(
  references: SeedVideoReference[],
  refId: string,
): SeedVideoReference[] {
  if (!isReplicaManagedRefId(refId)) {
    throw new Error("无效的复刻参考图");
  }
  return references.filter((r) => r.id !== refId);
}

export function resolveReplicaCollectPhase(
  references: SeedVideoReference[],
  plan?: ReplicaAssetPlan | null,
): string {
  if (plan && listReplicaAssetPlanSlots(plan).length > 0) {
    const hasAnyUpload = listReplicaSlotRefs(references).length > 0;
    return hasAnyUpload ? "ready" : "asset-upload";
  }
  const hasModel = listReplicaModelRefs(references).length > 0;
  const hasProduct = listReplicaProductRefs(references).length > 0;
  if (!hasModel) return "model";
  if (!hasProduct) return "product";
  return "product-info";
}

export function primaryReplicaModelRef(references: SeedVideoReference[]): SeedVideoReference | undefined {
  const charRef = listReplicaSlotRefs(references).find(
    (r) => parseReplicaSlotRefId(r.id)?.category === "character",
  );
  if (charRef) return charRef;
  return listReplicaModelRefs(references)[0];
}

export function primaryReplicaProductRef(references: SeedVideoReference[]): SeedVideoReference | undefined {
  const productRef = listReplicaSlotRefs(references).find(
    (r) => parseReplicaSlotRefId(r.id)?.category === "product",
  );
  if (productRef) return productRef;
  return listReplicaProductRefs(references)[0];
}

export function collectUploadedReplicaSlotIds(references: SeedVideoReference[]): Set<string> {
  const ids = new Set<string>();
  for (const ref of listReplicaSlotRefs(references)) {
    const slotId = parseReplicaSlotRefId(ref.id)?.slotId;
    if (slotId) ids.add(slotId);
  }
  return ids;
}

const REPLICA_SEMANTIC_TOKEN_RE =
  /@(?:人物[A-F\d]+|产品\d+|道具\d+|场景\d+|产品实拍\d+|参考图\d+|模特\d+|图片\d+)/g;

/** 移除 Prompt 中未上传（非 replace）槽位的 @token，避免 inherit 槽被误引用 */
export function sanitizeReplicaPromptTokens(
  text: string,
  allowedTokens: ReadonlySet<string>,
): string {
  if (!text.trim()) return text;
  return text
    .replace(REPLICA_SEMANTIC_TOKEN_RE, (token) => (allowedTokens.has(token) ? token : ""))
    .replace(/[，,]\s*[，,]+/g, "，")
    .replace(/^[，,\s]+|[，,\s]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** 已上传 replace 槽的 token 集合 */
export function allowedReplicaMentionTokens(catalog: ReplicaMentionEntry[]): Set<string> {
  return new Set(catalog.map((e) => e.token));
}

/** 从 Prompt 解析已上传槽位的参考图 URL（语义 token 优先，兼容 @图片N） */
export function resolveReplicaMentionImageUrls(
  text: string,
  catalog: ReplicaMentionEntry[],
  references: SeedVideoReference[],
  max: number,
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const tokenToUrl = new Map(catalog.map((e) => [e.token, e.ref.ossUrl.trim()]));
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const m of trimmed.matchAll(REPLICA_SEMANTIC_TOKEN_RE)) {
    const token = m[0]!;
    const url = tokenToUrl.get(token);
    if (url && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  if (urls.length > 0) return urls.slice(0, max);

  const materials = references.filter((r) => r.role === "seed-material");
  for (const m of trimmed.matchAll(/@图片(\d+)/g)) {
    const n = Number.parseInt(m[1] ?? "", 10);
    const ref = materials[n - 1];
    const url = ref?.ossUrl?.trim();
    if (url && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  if (urls.length > 0) return urls.slice(0, max);

  return catalog
    .map((e) => e.ref.ossUrl.trim())
    .filter((u) => u && !seen.has(u) && (seen.add(u), true))
    .slice(0, max);
}
