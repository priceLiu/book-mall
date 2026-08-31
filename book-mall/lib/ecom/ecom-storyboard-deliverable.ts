import { z } from "zod";

import { derivePanelScenePrompt } from "./ecom-storyboard-scene-prompt";
import { parseStoryboardSheet, type StoryboardSheet } from "./ecom-storyboard-types";

/** @see book-mall/doc/ecom/storyboard-deliverable-spec-v2.md */
export const storyboardProductInteractionSchema = z.enum([
  "none",
  "hold",
  "wear",
  "use",
  "apply",
  "display",
  "unbox",
]);

export const storyboardProductVisibilitySchema = z.enum([
  "off",
  "hint",
  "partial",
  "hero",
]);

export const storyboardSellingPointSourceSchema = z.enum([
  "user",
  "inferred",
  "painpoint",
]);

export const storyboardPanelSchema = z.object({
  index: z.number().int().positive(),
  timeline: z.string().optional(),
  shotType: z.string().min(1),
  camera: z.string().optional(),
  scene: z.string().min(1),
  /** 生图/生视频共用的场景描述 prompt */
  scenePrompt: z.string().optional(),
  action: z.string().min(1),
  emotion: z.string().optional(),
  dialogue: z.string().optional(),
  durationHintSec: z.number().positive().optional(),
  videoPromptEn: z.string().optional(),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  productInteraction: storyboardProductInteractionSchema.optional(),
  productVisibility: storyboardProductVisibilitySchema.optional(),
  sellpointTags: z.array(z.string()).optional(),
  imagePrompt: z.string().optional(),
  protagonistBeat: z.string().optional(),
  productBeat: z.string().optional(),
});

export const storyboardSchemeSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().optional(),
  strategy: z.string().optional(),
  panels: z.array(storyboardPanelSchema).min(1),
  totalDurationHintSec: z.number().positive().optional(),
});

const storyboardCastMemberSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  appearance: z.string().optional(),
});

const storyboardSellingPointSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  source: storyboardSellingPointSourceSchema,
});

const storyboardCreativeBriefSchema = z.object({
  audienceHook: z.string().min(1),
  viralStructure: z.string().min(1),
  scenarioExpansion: z.string().min(1),
});

const storyboardAnalysisStructuredSchema = z.object({
  audience: z
    .array(
      z.object({
        segment: z.string().min(1),
        description: z.string().min(1),
      }),
    )
    .min(1),
  painPoints: z
    .array(
      z.object({
        level: z.string().min(1),
        description: z.string().min(1),
      }),
    )
    .min(1),
  strategies: z
    .array(
      z.object({
        name: z.string().min(1),
        hook3s: z.string().min(1),
        middle: z.string().min(1),
        closing: z.string().min(1),
      }),
    )
    .min(1),
});

/** @deprecated v0.1 — 只读 legacy */
const storyboardAnalysisLegacyMarkdownSchema = z.object({
  audienceMarkdown: z.string(),
  painPointsMarkdown: z.string(),
  strategiesMarkdown: z.string(),
});

export const storyboardAnalysisSchema = z.union([
  storyboardAnalysisStructuredSchema,
  storyboardAnalysisLegacyMarkdownSchema,
]);

export const storyboardDeliverableSchema = z.object({
  productName: z.string().optional(),
  params: z.record(z.string()).optional(),
  productSellingPoints: z.array(storyboardSellingPointSchema).optional(),
  creativeBrief: storyboardCreativeBriefSchema.optional(),
  cast: z.array(storyboardCastMemberSchema).optional(),
  analysis: storyboardAnalysisSchema.optional(),
  schemes: z.array(storyboardSchemeSchema).optional(),
});

/** v2 新交付校验（LLM 输出须满足） */
export const storyboardDeliverableV2PanelSchema = storyboardPanelSchema.extend({
  productInteraction: storyboardProductInteractionSchema,
  productVisibility: storyboardProductVisibilitySchema,
  sellpointTags: z.array(z.string()),
  scenePrompt: z.string().min(20),
  imagePrompt: z.string().min(20),
  videoPromptEn: z.string().min(20),
});

export const storyboardDeliverableV2SchemeSchema = storyboardSchemeSchema.extend({
  panels: z.array(storyboardDeliverableV2PanelSchema).min(1),
});

export const storyboardDeliverableV2Schema = storyboardDeliverableSchema.extend({
  productSellingPoints: z.array(storyboardSellingPointSchema).min(1),
  analysis: storyboardAnalysisStructuredSchema,
  schemes: z.array(storyboardDeliverableV2SchemeSchema).min(1),
});

export type StoryboardDeliverable = z.infer<typeof storyboardDeliverableSchema>;
export type StoryboardScheme = z.infer<typeof storyboardSchemeSchema>;
export type StoryboardPanel = z.infer<typeof storyboardPanelSchema>;
export type StoryboardSellingPoint = z.infer<typeof storyboardSellingPointSchema>;
export type StoryboardProductInteraction = z.infer<
  typeof storyboardProductInteractionSchema
>;
export type StoryboardProductVisibility = z.infer<
  typeof storyboardProductVisibilitySchema
>;
export type StoryboardAnalysisStructured = z.infer<
  typeof storyboardAnalysisStructuredSchema
>;

export function isLegacyAnalysisMarkdown(
  analysis: StoryboardDeliverable["analysis"],
): analysis is z.infer<typeof storyboardAnalysisLegacyMarkdownSchema> {
  if (!analysis || typeof analysis !== "object") return false;
  return "audienceMarkdown" in analysis;
}

export function isStructuredAnalysis(
  analysis: StoryboardDeliverable["analysis"],
): analysis is StoryboardAnalysisStructured {
  if (!analysis || typeof analysis !== "object") return false;
  return "audience" in analysis && Array.isArray(analysis.audience);
}

export function isStoryboardDeliverableV2(
  deliverable: StoryboardDeliverable,
): boolean {
  return storyboardDeliverableV2Schema.safeParse(deliverable).success;
}

export function normalizeStoryboardDeliverableV2(
  raw: StoryboardDeliverable,
): StoryboardDeliverable {
  const schemes = raw.schemes?.map((scheme) => ({
    ...scheme,
    panels: scheme.panels.map((p) => ({
      ...p,
      timeline: coercePanelTextField(p.timeline) ?? p.timeline,
      camera: coercePanelTextField(p.camera) ?? p.camera,
      dialogue: coercePanelTextField(p.dialogue) ?? p.dialogue,
      emotion: coercePanelTextField(p.emotion) ?? p.emotion,
      imagePrompt: coercePanelTextField(p.imagePrompt) ?? p.imagePrompt,
      scenePrompt: coercePanelTextField(p.scenePrompt) ?? p.scenePrompt,
      videoPromptEn: coercePanelTextField(p.videoPromptEn) ?? p.videoPromptEn,
      sellpointTags: p.sellpointTags ?? [],
    })),
  }));
  return { ...raw, schemes };
}

function coercePanelTextField(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (Array.isArray(value) && value.length >= 2) {
    return `${value[0]}-${value[1]}s`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const start = record.start ?? record.from ?? record.begin;
    const end = record.end ?? record.to;
    if (start != null && end != null) return `${start}-${end}s`;
  }
  const text = String(value).trim();
  return text || undefined;
}

function coerceDeliverablePanels(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;
  const schemes = obj.schemes;
  if (!Array.isArray(schemes)) return raw;
  obj.schemes = schemes.map((scheme) => {
    if (!scheme || typeof scheme !== "object") return scheme;
    const s = scheme as Record<string, unknown>;
    const panels = s.panels;
    if (!Array.isArray(panels)) return scheme;
    s.panels = panels.map((panel) => {
      if (!panel || typeof panel !== "object") return panel;
      const p = panel as Record<string, unknown>;
      const scene =
        typeof p.scene === "string" && p.scene.trim()
          ? p.scene.trim()
          : typeof p.action === "string"
            ? p.action.trim()
            : "场景";
      const action =
        typeof p.action === "string" && p.action.trim() ? p.action.trim() : scene;
      const shotType =
        typeof p.shotType === "string" && p.shotType.trim() ? p.shotType.trim() : "中景";
      const scenePromptRaw = coercePanelTextField(p.scenePrompt);
      const scenePrompt =
        scenePromptRaw && scenePromptRaw.length >= 20
          ? scenePromptRaw
          : derivePanelScenePrompt({ scene, scenePrompt: scenePromptRaw });
      return {
        ...p,
        scene,
        scenePrompt,
        action,
        shotType,
        timeline: coercePanelTextField(p.timeline),
        camera: coercePanelTextField(p.camera),
        dialogue: coercePanelTextField(p.dialogue),
        emotion: coercePanelTextField(p.emotion),
        imagePrompt: coercePanelTextField(p.imagePrompt),
        protagonistBeat: coercePanelTextField(p.protagonistBeat),
        productBeat: coercePanelTextField(p.productBeat),
        videoPromptEn: coercePanelTextField(p.videoPromptEn),
      };
    });
    return s;
  });
  return obj;
}

function tryParseDeliverableCandidate(jsonRaw: string): StoryboardDeliverable | null {
  try {
    const parsed = coerceDeliverablePanels(JSON.parse(jsonRaw));
    const result = storyboardDeliverableSchema.safeParse(parsed);
    if (result.success) return normalizeStoryboardDeliverableV2(result.data);
  } catch {
    /* */
  }
  return null;
}

export function stripDeliverableFence(text: string): string {
  let out = text
    .replace(/```storyboard-deliverable[\s\S]*?```/gi, "")
    .replace(/```json[\s\S]*?```/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<!--STORYBOARD_JSON[\s\S]*?STORYBOARD_JSON-->/gi, "")
    .trim();

  const jsonStart = out.search(/\{\s*"productName"|\{\s*"schemes"|\{\s*"analysis"/);
  if (jsonStart >= 0) {
    out = out.slice(0, jsonStart).trim();
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

export function extractStoryboardDeliverable(text: string): StoryboardDeliverable | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```storyboard-deliverable\s*([\s\S]*?)```/i);
  const comment = trimmed.match(/<!--STORYBOARD_JSON\s*([\s\S]*?)\s*STORYBOARD_JSON-->/i);
  const jsonRaw = fenced?.[1]?.trim() ?? comment?.[1]?.trim();
  if (jsonRaw) {
    const parsed = tryParseDeliverableCandidate(jsonRaw);
    if (parsed) return parsed;
  }

  const generic = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (generic?.[1]) {
    const parsed = tryParseDeliverableCandidate(generic[1].trim());
    if (parsed) return parsed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const parsed = tryParseDeliverableCandidate(trimmed.slice(start, end + 1));
    if (parsed) return parsed;
  }

  return null;
}

function pickProductHighlight(
  scheme: StoryboardScheme,
  deliverable?: StoryboardDeliverable,
): string | undefined {
  const fromSellpoints = deliverable?.productSellingPoints
    ?.map((sp) => sp.text.trim())
    .filter(Boolean)
    .join("；");
  if (fromSellpoints) return fromSellpoints;

  const params = deliverable?.params ?? {};
  const fromParams =
    (typeof params.产品信息 === "string" &&
      params.产品信息.trim() &&
      !params.产品信息.startsWith("参数已确认") &&
      params.产品信息.length < 200
      ? params.产品信息.trim()
      : undefined) ||
    (typeof params.卖点 === "string" && params.卖点.trim()) ||
    (typeof params["核心卖点"] === "string" && params["核心卖点"].trim()) ||
    (typeof params.productHighlight === "string" && params.productHighlight.trim()) ||
    (typeof params.sellingPoint === "string" && params.sellingPoint.trim());
  if (fromParams) return fromParams;
  const productName = deliverable?.productName?.trim();
  if (productName && !productName.startsWith("方案")) return productName;
  const fromSummary = scheme.summary?.trim();
  if (fromSummary && fromSummary.length <= 120 && !fromSummary.startsWith("方案"))
    return fromSummary;
  return undefined;
}

export function schemeToSheet(
  scheme: StoryboardScheme,
  deliverable?: StoryboardDeliverable,
): StoryboardSheet {
  const sheet = {
    overview: {
      title: scheme.title,
      logline:
        scheme.summary?.trim() ||
        scheme.strategy?.trim() ||
        deliverable?.productName?.trim() ||
        "微剧情分镜",
      productHighlight: pickProductHighlight(scheme, deliverable),
    },
    cast: (deliverable?.cast ?? []).map((c) => ({
      name: c.name,
      role: c.role,
      appearance: c.appearance?.trim() || undefined,
    })),
    panels: scheme.panels.map((p) => ({
      index: p.index,
      timeline: p.timeline,
      shotType: p.shotType,
      scene: p.scene,
      scenePrompt: p.scenePrompt?.trim() || undefined,
      action: p.action,
      dialogue: p.dialogue,
      camera: p.camera,
      emotion: p.emotion,
      durationHintSec: p.durationHintSec,
      videoPromptEn: p.videoPromptEn,
      imageUrl: p.imageUrl || undefined,
      videoUrl: p.videoUrl || undefined,
      productInteraction: p.productInteraction,
      productVisibility: p.productVisibility,
      sellpointTags: p.sellpointTags,
      imagePrompt: p.imagePrompt?.trim() || undefined,
      protagonistBeat: p.protagonistBeat?.trim() || undefined,
      productBeat: p.productBeat?.trim() || undefined,
    })),
    totalDurationHintSec: scheme.totalDurationHintSec ?? 10,
  };
  return parseStoryboardSheet(sheet);
}

/** 旧版「通用故事版」v2 项目（schemes/analysis/paramCollect），已停用新建与助手写入 */
export function isLegacyGenericStoryboardMeta(
  meta: Record<string, unknown> | null | undefined,
): boolean {
  const wf = (meta?.workflow as Record<string, unknown> | undefined) ?? {};
  if (wf.phase != null || wf.paramStep != null || wf.paramCollecting != null) return true;
  const d = meta?.deliverable as Record<string, unknown> | undefined;
  if (d?.schemes != null || d?.analysis != null) return true;
  return false;
}
