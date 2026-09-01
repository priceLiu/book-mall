import {
  REPLICA_MODEL_REF_ID,
  REPLICA_PRODUCT_REF_ID,
} from "@/lib/media-decompose-replica-constants";
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
  return [...listReplicaModelRefs(references), ...listReplicaProductRefs(references)].map(
    (_, i) => `@图片${i + 1}`,
  );
}
