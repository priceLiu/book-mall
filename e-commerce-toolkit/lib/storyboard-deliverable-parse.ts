import type { StoryboardDeliverable } from "@/lib/storyboard-types";
import { isFashionDeliverable } from "@/lib/fashion-types";

export function asStoryboardDeliverable(
  raw: StoryboardDeliverable | import("@/lib/fashion-types").FashionDeliverable | undefined | null,
): StoryboardDeliverable | undefined {
  if (!raw || isFashionDeliverable(raw)) return undefined;
  return raw;
}

/** 与 book-mall extract/strip 逻辑对齐（客户端渲染用） */
export function stripStoryboardDeliverableFence(text: string): string {
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

  if (/^\s*[\[{]/.test(out) && /"schemes"|"panels"|"productName"/.test(out)) {
    return "";
  }

  return out.replace(/\n{3,}/g, "\n\n").trim();
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

function coercePanels(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = { ...(raw as Record<string, unknown>) };
  if (!Array.isArray(obj.schemes)) return obj;
  obj.schemes = obj.schemes.map((scheme) => {
    if (!scheme || typeof scheme !== "object") return scheme;
    const s = { ...(scheme as Record<string, unknown>) };
    if (!Array.isArray(s.panels)) return s;
    s.panels = s.panels.map((panel) => {
      if (!panel || typeof panel !== "object") return panel;
      const p = panel as Record<string, unknown>;
      const scene =
        typeof p.scene === "string" && p.scene.trim()
          ? p.scene.trim()
          : typeof p.action === "string"
            ? String(p.action).trim()
            : "场景";
      const action =
        typeof p.action === "string" && String(p.action).trim()
          ? String(p.action).trim()
          : scene;
      const shotType =
        typeof p.shotType === "string" && String(p.shotType).trim()
          ? String(p.shotType).trim()
          : "中景";
      return {
        ...p,
        scene,
        action,
        shotType,
        timeline: coercePanelTextField(p.timeline),
        camera: coercePanelTextField(p.camera),
        dialogue: coercePanelTextField(p.dialogue),
        emotion: coercePanelTextField(p.emotion),
        scenePrompt: coercePanelTextField(p.scenePrompt),
        imagePrompt: coercePanelTextField(p.imagePrompt),
        videoPromptEn: coercePanelTextField(p.videoPromptEn),
        sellpointTags: p.sellpointTags ?? [],
      };
    });
    return s;
  });
  return obj;
}

export function extractStoryboardDeliverableFromText(
  text: string,
): StoryboardDeliverable | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const patterns = [
    /```storyboard-deliverable\s*([\s\S]*?)```/i,
    /```json\s*([\s\S]*?)```/i,
    /```\s*([\s\S]*?)```/,
  ];

  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m?.[1]) {
      const parsed = tryParse(m[1].trim());
      if (parsed) return parsed;
    }
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return tryParse(trimmed.slice(start, end + 1));
  }

  return null;
}

function tryParse(jsonRaw: string): StoryboardDeliverable | null {
  try {
    const coerced = coercePanels(JSON.parse(jsonRaw)) as StoryboardDeliverable;
    if (coerced?.schemes?.length || coerced?.analysis) return coerced;
  } catch {
    /* */
  }
  return null;
}

export function looksLikeRawDeliverableJson(text: string): boolean {
  const t = text.trim();
  if (!t.startsWith("{")) return false;
  return /"schemes"|"panels"|"productName"|"analysis"/.test(t);
}
