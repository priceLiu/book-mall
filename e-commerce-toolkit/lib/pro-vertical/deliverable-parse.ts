import type { ProDeliverable, ProPanelRow, ProVersionKey, ProVerticalId, StoryTheaterVersion } from "@/lib/pro-vertical/types";
import { isProDeliverable } from "@/lib/pro-vertical/types";
import { isProVerticalId } from "@/lib/pro-vertical/registry";
import type { StoryTheaterVersionKey } from "@/lib/story-theater-types";

const PRO_FENCE_RE = /```pro-deliverable\s*([\s\S]*?)```/i;
const FASHION_FENCE_RE = /```fashion-deliverable\s*([\s\S]*?)```/i;
const GENERIC_FENCE_RE = /```(?:json)?\s*([\s\S]*?)```/i;

/** 与 book-mall/doc/ecom/pro-deliverable-spec-v1.md §7.1 一致 */
export type ProLlmPhase = "sellpoints" | "voiceovers" | "storyboards" | "ops" | "story_theater";

function productFocusFallback(vertical: ProVerticalId): string {
  if (vertical === "bags") return "包包展示";
  if (vertical === "digital_3c") return "产品功能展示";
  return "服装展示";
}

function deriveScenePrompt(sceneDesc: string, vertical: ProVerticalId): string {
  const desc = sceneDesc.trim();
  const suffix =
    vertical === "bags"
      ? "与包袋品类匹配的环境与道具"
      : vertical === "digital_3c"
        ? "与数码产品品类匹配的环境与道具"
        : "与服装品类匹配的环境与道具";
  if (desc && desc !== "—" && desc.length >= 20) return desc;
  return desc && desc !== "—" ? `${desc}，写实自然光，${suffix}` : `都市室内场景，自然光，${suffix}`;
}

function coerceProPanels(raw: unknown, vertical: ProVerticalId): ProPanelRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p, i) => {
      if (!p || typeof p !== "object") return null;
      const panel = p as Record<string, unknown>;
      const index = Math.min(6, Math.max(1, typeof panel.index === "number" ? panel.index : i + 1));
      const sceneDesc = String(panel.sceneDesc ?? "—");
      const modelAction = String(panel.modelAction ?? sceneDesc);
      const productFocus = String(
        panel.productFocus ?? panel.garmentFocus ?? productFocusFallback(vertical),
      );
      const cameraMove = String(panel.cameraMove ?? "固定");
      const scenePrompt = deriveScenePrompt(sceneDesc, vertical);
      return {
        index: index as ProPanelRow["index"],
        shotScale: String(panel.shotScale ?? "中景"),
        durationSec: typeof panel.durationSec === "number" ? panel.durationSec : 4,
        cameraMove,
        sceneDesc,
        scenePrompt,
        modelAction,
        productFocus,
        dialogue: typeof panel.dialogue === "string" ? panel.dialogue : undefined,
        toneTexture: typeof panel.toneTexture === "string" ? panel.toneTexture : undefined,
        sellpointIds: Array.isArray(panel.sellpointIds) ? panel.sellpointIds.map(String) : [],
        imagePrompt:
          typeof panel.imagePrompt === "string" && panel.imagePrompt.length >= 20
            ? panel.imagePrompt
            : `竖版9:16，写实UGC。场景：${scenePrompt}。展示${productFocus}，以参考图1产品为准`,
        videoPrompt:
          typeof panel.videoPrompt === "string" && panel.videoPrompt.length >= 20
            ? panel.videoPrompt
            : `${cameraMove}运镜，${modelAction}，${productFocus}`,
      } satisfies ProPanelRow;
    })
    .filter(Boolean) as ProPanelRow[];
}

function coerceStoryTheaterVersionsInPatch(
  raw: unknown,
  vertical: ProVerticalId,
): Partial<Record<StoryTheaterVersionKey, StoryTheaterVersion>> {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const next: Partial<Record<StoryTheaterVersionKey, StoryTheaterVersion>> = {};
  for (const key of ["T1", "T2", "T3", "T4", "T5"] as StoryTheaterVersionKey[]) {
    const version = obj[key];
    if (!version || typeof version !== "object") continue;
    const v = version as Record<string, unknown>;
    next[key] = {
      id: key,
      title: typeof v.title === "string" ? v.title : `${key}版`,
      summary: typeof v.summary === "string" ? v.summary : undefined,
      panels: coerceProPanels(v.panels, vertical),
      totalDurationSec:
        typeof v.totalDurationSec === "number" ? v.totalDurationSec : undefined,
    };
  }
  return next;
}

function detectProPhaseFromPayload(parsed: Record<string, unknown>): ProLlmPhase | null {
  if (parsed.opsPack != null && typeof parsed.opsPack === "object") return "ops";
  if (parsed.storyTheaterVersions != null && typeof parsed.storyTheaterVersions === "object") {
    return "story_theater";
  }
  if (parsed.storyboardVersions != null && typeof parsed.storyboardVersions === "object") {
    return "storyboards";
  }
  if (Array.isArray(parsed.voiceovers) && parsed.voiceovers.length > 0) return "voiceovers";
  if (Array.isArray(parsed.sellpoints) && parsed.sellpoints.length > 0) return "sellpoints";
  return null;
}

/** 分 phase 白名单字段，与 spec §7.1 / pickProPhaseMergePatch 一致 */
export function pickProPhaseMergePatch(
  patch: Partial<ProDeliverable>,
  phase: ProLlmPhase,
): Partial<ProDeliverable> {
  switch (phase) {
    case "sellpoints":
      return patch.sellpoints?.length ? { sellpoints: patch.sellpoints } : {};
    case "voiceovers":
      return patch.voiceovers?.length ? { voiceovers: patch.voiceovers } : {};
    case "storyboards": {
      const next: Partial<ProDeliverable> = {};
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
    case "story_theater": {
      const next: Partial<ProDeliverable> = {};
      if (patch.storyTheaterVersions && Object.keys(patch.storyTheaterVersions).length > 0) {
        next.storyTheaterVersions = patch.storyTheaterVersions;
      }
      if (patch.selectedStoryTopic) {
        next.selectedStoryTopic = patch.selectedStoryTopic;
      }
      if (patch.coverageChecklist?.length) {
        next.coverageChecklist = patch.coverageChecklist;
      }
      return next;
    }
  }
}

function storyboardsPhaseValid(
  versions: ProDeliverable["storyboardVersions"],
): versions is NonNullable<ProDeliverable["storyboardVersions"]> {
  if (!versions) return false;
  const keys = (["A", "B", "C", "D", "E"] as const).filter((k) => versions[k]);
  if (keys.length === 0) return false;
  return keys.every((k) => (versions[k]?.panels?.length ?? 0) === 6);
}

function coerceStoryboardVersionsInPatch(
  parsed: Record<string, unknown>,
  vertical: ProVerticalId,
): ProDeliverable["storyboardVersions"] | undefined {
  if (!parsed.storyboardVersions || typeof parsed.storyboardVersions !== "object") return undefined;
  const obj = parsed.storyboardVersions as Record<string, unknown>;
  const next: NonNullable<ProDeliverable["storyboardVersions"]> = {};
  for (const key of ["A", "B", "C", "D", "E"] as const) {
    const version = obj[key];
    if (!version || typeof version !== "object") continue;
    const v = version as Record<string, unknown>;
    next[key] = {
      id: key,
      title: typeof v.title === "string" ? v.title : `${key}版`,
      summary: typeof v.summary === "string" ? v.summary : undefined,
      panels: coerceProPanels(v.panels, vertical),
    };
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function validateProPhasePatch(
  parsed: Record<string, unknown>,
  vertical: ProVerticalId,
  phase: ProLlmPhase,
): Partial<ProDeliverable> | null {
  switch (phase) {
    case "sellpoints":
      if (!Array.isArray(parsed.sellpoints) || parsed.sellpoints.length === 0) return null;
      return { sellpoints: parsed.sellpoints as ProDeliverable["sellpoints"] };
    case "voiceovers":
      if (!Array.isArray(parsed.voiceovers) || parsed.voiceovers.length === 0) return null;
      return { voiceovers: parsed.voiceovers as ProDeliverable["voiceovers"] };
    case "storyboards": {
      const storyboardVersions = coerceStoryboardVersionsInPatch(parsed, vertical);
      if (!storyboardsPhaseValid(storyboardVersions)) return null;
      const patch: Partial<ProDeliverable> = { storyboardVersions };
      if (Array.isArray(parsed.coverageChecklist) && parsed.coverageChecklist.length > 0) {
        patch.coverageChecklist = parsed.coverageChecklist as ProDeliverable["coverageChecklist"];
      }
      return patch;
    }
    case "ops":
      if (parsed.opsPack == null || typeof parsed.opsPack !== "object") return null;
      return { opsPack: parsed.opsPack as ProDeliverable["opsPack"] };
    case "story_theater": {
      const storyTheaterVersions = coerceStoryTheaterVersionsInPatch(
        parsed.storyTheaterVersions,
        vertical,
      );
      if (Object.keys(storyTheaterVersions).length === 0) return null;
      const patch: Partial<ProDeliverable> = { storyTheaterVersions };
      if (parsed.selectedStoryTopic && typeof parsed.selectedStoryTopic === "object") {
        patch.selectedStoryTopic =
          parsed.selectedStoryTopic as ProDeliverable["selectedStoryTopic"];
      }
      return patch;
    }
  }
}

function tryParseProPhasePatch(
  jsonRaw: string,
  vertical: ProVerticalId,
  phaseHint?: ProLlmPhase,
): Partial<ProDeliverable> | null {
  try {
    const parsed = JSON.parse(jsonRaw) as Record<string, unknown>;
    const rawVertical = typeof parsed.vertical === "string" ? parsed.vertical : undefined;
    if (rawVertical != null && isProVerticalId(rawVertical) && rawVertical !== vertical) {
      return null;
    }
    if (
      parsed.schemaVersion != null &&
      parsed.schemaVersion !== "pro-v1" &&
      parsed.schemaVersion !== "fashion-v4"
    ) {
      return null;
    }
    const phase = phaseHint ?? detectProPhaseFromPayload(parsed);
    if (!phase) return null;
    const patch = validateProPhasePatch(parsed, vertical, phase);
    if (!patch) return null;
    return pickProPhaseMergePatch(patch, phase);
  } catch {
    return null;
  }
}

export function extractProDeliverableFromText(
  text: string,
  vertical?: ProVerticalId,
  phaseHint?: ProLlmPhase,
): Partial<ProDeliverable> | null {
  const trimmed = text.trim();
  for (const re of [PRO_FENCE_RE, FASHION_FENCE_RE, GENERIC_FENCE_RE]) {
    const m = trimmed.match(re);
    if (m?.[1]) {
      const parsed = tryParseProPhasePatch(m[1].trim(), vertical ?? "bags", phaseHint);
      if (parsed) return parsed;
    }
  }
  const markers = [
    /\{\s*"storyboardVersions"\s*:/,
    /\{\s*"schemaVersion"\s*:\s*"pro-v1"/,
    /\{\s*"vertical"\s*:\s*"(?:bags|digital_3c)"/,
  ];
  let jsonStart = -1;
  for (const re of markers) {
    const idx = trimmed.search(re);
    if (idx >= 0 && (jsonStart < 0 || idx < jsonStart)) jsonStart = idx;
  }
  if (jsonStart < 0) jsonStart = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (jsonStart >= 0 && end > jsonStart) {
    return tryParseProPhasePatch(trimmed.slice(jsonStart, end + 1), vertical ?? "bags", phaseHint);
  }
  return null;
}

export function stripProDeliverableFence(text: string): string {
  return text
    .replace(/```pro-deliverable[\s\S]*?```/gi, "")
    .replace(/```fashion-deliverable[\s\S]*?```/gi, "")
    .replace(/```json[\s\S]*?```/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim();
}

export function isProInternalLlmTrigger(text: string): boolean {
  const t = text.trim();
  return t.startsWith("pro-step:") || t.startsWith("fashion-step:");
}

export function mergeProDeliverableState(
  base: ProDeliverable,
  patch: Partial<ProDeliverable>,
): ProDeliverable {
  return {
    ...base,
    ...patch,
    schemaVersion: "pro-v1",
    vertical: base.vertical,
    dimensions: { ...base.dimensions, ...(patch.dimensions ?? {}) },
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
    storyboardVersions: {
      ...(base.storyboardVersions ?? {}),
      ...(patch.storyboardVersions ?? {}),
    },
    selectedVersion:
      patch.selectedVersion != null ? patch.selectedVersion : base.selectedVersion,
    storyboardLocked: base.storyboardLocked || Boolean(patch.storyboardLocked),
    coverageChecklist: patch.coverageChecklist?.length
      ? patch.coverageChecklist
      : base.coverageChecklist,
    opsPack:
      base.storyboardLocked || patch.storyboardLocked
        ? { ...(base.opsPack ?? {}), ...(patch.opsPack ?? {}) }
        : base.opsPack,
    outputMode:
      base.storyboardLocked || patch.storyboardLocked
        ? (patch.outputMode ?? base.outputMode)
        : base.outputMode,
    productionMode: patch.productionMode ?? base.productionMode ?? null,
    storyTopicCandidates:
      patch.storyTopicCandidates?.length
        ? patch.storyTopicCandidates
        : base.storyTopicCandidates,
    selectedStoryTopic:
      patch.selectedStoryTopic !== undefined
        ? patch.selectedStoryTopic
        : base.selectedStoryTopic,
    storyTheaterVersions: coerceStoryTheaterVersionsInPatch(
      {
        ...(base.storyTheaterVersions ?? {}),
        ...(patch.storyTheaterVersions ?? {}),
      },
      base.vertical,
    ),
    selectedStoryTheaterVersion:
      patch.selectedStoryTheaterVersion !== undefined
        ? patch.selectedStoryTheaterVersion
        : base.selectedStoryTheaterVersion,
    storyTheaterLocked: base.storyTheaterLocked || Boolean(patch.storyTheaterLocked),
  };
}

export function readMetaProDeliverable(raw: unknown): ProDeliverable | null {
  if (!isProDeliverable(raw)) return null;
  const o = raw as ProDeliverable;
  if (o.vertical === "fashion_apparel") return null;
  return o;
}

export function listProStoryboardVersionKeys(
  d: Pick<ProDeliverable, "storyboardVersions"> | null | undefined,
): ProVersionKey[] {
  const versions = d?.storyboardVersions ?? {};
  return (["A", "B", "C", "D", "E"] as ProVersionKey[]).filter((k) => {
    const v = versions[k];
    return Boolean(v?.panels?.length || v?.title?.trim());
  });
}

export function hasMeaningfulProOpsPack(d: ProDeliverable): boolean {
  const ops = d.opsPack;
  if (!ops) return false;
  return Boolean(
    (ops.titles?.length ?? 0) > 0 ||
      (ops.coverWords?.length ?? 0) > 0 ||
      (ops.tags?.length ?? 0) > 0 ||
      (ops.detailBullets?.length ?? 0) > 0 ||
      Boolean(ops.xiaohongshuBody?.trim()) ||
      Boolean(ops.bgmDirection?.trim()) ||
      Boolean(ops.subtitleGuide?.trim()) ||
      Boolean(ops.sfxNotes?.trim()),
  );
}
