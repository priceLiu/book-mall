import { z } from "zod";

import {
  DETAIL_PAGE_VISION_INVENTORY_SCHEMA_VERSION,
  DETAIL_PAGE_VISION_CLASSIFY_SCHEMA_VERSION,
} from "./inventory-constants";
import { extractFenceJson } from "./schemas";

export { extractFenceJson };

const VisualDetailSchema = z.object({
  model: z.string().optional(),
  garment: z.string().optional(),
  background: z.string().optional(),
  scene: z.string().optional(),
  lighting: z.string().optional(),
  pose: z.string().optional(),
  props: z.string().optional(),
  onImageText: z.string().optional(),
});

export const DetailPageVisionSegmentSchema = z.object({
  segmentIndex: z.number().int().min(1).optional(),
  item_key: z.string().min(1),
  item_label: z.string().min(1),
  layoutHint: z.string().optional(),
  referenceCopyHints: z.array(z.string()).optional(),
  visualDetail: VisualDetailSchema.optional(),
});

export type DetailPageVisionSegment = z.infer<typeof DetailPageVisionSegmentSchema>;

export const DetailPageVisionInventorySchema = z.object({
  schemaVersion: z.string().optional(),
  categoryKey: z.string().optional(),
  referenceSummary: z.string().optional(),
  sharedVisualBrief: z.string().optional(),
  segments: z.array(DetailPageVisionSegmentSchema).min(0),
});

export type DetailPageVisionInventory = z.infer<typeof DetailPageVisionInventorySchema>;

export type ReplicaSegmentMappingEntry = {
  module_id: string | null;
  source: "auto" | "manual";
  confidence?: "high" | "low";
};

export type ReplicaSegmentMapping = Record<string, ReplicaSegmentMappingEntry>;

const ClassifyRowSchema = z.object({
  item_key: z.string().min(1),
  module_id: z.string().nullable(),
  confidence: z.enum(["high", "low"]),
});

export const DetailPageVisionClassifyBatchSchema = z.object({
  schemaVersion: z.string().optional(),
  mappings: z.array(ClassifyRowSchema),
});

export type DetailPageVisionClassifyBatch = z.infer<
  typeof DetailPageVisionClassifyBatchSchema
>;

function coerceOptionalString(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") {
    const t = v.trim();
    return t || undefined;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return undefined;
}

function coerceReferenceCopyHints(v: unknown): string[] | undefined {
  if (v == null) return undefined;
  if (Array.isArray(v)) {
    const arr = v.map((x) => String(x).trim()).filter(Boolean);
    return arr.length ? arr : undefined;
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return undefined;
    const lines = t.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    return lines.length ? lines : [t];
  }
  return undefined;
}

export function coerceDetailPageVisionInventoryRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const root = raw as Record<string, unknown>;
  const segmentsIn = Array.isArray(root.segments) ? root.segments : [];
  const segments = segmentsIn.map((it, index) => {
    if (!it || typeof it !== "object") {
      return {
        segmentIndex: index + 1,
        item_key: `seg_${index + 1}`,
        item_label: `画面 ${index + 1}`,
      };
    }
    const row = it as Record<string, unknown>;
    const item_key =
      coerceOptionalString(row.item_key) ?? `seg_${index + 1}`;
    const item_label =
      coerceOptionalString(row.item_label) ?? `画面 ${index + 1}`;
    const out: Record<string, unknown> = {
      segmentIndex:
        typeof row.segmentIndex === "number" ? row.segmentIndex : index + 1,
      item_key,
      item_label,
    };
    const layoutHint = coerceOptionalString(row.layoutHint);
    if (layoutHint) out.layoutHint = layoutHint;
    const hints = coerceReferenceCopyHints(row.referenceCopyHints);
    if (hints) out.referenceCopyHints = hints;
    if (row.visualDetail && typeof row.visualDetail === "object") {
      out.visualDetail = row.visualDetail;
    }
    return out;
  });
  return { ...root, segments };
}

export function normalizeDetailPageVisionInventory(raw: unknown): DetailPageVisionInventory {
  const coerced = coerceDetailPageVisionInventoryRaw(raw);
  const parsed = DetailPageVisionInventorySchema.safeParse(coerced);
  if (!parsed.success) {
    throw new Error(
      `清单 JSON 校验失败：${parsed.error.issues.slice(0, 3).map((i) => i.message).join("；")}`,
    );
  }
  const data = parsed.data;
  if (
    data.schemaVersion &&
    data.schemaVersion !== DETAIL_PAGE_VISION_INVENTORY_SCHEMA_VERSION
  ) {
    throw new Error(`不支持的 inventory schemaVersion: ${data.schemaVersion}`);
  }
  const segments = data.segments.map((s, i) => ({
    ...s,
    segmentIndex: s.segmentIndex ?? i + 1,
  }));
  return { ...data, segments };
}

export function normalizeDetailPageVisionClassifyBatch(
  raw: unknown,
  expectedKeys: string[],
): DetailPageVisionClassifyBatch {
  const parsed = DetailPageVisionClassifyBatchSchema.parse(raw);
  if (
    parsed.schemaVersion &&
    parsed.schemaVersion !== DETAIL_PAGE_VISION_CLASSIFY_SCHEMA_VERSION
  ) {
    throw new Error(`不支持的 classify schemaVersion: ${parsed.schemaVersion}`);
  }
  const keySet = new Set(expectedKeys);
  for (const row of parsed.mappings) {
    if (!keySet.has(row.item_key)) {
      throw new Error(`归类含未知 item_key: ${row.item_key}`);
    }
  }
  return parsed;
}
