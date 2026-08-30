import type { ProDeliverable, ProPanelRow, ProVersionKey, ProVerticalId } from "@/lib/pro-vertical/types";
import { isProDeliverable } from "@/lib/pro-vertical/types";
import { isProVerticalId } from "@/lib/pro-vertical/registry";

const PRO_FENCE_RE = /```pro-deliverable\s*([\s\S]*?)```/i;
const FASHION_FENCE_RE = /```fashion-deliverable\s*([\s\S]*?)```/i;
const GENERIC_FENCE_RE = /```(?:json)?\s*([\s\S]*?)```/i;

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

function tryParseProCandidate(jsonRaw: string, fallbackVertical?: ProVerticalId): ProDeliverable | null {
  try {
    const parsed = JSON.parse(jsonRaw) as Record<string, unknown>;
    const rawVertical = typeof parsed.vertical === "string" ? parsed.vertical : undefined;
    const vertical: ProVerticalId =
      isProVerticalId(rawVertical) && rawVertical !== "fashion_apparel"
        ? rawVertical
        : fallbackVertical ?? "bags";
    if (parsed.schemaVersion !== "pro-v1" && rawVertical !== vertical) return null;
    parsed.schemaVersion = "pro-v1";
    parsed.vertical = vertical;
    const versions = parsed.storyboardVersions as Record<string, unknown> | undefined;
    if (versions) {
      for (const key of ["A", "B", "C", "D", "E"]) {
        const v = versions[key];
        if (!v || typeof v !== "object") continue;
        const vo = v as Record<string, unknown>;
        vo.panels = coerceProPanels(vo.panels, vertical);
      }
    }
    return parsed as ProDeliverable;
  } catch {
    return null;
  }
}

export function extractProDeliverableFromText(
  text: string,
  vertical?: ProVerticalId,
): ProDeliverable | null {
  const trimmed = text.trim();
  for (const re of [PRO_FENCE_RE, FASHION_FENCE_RE, GENERIC_FENCE_RE]) {
    const m = trimmed.match(re);
    if (m?.[1]) {
      const parsed = tryParseProCandidate(m[1].trim(), vertical);
      if (parsed) return parsed;
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return tryParseProCandidate(trimmed.slice(start, end + 1), vertical);
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
    dimensions: { ...base.dimensions, ...(patch.dimensions ?? {}) },
    sellpoints: patch.sellpoints?.length ? patch.sellpoints : base.sellpoints,
    voiceovers: patch.voiceovers?.length ? patch.voiceovers : base.voiceovers,
    storyboardVersions: {
      ...(base.storyboardVersions ?? {}),
      ...(patch.storyboardVersions ?? {}),
    },
    coverageChecklist: patch.coverageChecklist?.length
      ? patch.coverageChecklist
      : base.coverageChecklist,
    opsPack: patch.opsPack ?? base.opsPack,
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
      Boolean(ops.xiaohongshuBody?.trim()),
  );
}
