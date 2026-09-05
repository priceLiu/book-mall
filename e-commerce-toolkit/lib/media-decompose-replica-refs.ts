import {
  REPLICA_MODEL_REF_ID,
  REPLICA_PRODUCT_REF_ID,
} from "@/lib/media-decompose-replica-constants";
import type { EcomPromptImageRef } from "@/lib/ecom-prompt-mention";
import type { SeedVideoReference } from "@/lib/seed-video-types";

export const REPLICA_REF_MAX_PER_ROLE = 6;

export type ReplicaRefRole = "model" | "product";

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

export function hasReplicaModelRefs(references: SeedVideoReference[]): boolean {
  return listReplicaModelRefs(references).length > 0;
}

export function hasReplicaProductRefs(references: SeedVideoReference[]): boolean {
  return listReplicaProductRefs(references).length > 0;
}

export function buildReplicaMentionTokens(references: SeedVideoReference[]): string[] {
  return buildReplicaMentionRefs(references).map((ref) => ref.token);
}

/** 模特 ref 先编号，再产品 ref — 与拉片 @图片N 规则一致 */
export function buildReplicaMentionRefs(
  references: SeedVideoReference[],
): EcomPromptImageRef[] {
  const entries: EcomPromptImageRef[] = [];
  let index = 1;

  let modelIdx = 0;
  for (const ref of listReplicaModelRefs(references)) {
    modelIdx += 1;
    entries.push({
      index,
      token: `@图片${index}`,
      kind: "model",
      kindIndex: modelIdx,
      url: ref.ossUrl,
      label: ref.label?.trim() || `模特 ${modelIdx}`,
      role: "model",
    });
    index += 1;
  }

  let productIdx = 0;
  for (const ref of listReplicaProductRefs(references)) {
    productIdx += 1;
    entries.push({
      index,
      token: `@图片${index}`,
      kind: "product",
      kindIndex: productIdx,
      url: ref.ossUrl,
      label: ref.label?.trim() || `产品 ${productIdx}`,
      role: "product",
    });
    index += 1;
  }

  return entries;
}
