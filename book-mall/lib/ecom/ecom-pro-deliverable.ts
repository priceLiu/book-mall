import { z } from "zod";

import { derivePanelScenePrompt } from "./ecom-storyboard-scene-prompt";
import type { StoryboardSheet } from "./ecom-storyboard-types";
import { parseStoryboardSheet } from "./ecom-storyboard-types";
import type { StoryboardChatMessage } from "./ecom-storyboard-types";
import {
  extractFashionDeliverable,
  mergeFashionDeliverablePatch,
  type FashionDeliverable,
  type FashionVersionKey,
  fashionVersionToSheet,
  hasMeaningfulOpsPack as fashionHasMeaningfulOpsPack,
  inferFashionPhaseFromDeliverable,
  pickFashionOpsMergePatch,
  readMetaFashionDeliverable,
  stripFashionDeliverableFence,
} from "./ecom-fashion-deliverable";
import {
  getProVerticalConfig,
  isProVerticalId,
  type ProVerticalId,
} from "@/lib/ecom/pro-vertical/registry";
import { PRO_SHOT_SCALE_BY_INDEX } from "@/lib/ecom/pro-vertical/shared-enums";

/** @see book-mall/doc/ecom/pro-deliverable-spec-v1.md */
export const PRO_SCHEMA_VERSION = "pro-v1" as const;

export const proVersionKeySchema = z.enum(["A", "B", "C", "D", "E"]);

export const proSellpointLayerSchema = z.enum(["core", "visual", "aux"]);
export const proSellpointSourceSchema = z.enum(["user", "ai", "supplemented"]);

export const proSellpointSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  layer: proSellpointLayerSchema,
  source: proSellpointSourceSchema,
});

export const proVoiceoverSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  narrative: z.string().min(1),
  script: z.string().min(1),
});

export const proPanelRowSchema = z.object({
  index: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  shotScale: z.string().min(1),
  durationSec: z.number().positive(),
  cameraMove: z.string().min(1),
  sceneDesc: z.string().min(1),
  scenePrompt: z.string().min(20),
  modelAction: z.string().min(1),
  productFocus: z.string().min(1),
  dialogue: z.string().optional(),
  toneTexture: z.string().optional(),
  sellpointIds: z.array(z.string()).default([]),
  imagePrompt: z.string().min(20),
  videoPrompt: z.string().min(20),
});

export const proStoryboardVersionSchema = z.object({
  id: proVersionKeySchema,
  title: z.string().min(1),
  summary: z.string().optional(),
  panels: z.array(proPanelRowSchema).length(6),
  totalDurationSec: z.number().positive().optional(),
});

export const proCoverageRowSchema = z.object({
  sellpointId: z.string().min(1),
  sellpointText: z.string().min(1),
  layer: proSellpointLayerSchema,
  panelIndexes: z.array(z.number().int().positive()),
  covered: z.boolean(),
});

export const proOpsPackSchema = z.object({
  titles: z.array(z.string()).optional(),
  coverWords: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  xiaohongshuBody: z.string().optional(),
  detailBullets: z.array(z.string()).optional(),
});

export const proOutputModeSchema = z.enum(["script_compose", "direct_video"]);

export const proVerticalIdSchema = z.enum(["fashion_apparel", "bags", "digital_3c"]);

export const proDeliverableSchema = z.object({
  schemaVersion: z.literal(PRO_SCHEMA_VERSION),
  vertical: proVerticalIdSchema,
  productName: z.string().min(1),
  dimensions: z.record(z.string(), z.string()).default({}),
  sellpoints: z.array(proSellpointSchema).default([]),
  sellpointsLocked: z.boolean().default(false),
  voiceovers: z.array(proVoiceoverSchema).default([]),
  selectedVoiceoverId: z.string().nullable().optional(),
  storyboardVersions: z.record(proVersionKeySchema, proStoryboardVersionSchema).optional(),
  selectedVersion: proVersionKeySchema.nullable().optional(),
  storyboardLocked: z.boolean().default(false),
  coverageChecklist: z.array(proCoverageRowSchema).default([]),
  opsPack: proOpsPackSchema.optional(),
  outputMode: proOutputModeSchema.nullable().optional(),
});

export type ProDeliverable = z.infer<typeof proDeliverableSchema>;
export type ProPanelRow = z.infer<typeof proPanelRowSchema>;
export type ProVersionKey = z.infer<typeof proVersionKeySchema>;

function roundDuration(sec: number): number {
  return Math.round(sec * 2) / 2;
}

function coerceSellpointIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v).trim()).filter(Boolean);
}

function coerceProPanels(raw: unknown, vertical: ProVerticalId): unknown {
  if (!Array.isArray(raw)) return raw;
  const config = getProVerticalConfig(vertical);
  const focusFallback = config?.panelFocusLabel.replace(/重点$/, "展示") ?? "产品展示";
  return raw.map((panel, idx) => {
    if (!panel || typeof panel !== "object") return panel;
    const p = panel as Record<string, unknown>;
    const index = typeof p.index === "number" ? p.index : idx + 1;
    const sceneDesc =
      typeof p.sceneDesc === "string" && p.sceneDesc.trim()
        ? p.sceneDesc.trim()
        : typeof p.scene === "string" && p.scene.trim()
          ? p.scene.trim()
          : "—";
    const modelAction =
      typeof p.modelAction === "string" && p.modelAction.trim()
        ? p.modelAction.trim()
        : typeof p.action === "string" && p.action.trim()
          ? p.action.trim()
          : sceneDesc;
    const productFocus =
      typeof p.productFocus === "string" && p.productFocus.trim()
        ? p.productFocus.trim()
        : typeof p.garmentFocus === "string" && p.garmentFocus.trim()
          ? p.garmentFocus.trim()
          : typeof p.productBeat === "string" && p.productBeat.trim()
            ? p.productBeat.trim()
            : focusFallback;
    const scenePromptRaw =
      typeof p.scenePrompt === "string" && p.scenePrompt.trim()
        ? p.scenePrompt.trim()
        : derivePanelScenePrompt({ scene: sceneDesc, scenePrompt: undefined });
    const scenePrompt =
      scenePromptRaw.length >= 20
        ? scenePromptRaw
        : `${sceneDesc}，写实自然光，与${vertical === "bags" ? "包袋" : vertical === "digital_3c" ? "数码产品" : "产品"}品类匹配的环境与道具`;
    const imagePromptRaw =
      typeof p.imagePrompt === "string" && p.imagePrompt.trim() ? p.imagePrompt.trim() : "";
    const imagePrompt =
      imagePromptRaw.length >= 20
        ? imagePromptRaw
        : `竖版9:16，写实UGC摄影。场景：${scenePrompt}。模特${modelAction}，展示${productFocus}，以参考图1产品为准，禁止画面文字。`;
    const videoPromptRaw =
      typeof p.videoPrompt === "string" && p.videoPrompt.trim()
        ? p.videoPrompt.trim()
        : typeof p.videoPromptEn === "string" && p.videoPromptEn.trim()
          ? p.videoPromptEn.trim()
          : "";
    const videoPrompt =
      videoPromptRaw.length >= 20
        ? videoPromptRaw
        : `${p.cameraMove ?? "固定"}运镜，${modelAction}，场景${sceneDesc}，${config?.panelFocusLabel ?? "展示重点"}${productFocus}，UGC质感连贯动作`;
    return {
      ...p,
      index,
      shotScale:
        typeof p.shotScale === "string" && p.shotScale.trim()
          ? p.shotScale.trim()
          : PRO_SHOT_SCALE_BY_INDEX[index] ?? "中景",
      durationSec:
        typeof p.durationSec === "number" && p.durationSec > 0 ? roundDuration(p.durationSec) : 4,
      cameraMove:
        typeof p.cameraMove === "string" && p.cameraMove.trim()
          ? p.cameraMove.trim()
          : "固定",
      sceneDesc,
      scenePrompt,
      modelAction,
      productFocus,
      sellpointIds: coerceSellpointIds(p.sellpointIds),
      imagePrompt,
      videoPrompt,
    };
  });
}

function fashionToProDeliverable(f: FashionDeliverable): ProDeliverable {
  const versions = f.storyboardVersions ?? {};
  const proVersions: ProDeliverable["storyboardVersions"] = {};
  for (const key of ["A", "B", "C", "D", "E"] as const) {
    const v = versions[key];
    if (!v) continue;
    proVersions[key] = {
      ...v,
      panels: v.panels.map((p) => ({
        ...p,
        productFocus: p.garmentFocus,
      })) as ProPanelRow[],
    };
  }
  return {
    schemaVersion: PRO_SCHEMA_VERSION,
    vertical: "fashion_apparel",
    productName: f.productName,
    dimensions: { ...(f.dimensions as Record<string, string>) },
    sellpoints: f.sellpoints,
    sellpointsLocked: f.sellpointsLocked,
    voiceovers: f.voiceovers,
    selectedVoiceoverId: f.selectedVoiceoverId ?? null,
    storyboardVersions: proVersions,
    selectedVersion: f.selectedVersion ?? null,
    storyboardLocked: f.storyboardLocked ?? false,
    coverageChecklist: f.coverageChecklist,
    opsPack: f.opsPack,
    outputMode: f.outputMode ?? null,
  };
}

export function normalizeToProDeliverable(raw: unknown): ProDeliverable | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion === "fashion-v4" || o.vertical === "fashion_apparel") {
    const fashion = readMetaFashionDeliverable(raw);
    return fashion ? fashionToProDeliverable(fashion) : null;
  }
  const vertical = o.vertical;
  if (!isProVerticalId(typeof vertical === "string" ? vertical : null)) return null;
  const coerced = { ...o };
  if (coerced.storyboardVersions && typeof coerced.storyboardVersions === "object") {
    const next: Record<string, unknown> = {};
    for (const key of ["A", "B", "C", "D", "E"]) {
      const version = (coerced.storyboardVersions as Record<string, unknown>)[key];
      if (!version || typeof version !== "object") continue;
      const v = version as Record<string, unknown>;
      next[key] = { ...v, id: key, panels: coerceProPanels(v.panels, vertical as ProVerticalId) };
    }
    coerced.storyboardVersions = next;
  }
  const result = proDeliverableSchema.safeParse(coerced);
  if (result.success) return result.data;
  if (coerced.schemaVersion === PRO_SCHEMA_VERSION) return coerced as ProDeliverable;
  return null;
}

export function isProDeliverable(raw: unknown): raw is ProDeliverable {
  return proDeliverableSchema.safeParse(raw).success;
}

function tryParseProCandidate(jsonRaw: string, vertical: ProVerticalId): ProDeliverable | null {
  try {
    const parsed = JSON.parse(jsonRaw) as Record<string, unknown>;
    parsed.schemaVersion = PRO_SCHEMA_VERSION;
    parsed.vertical = vertical;
    if (parsed.storyboardVersions) {
      const obj = parsed.storyboardVersions as Record<string, unknown>;
      for (const key of ["A", "B", "C", "D", "E"]) {
        const version = obj[key];
        if (!version || typeof version !== "object") continue;
        const v = version as Record<string, unknown>;
        obj[key] = { ...v, id: key, panels: coerceProPanels(v.panels, vertical) };
      }
    }
    const result = proDeliverableSchema.safeParse(parsed);
    if (result.success) return result.data;
    if (parsed.vertical === vertical) return parsed as ProDeliverable;
  } catch {
    /* */
  }
  return null;
}

export function stripProDeliverableFence(text: string): string {
  let out = text
    .replace(/```pro-deliverable[\s\S]*?```/gi, "")
    .replace(/```fashion-deliverable[\s\S]*?```/gi, "")
    .replace(/```json[\s\S]*?```/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim();
  const jsonStart = out.search(
    /\{\s*"schemaVersion"\s*:\s*"(?:pro-v1|fashion-v4)"|\{\s*"vertical"\s*:\s*"(?:fashion_apparel|bags|digital_3c)"/,
  );
  if (jsonStart >= 0) out = out.slice(0, jsonStart).trim();
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

export function extractProDeliverable(
  text: string,
  vertical: ProVerticalId = "bags",
): ProDeliverable | null {
  const trimmed = text.trim();
  for (const fence of [/```pro-deliverable\s*([\s\S]*?)```/i, /```fashion-deliverable\s*([\s\S]*?)```/i]) {
    const m = trimmed.match(fence);
    if (m?.[1]) {
      const parsed = tryParseProCandidate(m[1].trim(), vertical);
      if (parsed) return parsed;
    }
  }
  const generic = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (generic?.[1]) {
    const parsed = tryParseProCandidate(generic[1].trim(), vertical);
    if (parsed) return parsed;
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return tryParseProCandidate(trimmed.slice(start, end + 1), vertical);
  }
  return null;
}

export function hasMeaningfulOpsPack(d: ProDeliverable): boolean {
  const ops = d.opsPack;
  if (!ops) return false;
  return Boolean(
    (ops.titles?.length ?? 0) > 0 ||
      (ops.coverWords?.length ?? 0) > 0 ||
      (ops.tags?.length ?? 0) > 0 ||
      (ops.detailBullets?.length ?? 0) > 0 ||
      Boolean(ops.xiaohongshuBody?.trim()),
  );
}

export function inferProPhaseFromDeliverable(d: ProDeliverable): string {
  if (!d.sellpoints?.length || !d.sellpointsLocked) return "sellpoints";
  if ((d.voiceovers?.length ?? 0) === 0) return "sellpoints";
  if (!d.selectedVoiceoverId) return "voiceover_pick";
  const versionCount = (["A", "B", "C", "D", "E"] as const).filter((k) => {
    const v = d.storyboardVersions?.[k];
    return Boolean(v?.panels?.length || v?.title?.trim());
  }).length;
  if (versionCount === 0) return "voiceover_pick";
  if (!d.selectedVersion) return "storyboard_pick";
  if (!d.storyboardLocked) return "storyboard_confirm";
  if (!hasMeaningfulOpsPack(d)) return "storyboard_confirm";
  if (!d.outputMode) return "output_mode";
  return "produce";
}

export function pickProOpsMergePatch(
  patch: Partial<ProDeliverable>,
  opts: { storyboardLocked: boolean; opsPhase: boolean },
): Partial<ProDeliverable> {
  if (!opts.opsPhase || !opts.storyboardLocked) return patch;
  if (patch.opsPack == null) return {};
  return { opsPack: patch.opsPack };
}

export function mergeProDeliverablePatch(
  existing: ProDeliverable | null | undefined,
  patch: Partial<ProDeliverable>,
  vertical: ProVerticalId,
  productName?: string,
): ProDeliverable {
  const config = getProVerticalConfig(vertical);
  const base: ProDeliverable =
    existing ??
    ({
      schemaVersion: PRO_SCHEMA_VERSION,
      vertical,
      productName: productName?.trim() || config?.projectTitle || "商品",
      dimensions: {},
      sellpoints: [],
      sellpointsLocked: false,
      voiceovers: [],
      selectedVoiceoverId: null,
      storyboardVersions: {},
      selectedVersion: null,
      storyboardLocked: false,
      coverageChecklist: [],
      outputMode: null,
    } satisfies ProDeliverable);

  const merged: ProDeliverable = {
    ...base,
    ...patch,
    schemaVersion: PRO_SCHEMA_VERSION,
    vertical,
    productName: patch.productName?.trim() || base.productName,
    dimensions: (() => {
      const next = { ...base.dimensions };
      for (const [key, value] of Object.entries(patch.dimensions ?? {})) {
        if (typeof value === "string" && value.trim()) next[key] = value.trim();
      }
      return next;
    })(),
    sellpoints:
      base.sellpointsLocked && base.sellpoints?.length
        ? base.sellpoints
        : patch.sellpoints?.length
          ? patch.sellpoints
          : base.sellpoints,
    sellpointsLocked: base.sellpointsLocked || Boolean(patch.sellpointsLocked),
    voiceovers: patch.voiceovers?.length ? patch.voiceovers : base.voiceovers,
    selectedVoiceoverId:
      patch.selectedVoiceoverId != null && patch.selectedVoiceoverId !== ""
        ? patch.selectedVoiceoverId
        : (base.selectedVoiceoverId ?? null),
    storyboardVersions: {
      ...(base.storyboardVersions ?? {}),
      ...(patch.storyboardVersions ?? {}),
    },
    selectedVersion:
      patch.selectedVersion != null ? patch.selectedVersion : (base.selectedVersion ?? null),
    storyboardLocked: base.storyboardLocked || Boolean(patch.storyboardLocked),
    coverageChecklist: patch.coverageChecklist ?? base.coverageChecklist,
    opsPack:
      base.storyboardLocked || patch.storyboardLocked
        ? { ...(base.opsPack ?? {}), ...(patch.opsPack ?? {}) }
        : base.opsPack,
    outputMode:
      base.storyboardLocked || patch.storyboardLocked
        ? (patch.outputMode ?? base.outputMode)
        : null,
  };

  if (!merged.storyboardLocked) {
    merged.opsPack = undefined;
    merged.outputMode = null;
  }
  if (!merged.sellpointsLocked) {
    merged.voiceovers = [];
    merged.selectedVoiceoverId = null;
    merged.storyboardVersions = {};
    merged.selectedVersion = null;
    merged.coverageChecklist = [];
  }

  const coerced = { ...merged };
  if (coerced.storyboardVersions) {
    for (const key of ["A", "B", "C", "D", "E"] as const) {
      const v = coerced.storyboardVersions[key];
      if (!v) continue;
      coerced.storyboardVersions[key] = {
        ...v,
        panels: coerceProPanels(v.panels, vertical) as ProPanelRow[],
      };
    }
  }
  const result = proDeliverableSchema.safeParse(coerced);
  return result.success ? result.data : (coerced as ProDeliverable);
}

export function proVersionToSheet(
  deliverable: ProDeliverable,
  versionKey?: ProVersionKey,
): StoryboardSheet | null {
  const key = versionKey ?? deliverable.selectedVersion;
  if (!key) return null;
  const version = deliverable.storyboardVersions?.[key];
  if (!version?.panels?.length) return null;

  const sellpoints = deliverable.sellpoints ?? [];
  const highlight = sellpoints
    .filter((sp) => sp.layer === "core")
    .map((sp) => sp.text)
    .join("；");

  const voiceovers = deliverable.voiceovers ?? [];
  const config = getProVerticalConfig(deliverable.vertical);
  const sheet = {
    overview: {
      title: version.title || `${config?.label ?? "专业版"}分镜 ${key} 版`,
      logline:
        version.summary?.trim() ||
        voiceovers.find((v) => v.id === deliverable.selectedVoiceoverId)?.narrative ||
        deliverable.productName,
      productHighlight: highlight || undefined,
    },
    cast: [],
    panels: version.panels.map((p, idx) => {
      const index = typeof p.index === "number" ? p.index : idx + 1;
      const scene = p.sceneDesc?.trim() || "—";
      const action = p.modelAction?.trim() || scene;
      const globalAnchor = deliverable.dimensions?.customScene?.trim();
      const scenePrompt =
        p.scenePrompt?.trim() ||
        derivePanelScenePrompt({ scene, scenePrompt: undefined }, globalAnchor);
      return {
        index,
        shotType: p.shotScale?.trim() || "中景",
        scene,
        scenePrompt: scenePrompt || undefined,
        action,
        dialogue: p.dialogue?.trim() || undefined,
        camera: p.cameraMove?.trim() || "固定",
        durationHintSec: p.durationSec > 0 ? p.durationSec : 4,
        sellpointTags: p.sellpointIds ?? [],
        imagePrompt: p.imagePrompt?.trim() || undefined,
        videoPromptEn: p.videoPrompt?.trim() || undefined,
        productInteraction: "hold" as const,
        productVisibility: "hero" as const,
        productBeat: p.productFocus?.trim() || config?.panelFocusLabel || "产品展示",
        emotion: p.toneTexture?.trim() || undefined,
      };
    }),
    totalDurationHintSec:
      version.totalDurationSec ??
      version.panels.reduce((sum, p) => sum + (p.durationSec > 0 ? p.durationSec : 4), 0),
  };

  try {
    return parseStoryboardSheet(sheet);
  } catch {
    return null;
  }
}

export function isProInternalLlmTrigger(text: string): boolean {
  const t = text.trim();
  return t.startsWith("pro-step:") || t.startsWith("fashion-step:");
}

export function resolveProPromptPhase(lastUserTurn: string): string {
  if (lastUserTurn.includes("sellpoints")) return "sellpoints";
  if (lastUserTurn.includes("voiceovers")) return "voiceovers";
  if (lastUserTurn.includes("storyboards")) return "storyboards";
  if (lastUserTurn.includes("ops")) return "ops";
  return "general";
}

/** 统一读取：fashion 走 legacy，非 fashion Pro vertical 走 pro-v1 */
export function readUnifiedProDeliverable(
  meta: Record<string, unknown> | null | undefined,
): ProDeliverable | FashionDeliverable | null {
  const wf = (meta?.workflow as { vertical?: string } | undefined) ?? {};
  if (wf.vertical === "fashion_apparel") {
    return readMetaFashionDeliverable(meta?.deliverable) ?? null;
  }
  if (wf.vertical === "bags" || wf.vertical === "digital_3c") {
    return normalizeToProDeliverable(meta?.deliverable) ?? null;
  }
  return null;
}

export {
  extractFashionDeliverable,
  mergeFashionDeliverablePatch,
  fashionVersionToSheet,
  stripFashionDeliverableFence,
  inferFashionPhaseFromDeliverable,
  pickFashionOpsMergePatch,
  fashionHasMeaningfulOpsPack,
};

export type { FashionDeliverable, FashionVersionKey };
