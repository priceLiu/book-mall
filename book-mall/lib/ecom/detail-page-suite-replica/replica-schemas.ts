import { z } from "zod";

import {
  coerceDetailPageVisionDecomposeRaw,
  DETAIL_PAGE_VISION_MODULE_IDS,
  formatDetailPageVisionDecomposeValidationError,
  normalizeDetailPageVisionDecompose,
  type DetailPageVisionDecompose,
  type DetailPageVisionDecomposeItem,
  type DetailPageVisionDecomposeModule,
} from "@/lib/ecom/detail-page-vision-decompose";

import {
  DETAIL_PAGE_SUITE_REPLICA_POLISH_BATCH_SCHEMA_VERSION,
  DETAIL_PAGE_SUITE_REPLICA_POLISH_SCHEMA_VERSION,
} from "@/lib/ecom/detail-page-suite/types";

export { extractFenceJson } from "@/lib/ecom/detail-page-vision-decompose";

/** @deprecated 使用 DETAIL_PAGE_VISION_MODULE_IDS */
export const REPLICA_MODULE_IDS = DETAIL_PAGE_VISION_MODULE_IDS;

export type ReplicaPhaseA = DetailPageVisionDecompose;
export type ReplicaPhaseAModule = DetailPageVisionDecomposeModule;
export type ReplicaPhaseAItem = DetailPageVisionDecomposeItem;

export function assertReplicaModuleOrder(modules: ReplicaPhaseA["modules"]): string | null {
  for (let i = 0; i < REPLICA_MODULE_IDS.length; i++) {
    if (modules[i]?.module_id !== REPLICA_MODULE_IDS[i]) {
      return `模块顺序或 id 不匹配：期望 ${REPLICA_MODULE_IDS[i]}`;
    }
  }
  return null;
}

export function coerceReplicaPhaseARaw(raw: unknown): unknown {
  return coerceDetailPageVisionDecomposeRaw(raw);
}

export function formatReplicaPhaseAValidationError(err: z.ZodError): string {
  return formatDetailPageVisionDecomposeValidationError(err);
}

export function normalizeReplicaPhaseA(raw: unknown): ReplicaPhaseA {
  return normalizeDetailPageVisionDecompose(raw);
}

const PolishItemSchema = z.object({
  item_key: z.string().min(1),
  item_label: z.string().min(1),
  positive_prompt: z.string().min(8),
  negative_prompt: z.string().optional(),
});

export const ReplicaPhaseBModuleSchema = z.object({
  schemaVersion: z.string().optional(),
  module_id: z.string().min(1),
  items: z.array(PolishItemSchema).min(0),
});

export type ReplicaPhaseBModule = z.infer<typeof ReplicaPhaseBModuleSchema>;

export function normalizeReplicaPhaseBModule(raw: unknown): ReplicaPhaseBModule {
  const parsed = ReplicaPhaseBModuleSchema.parse(raw);
  if (
    parsed.schemaVersion &&
    parsed.schemaVersion !== DETAIL_PAGE_SUITE_REPLICA_POLISH_SCHEMA_VERSION
  ) {
    throw new Error(`不支持的 polish schemaVersion: ${parsed.schemaVersion}`);
  }
  return parsed;
}

export const ReplicaPhaseBBatchSchema = z.object({
  schemaVersion: z.string().optional(),
  modules: z.array(ReplicaPhaseBModuleSchema).min(1),
});

export type ReplicaPhaseBBatch = z.infer<typeof ReplicaPhaseBBatchSchema>;

export function normalizeReplicaModuleIds(moduleIds: string[]): string[] {
  const set = new Set(moduleIds.map((id) => id.trim()).filter(Boolean));
  return REPLICA_MODULE_IDS.filter((id) => set.has(id));
}

export function normalizeReplicaPhaseBBatch(
  raw: unknown,
  expectedModuleIds: string[],
): ReplicaPhaseBBatch {
  const parsed = ReplicaPhaseBBatchSchema.parse(raw);
  if (
    parsed.schemaVersion &&
    parsed.schemaVersion !== DETAIL_PAGE_SUITE_REPLICA_POLISH_BATCH_SCHEMA_VERSION
  ) {
    throw new Error(`不支持的 polish batch schemaVersion: ${parsed.schemaVersion}`);
  }
  if (parsed.modules.length !== expectedModuleIds.length) {
    throw new Error(
      `润色返回模块数 ${parsed.modules.length} 与请求 ${expectedModuleIds.length} 不一致`,
    );
  }
  for (let i = 0; i < expectedModuleIds.length; i++) {
    if (parsed.modules[i]?.module_id !== expectedModuleIds[i]) {
      throw new Error(
        `润色模块顺序或 id 不匹配：期望 ${expectedModuleIds[i]}，得到 ${parsed.modules[i]?.module_id ?? "缺失"}`,
      );
    }
  }
  return parsed;
}
