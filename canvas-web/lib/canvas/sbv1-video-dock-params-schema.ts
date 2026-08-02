import type { CanvasParamSchema, CanvasParamSchemaItem } from "@/lib/canvas-providers-api";
import {
  SBV1_ASPECT_RATIOS,
  sbv1AspectRatioLabel,
} from "@/lib/canvas/sbv1-video-models";

const DOCK_HANDLED_KEYS = new Set([
  "ratio",
  "aspect_ratio",
  "resolution",
  "duration",
  "generate_audio",
  "generateAudio",
  "sound",
  "watermark",
]);

const DOCK_HANDLED_LABEL_HINTS = ["画布比例", "清晰度", "时长"];

function matchesHints(
  item: CanvasParamSchemaItem,
  keyHints: string[],
  labelHints: string[],
): boolean {
  const key = item.key.toLowerCase();
  if (keyHints.some((h) => key === h.toLowerCase() || key.includes(h.toLowerCase()))) {
    return true;
  }
  return labelHints.some((h) => item.label.includes(h));
}

export function dedupeParamsSchemaByKey(
  schema: CanvasParamSchema,
): CanvasParamSchema {
  const seen = new Set<string>();
  const out: CanvasParamSchema = [];
  for (const item of schema) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    out.push(item);
  }
  return out;
}

/** Dock 统一面板已接管的字段 · 剩余交给 DynamicParamForm */
export function filterDockVideoParamsSchema(
  schema: CanvasParamSchema | null | undefined,
): CanvasParamSchema {
  if (!schema?.length) return [];
  return dedupeParamsSchemaByKey(schema).filter((item) => {
    if (DOCK_HANDLED_KEYS.has(item.key)) return false;
    if (DOCK_HANDLED_LABEL_HINTS.some((h) => item.label.includes(h))) {
      return false;
    }
    return true;
  });
}

export function findSchemaSelectItem(
  schema: CanvasParamSchema | null | undefined,
  keyHints: string[],
  labelHints: string[] = [],
): Extract<CanvasParamSchemaItem, { type: "select" }> | null {
  if (!schema?.length) return null;
  const item = schema.find(
    (entry): entry is Extract<CanvasParamSchemaItem, { type: "select" }> =>
      entry.type === "select" && matchesHints(entry, keyHints, labelHints),
  );
  return item ?? null;
}

export function findSchemaNumberItem(
  schema: CanvasParamSchema | null | undefined,
  keyHints: string[],
  labelHints: string[] = [],
): Extract<CanvasParamSchemaItem, { type: "number" }> | null {
  if (!schema?.length) return null;
  const item = schema.find(
    (entry): entry is Extract<CanvasParamSchemaItem, { type: "number" }> =>
      entry.type === "number" && matchesHints(entry, keyHints, labelHints),
  );
  return item ?? null;
}

export function aspectOptionsFromVideoSchema(
  schema: CanvasParamSchema | null | undefined,
): { id: string; label: string }[] {
  const select = findSchemaSelectItem(schema, ["ratio", "aspect_ratio"], [
    "画布比例",
    "比例",
  ]);
  if (select?.options.length) {
    return select.options.map((o) => ({ id: o.value, label: o.label }));
  }
  return SBV1_ASPECT_RATIOS.map((r) => ({
    id: r,
    label: sbv1AspectRatioLabel(r),
  }));
}

export function resolutionOptionsFromVideoSchema(
  schema: CanvasParamSchema | null | undefined,
): { id: string; label: string }[] {
  const select = findSchemaSelectItem(schema, ["resolution"], ["清晰度", "分辨率"]);
  if (select?.options.length) {
    return select.options.map((o) => ({ id: o.value, label: o.label }));
  }
  return [
    { id: "720p", label: "720P" },
    { id: "1080p", label: "1080P" },
  ];
}

export function normalizeVideoResolutionId(
  raw: unknown,
  fallback: "720p" | "1080p" | "2k" | "4k" = "720p",
): string {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  const lower = raw.toLowerCase();
  if (lower === "720p") return "720p";
  if (lower === "1080p") return "1080p";
  if (lower === "2k") return "2k";
  if (lower === "4k") return "4k";
  return fallback;
}

export function resolutionSegmentValue(
  raw: unknown,
  options: { id: string; label: string }[],
  fallback: "720p" | "1080p" | "2k" | "4k" = "720p",
): string {
  if (typeof raw === "string" && raw.trim()) {
    const exact = options.find((o) => o.id === raw || o.id.toLowerCase() === raw.toLowerCase());
    if (exact) return exact.id;
  }
  const normalized = normalizeVideoResolutionId(raw, fallback);
  const match = options.find((o) => o.id.toLowerCase() === normalized);
  return match?.id ?? options[0]?.id ?? normalized;
}

export function aspectValueFromParams(
  params: Record<string, unknown>,
  fallback: string,
): string {
  const ar = params.aspect_ratio ?? params.ratio;
  return typeof ar === "string" && ar.trim() ? ar : fallback;
}

export function durationBoundsFromVideoSchema(
  schema: CanvasParamSchema | null | undefined,
): { min: number; max: number; step: number; label: string } {
  const item = findSchemaNumberItem(schema, ["duration"], ["时长", "duration"]);
  if (item) {
    return {
      min: typeof item.min === "number" ? item.min : 4,
      max: typeof item.max === "number" ? item.max : 15,
      step: item.step ?? 1,
      label: item.label.includes("时长") ? item.label : "时长(秒)",
    };
  }
  return { min: 4, max: 15, step: 1, label: "时长(秒)" };
}
