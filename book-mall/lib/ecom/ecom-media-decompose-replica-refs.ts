import { randomUUID } from "crypto";

import {
  REPLICA_MODEL_REF_ID,
  REPLICA_PRODUCT_REF_ID,
} from "@/lib/ecom/ecom-media-decompose-replica-constants";
import type { SeedVideoReference } from "@/lib/ecom/ecom-seed-video-types";

export const REPLICA_REF_MAX_PER_ROLE = 6;

export type ReplicaRefRole = "model" | "product";

export type ReplicaMentionEntry = {
  ref: SeedVideoReference;
  token: string;
  index: number;
  role: ReplicaRefRole;
};

export function isReplicaModelRefId(id: string): boolean {
  return id === REPLICA_MODEL_REF_ID || id.startsWith("ref-replica-model-");
}

export function isReplicaProductRefId(id: string): boolean {
  return id === REPLICA_PRODUCT_REF_ID || id.startsWith("ref-replica-product-");
}

export function listReplicaModelRefs(references: SeedVideoReference[]): SeedVideoReference[] {
  return references.filter((r) => isReplicaModelRefId(r.id) && r.ossUrl?.trim());
}

export function listReplicaProductRefs(references: SeedVideoReference[]): SeedVideoReference[] {
  return references.filter((r) => isReplicaProductRefId(r.id) && r.ossUrl?.trim());
}

export function listReplicaRefs(references: SeedVideoReference[]): SeedVideoReference[] {
  return [...listReplicaModelRefs(references), ...listReplicaProductRefs(references)];
}

export function buildReplicaMentionCatalog(references: SeedVideoReference[]): ReplicaMentionEntry[] {
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
  if (catalog.length === 0) return "（尚无参考图）";
  const modelTokens = catalog.filter((e) => e.role === "model").map((e) => e.token);
  const productTokens = catalog.filter((e) => e.role === "product").map((e) => e.token);
  const parts: string[] = [];
  if (modelTokens.length) parts.push(`模特图：${modelTokens.join("、")}`);
  if (productTokens.length) parts.push(`产品图：${productTokens.join("、")}`);
  return parts.join("；");
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
  if (!isReplicaModelRefId(refId) && !isReplicaProductRefId(refId)) {
    throw new Error("无效的复刻参考图");
  }
  return references.filter((r) => r.id !== refId);
}

export function resolveReplicaCollectPhase(references: SeedVideoReference[]): string {
  const hasModel = listReplicaModelRefs(references).length > 0;
  const hasProduct = listReplicaProductRefs(references).length > 0;
  if (!hasModel) return "model";
  if (!hasProduct) return "product";
  return "product-info";
}

export function primaryReplicaModelRef(references: SeedVideoReference[]): SeedVideoReference | undefined {
  return listReplicaModelRefs(references)[0];
}

export function primaryReplicaProductRef(references: SeedVideoReference[]): SeedVideoReference | undefined {
  return listReplicaProductRefs(references)[0];
}
