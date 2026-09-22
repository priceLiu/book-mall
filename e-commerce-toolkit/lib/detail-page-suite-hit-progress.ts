import type { DetailPageSuiteProject } from "@/lib/detail-page-suite-types";

export function isHitDecomposeInFlight(
  meta: DetailPageSuiteProject["meta"] | null,
): boolean {
  const s = meta?.hitStatus;
  return s === "decomposing" || s === "polishing";
}

export function hitJobProgressPercent(
  meta: DetailPageSuiteProject["meta"] | null,
): number | null {
  const p = meta?.hitProgress?.percent;
  return typeof p === "number" ? Math.min(100, Math.max(0, p)) : null;
}

export function hitDecomposeStatusCopy(
  meta: DetailPageSuiteProject["meta"] | null,
): { title: string; detail: string } | null {
  if (!isHitDecomposeInFlight(meta)) return null;
  const p = meta?.hitProgress;
  if (p?.title?.trim()) {
    return {
      title: p.title.trim(),
      detail: p.detail?.trim() ?? "",
    };
  }
  if (meta?.hitStatus === "decomposing") {
    return {
      title: "拆解爆款范式",
      detail: p?.detail?.trim() || "识别结构骨架、叙事节奏与场景氛围…",
    };
  }
  return {
    title: "原创重写文案",
    detail: p?.detail?.trim() || "按爆款节奏重写全套文案与出图提示词…",
  };
}
