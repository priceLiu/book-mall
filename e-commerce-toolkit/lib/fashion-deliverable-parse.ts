import type {
  FashionDeliverable,
  FashionPanelRow,
  FashionStoryboardVersion,
  FashionVersionKey,
} from "@/lib/fashion-types";
import { isFashionDeliverable } from "@/lib/fashion-types";
import { normalizeFashionOpsPack } from "@/lib/fashion-ops-pack-format";

function deriveScenePrompt(sceneDesc: string, scenePromptRaw?: string): string {
  const explicit = scenePromptRaw?.trim();
  if (explicit && explicit.length >= 20) return explicit;
  const desc = sceneDesc.trim();
  if (desc && desc !== "—") {
    return desc.length >= 20
      ? desc
      : `${desc}，写实自然光，与服装品类匹配的环境与道具`;
  }
  return explicit || "都市室内或户外场景，自然光，与服装展示匹配";
}

function deriveVideoPrompt(
  cameraMove: string,
  modelAction: string,
  sceneDesc: string,
  garmentFocus: string,
  videoPromptRaw?: string,
): string {
  const explicit = videoPromptRaw?.trim();
  if (explicit && explicit.length >= 20) return explicit;
  return `${cameraMove || "固定"}运镜，${modelAction}，场景${sceneDesc}，服装展示重点${garmentFocus}，UGC质感连贯动作`;
}

function deriveImagePrompt(
  scenePrompt: string,
  modelAction: string,
  garmentFocus: string,
  imagePromptRaw?: string,
): string {
  const explicit = imagePromptRaw?.trim();
  if (explicit && explicit.length >= 20) return explicit;
  return `竖版9:16，写实UGC摄影。场景：${scenePrompt}。模特${modelAction}，展示${garmentFocus}，以参考图1服装为准，禁止画面文字。`;
}

const FASHION_FENCE_RE = /```fashion-deliverable\s*([\s\S]*?)```/i;
const GENERIC_FENCE_RE = /```(?:json)?\s*([\s\S]*?)```/i;

function coerceFashionPanels(raw: unknown): FashionPanelRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p, i) => {
      if (!p || typeof p !== "object") return null;
      const panel = p as Record<string, unknown>;
      const index = typeof panel.index === "number" ? panel.index : i + 1;
      const sceneDesc = String(panel.sceneDesc ?? "");
      const modelAction = String(panel.modelAction ?? "");
      const garmentFocus = String(panel.garmentFocus ?? "");
      const cameraMove = String(panel.cameraMove ?? "固定");
      const scenePrompt = deriveScenePrompt(
        sceneDesc,
        typeof panel.scenePrompt === "string" ? panel.scenePrompt : undefined,
      );
      return {
        index: Math.min(6, Math.max(1, index)) as FashionPanelRow["index"],
        shotScale: String(panel.shotScale ?? "中景"),
        durationSec: typeof panel.durationSec === "number" ? panel.durationSec : 4,
        cameraMove,
        sceneDesc,
        scenePrompt,
        modelAction,
        garmentFocus,
        dialogue: typeof panel.dialogue === "string" ? panel.dialogue : undefined,
        toneTexture: typeof panel.toneTexture === "string" ? panel.toneTexture : undefined,
        sellpointIds: Array.isArray(panel.sellpointIds)
          ? panel.sellpointIds.map(String)
          : [],
        imagePrompt: deriveImagePrompt(
          scenePrompt,
          modelAction,
          garmentFocus,
          typeof panel.imagePrompt === "string" ? panel.imagePrompt : undefined,
        ),
        videoPrompt: deriveVideoPrompt(
          cameraMove,
          modelAction,
          sceneDesc,
          garmentFocus,
          typeof panel.videoPrompt === "string"
            ? panel.videoPrompt
            : typeof panel.videoPromptEn === "string"
              ? panel.videoPromptEn
              : undefined,
        ),
      };
    })
    .filter(Boolean) as FashionPanelRow[];
}

function coerceStoryboardVersions(
  raw: unknown,
): Partial<Record<FashionVersionKey, FashionStoryboardVersion>> {
  if (Array.isArray(raw)) {
    const next: Partial<Record<FashionVersionKey, FashionStoryboardVersion>> = {};
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const v = item as Record<string, unknown>;
      const rawKey =
        (typeof v.id === "string" && v.id.trim()) ||
        (typeof v.version === "string" && v.version.trim()) ||
        "";
      const key = rawKey.toUpperCase().charAt(0) as FashionVersionKey;
      if (!["A", "B", "C", "D", "E"].includes(key)) continue;
      next[key] = {
        id: key,
        title: typeof v.title === "string" ? v.title : `${key}版`,
        summary: typeof v.summary === "string" ? v.summary : undefined,
        panels: coerceFashionPanels(v.panels),
        totalDurationSec:
          typeof v.totalDurationSec === "number" ? v.totalDurationSec : undefined,
      };
    }
    return next;
  }

  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const next: Partial<Record<FashionVersionKey, FashionStoryboardVersion>> = {};
  for (const key of ["A", "B", "C", "D", "E"] as FashionVersionKey[]) {
    const version = obj[key] ?? obj[key.toLowerCase()];
    if (!version || typeof version !== "object") continue;
    const v = version as Record<string, unknown>;
    next[key] = {
      id: key,
      title: typeof v.title === "string" ? v.title : `${key}版`,
      summary: typeof v.summary === "string" ? v.summary : undefined,
      panels: coerceFashionPanels(v.panels),
      totalDurationSec:
        typeof v.totalDurationSec === "number" ? v.totalDurationSec : undefined,
    };
  }
  return next;
}

function hasStoryboardVersionPayload(
  versions: Partial<Record<FashionVersionKey, FashionStoryboardVersion>> | undefined,
): boolean {
  if (!versions) return false;
  return (["A", "B", "C", "D", "E"] as FashionVersionKey[]).some((k) => {
    const v = versions[k];
    if (!v || typeof v !== "object") return false;
    return (
      (v.panels?.length ?? 0) > 0 ||
      Boolean(v.title?.trim()) ||
      Boolean(v.summary?.trim())
    );
  });
}

function sanitizePreLockFashionDeliverable(d: FashionDeliverable): FashionDeliverable {
  if (d.sellpointsLocked) return d;
  return {
    ...d,
    voiceovers: [],
    selectedVoiceoverId: null,
    storyboardVersions: {},
    selectedVersion: null,
    coverageChecklist: [],
  };
}

function stripLlmPreselectedVersion(d: FashionDeliverable): FashionDeliverable {
  if (hasStoryboardVersionPayload(d.storyboardVersions) && !d.opsPack && d.selectedVersion) {
    return { ...d, selectedVersion: null };
  }
  return d;
}

function stripPrematureFashionDeliverableFields(d: FashionDeliverable): FashionDeliverable {
  let next = d;
  if (!next.storyboardLocked) {
    next = { ...next, opsPack: undefined, outputMode: null };
  }
  return next;
}

function coerceFashionDeliverableLoose(raw: unknown): FashionDeliverable | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const hasFashionPayload =
    obj.storyboardVersions != null ||
    Array.isArray(obj.sellpoints) ||
    Array.isArray(obj.voiceovers) ||
    (obj.dimensions != null && typeof obj.dimensions === "object");
  if (obj.schemaVersion !== "fashion-v4" && !hasFashionPayload) return null;

  const coerced: FashionDeliverable = {
    schemaVersion: "fashion-v4",
    vertical: "fashion_apparel",
    productName: typeof obj.productName === "string" ? obj.productName : "",
    dimensions: (obj.dimensions as FashionDeliverable["dimensions"]) ?? {},
    sellpoints: Array.isArray(obj.sellpoints)
      ? (obj.sellpoints as FashionDeliverable["sellpoints"])
      : [],
    sellpointsLocked: Boolean(obj.sellpointsLocked),
    voiceovers: Array.isArray(obj.voiceovers)
      ? (obj.voiceovers as FashionDeliverable["voiceovers"])
      : [],
    selectedVoiceoverId:
      typeof obj.selectedVoiceoverId === "string" ? obj.selectedVoiceoverId : null,
    storyboardVersions: coerceStoryboardVersions(obj.storyboardVersions),
    selectedVersion:
      obj.selectedVersion === "A" ||
      obj.selectedVersion === "B" ||
      obj.selectedVersion === "C" ||
      obj.selectedVersion === "D" ||
      obj.selectedVersion === "E"
        ? obj.selectedVersion
        : null,
    storyboardLocked: Boolean(obj.storyboardLocked),
    coverageChecklist: Array.isArray(obj.coverageChecklist)
      ? (obj.coverageChecklist as FashionDeliverable["coverageChecklist"])
      : [],
    opsPack: obj.opsPack as FashionDeliverable["opsPack"],
    outputMode:
      obj.outputMode === "script_compose" || obj.outputMode === "direct_video"
        ? obj.outputMode
        : null,
  };
  if (!isFashionDeliverable(coerced)) return null;
  return sanitizePreLockFashionDeliverable(stripLlmPreselectedVersion(coerced));
}

function tryParseFashionJson(jsonRaw: string): FashionDeliverable | null {
  try {
    const parsed = JSON.parse(jsonRaw) as unknown;
    return coerceFashionDeliverableLoose(parsed);
  } catch {
    /* */
  }
  return null;
}

export function extractFashionDeliverableFromText(text: string): FashionDeliverable | null {
  const trimmed = text.trim();
  const fashionFence = trimmed.match(FASHION_FENCE_RE);
  if (fashionFence?.[1]) {
    const parsed = tryParseFashionJson(fashionFence[1].trim());
    if (parsed) return parsed;
  }

  const genericFence = trimmed.match(GENERIC_FENCE_RE);
  if (genericFence?.[1]) {
    const parsed = tryParseFashionJson(genericFence[1].trim());
    if (parsed) return parsed;
  }

  const start = trimmed.search(
    /\{\s*"schemaVersion"\s*:\s*"fashion-v4"|\{\s*"vertical"\s*:\s*"fashion_apparel"/,
  );
  if (start >= 0) {
    const end = trimmed.lastIndexOf("}");
    if (end > start) {
      const parsed = tryParseFashionJson(trimmed.slice(start, end + 1));
      if (parsed) return parsed;
    }
  }
  return null;
}

export function stripFashionDeliverableFence(text: string): string {
  let out = text
    .replace(FASHION_FENCE_RE, "")
    .replace(/```json[\s\S]*?```/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim();
  const jsonStart = out.search(
    /\{\s*"schemaVersion"\s*:\s*"fashion-v4"|\{\s*"vertical"\s*:\s*"fashion_apparel"/,
  );
  if (jsonStart >= 0) out = out.slice(0, jsonStart).trim();
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

export function mergeFashionDeliverableState(
  base: FashionDeliverable,
  patch: Partial<FashionDeliverable>,
): FashionDeliverable {
  const mergedStoryboardVersions = {
    ...(base.storyboardVersions ?? {}),
    ...(patch.storyboardVersions ?? {}),
  };
  if (
    base.storyboardLocked &&
    base.selectedVersion &&
    base.storyboardVersions?.[base.selectedVersion]?.panels?.length
  ) {
    mergedStoryboardVersions[base.selectedVersion] =
      base.storyboardVersions[base.selectedVersion]!;
  }
  const nextDimensions: FashionDeliverable["dimensions"] = { ...base.dimensions };
  if (patch.dimensions) {
    for (const [key, value] of Object.entries(patch.dimensions)) {
      if (typeof value === "string" && value.trim()) {
        nextDimensions[key] = value.trim();
      }
    }
  }

  let selectedVersion = base.selectedVersion;
  if (patch.selectedVersion != null) {
    selectedVersion = patch.selectedVersion;
  }

  const merged: FashionDeliverable = {
    ...base,
    ...patch,
    schemaVersion: "fashion-v4",
    vertical: "fashion_apparel",
    productName: patch.productName?.trim() || base.productName,
    dimensions: nextDimensions,
    sellpoints:
      base.sellpointsLocked && base.sellpoints?.length
        ? base.sellpoints
        : patch.sellpoints?.length
          ? patch.sellpoints
          : base.sellpoints,
    // 一旦锁定，禁止 LLM 回写 false
    sellpointsLocked: base.sellpointsLocked || Boolean(patch.sellpointsLocked),
    voiceovers: patch.voiceovers?.length ? patch.voiceovers : base.voiceovers,
    selectedVoiceoverId:
      patch.selectedVoiceoverId != null && patch.selectedVoiceoverId !== ""
        ? patch.selectedVoiceoverId
        : base.selectedVoiceoverId,
    storyboardVersions: mergedStoryboardVersions,
    selectedVersion,
    storyboardLocked: base.storyboardLocked || Boolean(patch.storyboardLocked),
    coverageChecklist: patch.coverageChecklist?.length
      ? patch.coverageChecklist
      : base.coverageChecklist,
    opsPack:
      base.storyboardLocked || patch.storyboardLocked
        ? patch.opsPack || base.opsPack
          ? normalizeFashionOpsPack({ ...base.opsPack, ...patch.opsPack }) ?? undefined
          : base.opsPack
        : base.opsPack,
    outputMode:
      base.storyboardLocked || patch.storyboardLocked
        ? (patch.outputMode ?? base.outputMode)
        : null,
  };
  return sanitizePreLockFashionDeliverable(stripPrematureFashionDeliverableFields(merged));
}

export function isFashionInternalLlmTrigger(text: string): boolean {
  return text.trim().startsWith("fashion-step:");
}
