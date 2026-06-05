import { z } from "zod";

import { parseStoryboardSheet, type StoryboardSheet } from "./ecom-storyboard-types";

export const storyboardPanelSchema = z.object({
  index: z.number().int().positive(),
  timeline: z.string().optional(),
  shotType: z.string().min(1),
  camera: z.string().optional(),
  scene: z.string().min(1),
  action: z.string().min(1),
  emotion: z.string().optional(),
  dialogue: z.string().optional(),
  durationHintSec: z.number().positive().optional(),
  videoPromptEn: z.string().optional(),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
});

export const storyboardSchemeSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().optional(),
  strategy: z.string().optional(),
  panels: z.array(storyboardPanelSchema).min(1),
  totalDurationHintSec: z.number().positive().optional(),
});

export const storyboardDeliverableSchema = z.object({
  productName: z.string().optional(),
  params: z.record(z.string()).optional(),
  analysis: z
    .object({
      audienceMarkdown: z.string(),
      painPointsMarkdown: z.string(),
      strategiesMarkdown: z.string(),
    })
    .optional(),
  schemes: z.array(storyboardSchemeSchema).optional(),
});

export type StoryboardDeliverable = z.infer<typeof storyboardDeliverableSchema>;
export type StoryboardScheme = z.infer<typeof storyboardSchemeSchema>;

export function stripDeliverableFence(text: string): string {
  return text
    .replace(/```storyboard-deliverable[\s\S]*?```/gi, "")
    .replace(/<!--STORYBOARD_JSON[\s\S]*?STORYBOARD_JSON-->/gi, "")
    .trim();
}

export function extractStoryboardDeliverable(text: string): StoryboardDeliverable | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```storyboard-deliverable\s*([\s\S]*?)```/i);
  const comment = trimmed.match(/<!--STORYBOARD_JSON\s*([\s\S]*?)\s*STORYBOARD_JSON-->/i);
  const jsonRaw = fenced?.[1]?.trim() ?? comment?.[1]?.trim();
  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw);
      const result = storyboardDeliverableSchema.safeParse(parsed);
      if (result.success) return result.data;
    } catch {
      /* fall through */
    }
  }

  const generic = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (generic?.[1]) {
    try {
      const parsed = JSON.parse(generic[1].trim());
      const result = storyboardDeliverableSchema.safeParse(parsed);
      if (result.success) return result.data;
    } catch {
      /* */
    }
  }
  return null;
}

function pickProductHighlight(
  scheme: StoryboardScheme,
  deliverable?: StoryboardDeliverable,
): string | undefined {
  const params = deliverable?.params ?? {};
  const fromParams =
    (typeof params.卖点 === "string" && params.卖点.trim()) ||
    (typeof params["核心卖点"] === "string" && params["核心卖点"].trim()) ||
    (typeof params.productHighlight === "string" && params.productHighlight.trim()) ||
    (typeof params.sellingPoint === "string" && params.sellingPoint.trim());
  if (fromParams) return fromParams;
  const fromStrategy = scheme.strategy?.trim();
  if (fromStrategy && fromStrategy.length <= 120) return fromStrategy;
  const fromSummary = scheme.summary?.trim();
  if (fromSummary && fromSummary.length <= 120) return fromSummary;
  return deliverable?.productName?.trim() || undefined;
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
    cast: [],
    panels: scheme.panels.map((p) => ({
      index: p.index,
      timeline: p.timeline,
      shotType: p.shotType,
      scene: p.scene,
      action: p.action,
      dialogue: p.dialogue,
      camera: p.camera,
      emotion: p.emotion,
      durationHintSec: p.durationHintSec,
      videoPromptEn: p.videoPromptEn,
      imageUrl: p.imageUrl || undefined,
      videoUrl: p.videoUrl || undefined,
    })),
    totalDurationHintSec: scheme.totalDurationHintSec ?? 10,
  };
  return parseStoryboardSheet(sheet);
}
