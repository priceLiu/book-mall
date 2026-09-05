import type {
  FashionDeliverable,
  FashionPanelRow,
  FashionStoryboardVersion,
  FashionVersionKey,
} from "@/lib/fashion-types";
import { isFashionDeliverable } from "@/lib/fashion-types";
import { normalizeFashionOpsPack } from "@/lib/fashion-ops-pack-format";

/** 与 book-mall/doc/ecom/fashion-deliverable-spec-v4.md §7.1 一致 */
export type FashionLlmPhase = "sellpoints" | "voiceovers" | "storyboards" | "ops";

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

function detectFashionPhaseFromPayload(parsed: Record<string, unknown>): FashionLlmPhase | null {
  if (parsed.opsPack != null && typeof parsed.opsPack === "object") return "ops";
  if (parsed.storyboardVersions != null && typeof parsed.storyboardVersions === "object") {
    return "storyboards";
  }
  if (Array.isArray(parsed.voiceovers) && parsed.voiceovers.length > 0) return "voiceovers";
  if (Array.isArray(parsed.sellpoints) && parsed.sellpoints.length > 0) return "sellpoints";
  return null;
}

/** 分 phase 白名单字段，与 spec §7.1 / pickFashionPhaseMergePatch 一致 */
export function pickFashionPhaseMergePatch(
  patch: Partial<FashionDeliverable>,
  phase: FashionLlmPhase,
): Partial<FashionDeliverable> {
  switch (phase) {
    case "sellpoints":
      return patch.sellpoints?.length ? { sellpoints: patch.sellpoints } : {};
    case "voiceovers":
      return patch.voiceovers?.length ? { voiceovers: patch.voiceovers } : {};
    case "storyboards": {
      const next: Partial<FashionDeliverable> = {};
      if (patch.storyboardVersions && Object.keys(patch.storyboardVersions).length > 0) {
        next.storyboardVersions = patch.storyboardVersions;
      }
      if (patch.coverageChecklist?.length) {
        next.coverageChecklist = patch.coverageChecklist;
      }
      return next;
    }
    case "ops":
      return patch.opsPack != null ? { opsPack: patch.opsPack } : {};
  }
}

function storyboardsPhaseValid(
  versions: FashionDeliverable["storyboardVersions"],
): versions is NonNullable<FashionDeliverable["storyboardVersions"]> {
  if (!versions) return false;
  const keys = (["A", "B", "C", "D", "E"] as const).filter((k) => versions[k]);
  if (keys.length === 0) return false;
  return keys.every((k) => (versions[k]?.panels?.length ?? 0) === 6);
}

function validateFashionPhasePatch(
  parsed: Record<string, unknown>,
  phase: FashionLlmPhase,
): Partial<FashionDeliverable> | null {
  switch (phase) {
    case "sellpoints":
      if (!Array.isArray(parsed.sellpoints) || parsed.sellpoints.length === 0) return null;
      return { sellpoints: parsed.sellpoints as FashionDeliverable["sellpoints"] };
    case "voiceovers":
      if (!Array.isArray(parsed.voiceovers) || parsed.voiceovers.length === 0) return null;
      return { voiceovers: parsed.voiceovers as FashionDeliverable["voiceovers"] };
    case "storyboards": {
      const storyboardVersions = coerceStoryboardVersions(parsed.storyboardVersions);
      if (!storyboardsPhaseValid(storyboardVersions)) return null;
      const patch: Partial<FashionDeliverable> = { storyboardVersions };
      if (Array.isArray(parsed.coverageChecklist) && parsed.coverageChecklist.length > 0) {
        patch.coverageChecklist = parsed.coverageChecklist as FashionDeliverable["coverageChecklist"];
      }
      return patch;
    }
    case "ops":
      if (parsed.opsPack == null || typeof parsed.opsPack !== "object") return null;
      return { opsPack: parsed.opsPack as FashionDeliverable["opsPack"] };
  }
}

function tryParseFashionPhasePatch(
  jsonRaw: string,
  phaseHint?: FashionLlmPhase,
): Partial<FashionDeliverable> | null {
  try {
    const parsed = JSON.parse(jsonRaw) as Record<string, unknown>;
    if (parsed.vertical != null && parsed.vertical !== "fashion_apparel") return null;
    if (parsed.schemaVersion != null && parsed.schemaVersion !== "fashion-v4") return null;
    const phase = phaseHint ?? detectFashionPhaseFromPayload(parsed);
    if (!phase) return null;
    const patch = validateFashionPhasePatch(parsed, phase);
    if (!patch) return null;
    return pickFashionPhaseMergePatch(patch, phase);
  } catch {
    return null;
  }
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

function stripPrematureFashionDeliverableFields(d: FashionDeliverable): FashionDeliverable {
  if (!d.storyboardLocked) {
    return { ...d, opsPack: undefined, outputMode: null };
  }
  return d;
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
  return sanitizePreLockFashionDeliverable(coerced);
}

export function extractFashionDeliverableFromText(
  text: string,
  phaseHint?: FashionLlmPhase,
): Partial<FashionDeliverable> | null {
  const trimmed = text.trim();
  for (const re of [FASHION_FENCE_RE, GENERIC_FENCE_RE]) {
    const m = trimmed.match(re);
    if (m?.[1]) {
      const parsed = tryParseFashionPhasePatch(m[1].trim(), phaseHint);
      if (parsed) return parsed;
    }
  }
  const markers = [
    /\{\s*"storyboardVersions"\s*:/,
    /\{\s*"schemaVersion"\s*:\s*"fashion-v4"/,
    /\{\s*"vertical"\s*:\s*"fashion_apparel"/,
  ];
  let jsonStart = -1;
  for (const re of markers) {
    const idx = trimmed.search(re);
    if (idx >= 0 && (jsonStart < 0 || idx < jsonStart)) jsonStart = idx;
  }
  if (jsonStart < 0) jsonStart = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (jsonStart >= 0 && end > jsonStart) {
    const slice = trimmed.slice(jsonStart, end + 1);
    const parsed = tryParseFashionPhasePatch(slice, phaseHint);
    if (parsed) return parsed;
    if (phaseHint) return null;
    try {
      return coerceFashionDeliverableLoose(JSON.parse(slice));
    } catch {
      return null;
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
    /\{\s*"schemaVersion"\s*:\s*"fashion-v4"|\{\s*"vertical"\s*:\s*"fashion_apparel"|\{\s*"storyboardVersions"\s*:/,
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

function resolveFashionLlmPhaseFromTrigger(trigger: string): FashionLlmPhase | undefined {
  if (trigger.includes("sellpoints")) return "sellpoints";
  if (trigger.includes("voiceovers")) return "voiceovers";
  if (trigger.includes("storyboards")) return "storyboards";
  if (trigger.includes("ops")) return "ops";
  return undefined;
}

export function extractFashionDeliverableFromLlmTrigger(
  text: string,
  trigger: string,
): Partial<FashionDeliverable> | null {
  return extractFashionDeliverableFromText(text, resolveFashionLlmPhaseFromTrigger(trigger));
}
