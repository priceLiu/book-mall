import type { LocalEditBbox, LocalEditSelection } from "./types";

/** 常用工具 / 电商 retouch 请求体 · mask 或 bbox → 统一选区 */
export function buildLocalEditSelectionFromRetouchInput(opts: {
  maskImageDataUrl?: string;
  bbox?: LocalEditBbox;
}): LocalEditSelection | undefined {
  if (opts.maskImageDataUrl?.trim()) {
    return { kind: "mask", maskDataUrl: opts.maskImageDataUrl.trim() };
  }
  if (opts.bbox) {
    return { kind: "bbox", bbox: opts.bbox };
  }
  return undefined;
}

/** Platform API / 画布 BFF · 解析 selection 对象 */
export function parseLocalEditSelection(raw: unknown): LocalEditSelection | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Record<string, unknown>;
  const kind = s.kind;
  if (kind === "mask" && typeof s.maskDataUrl === "string") {
    return { kind: "mask", maskDataUrl: s.maskDataUrl.trim() };
  }
  if (kind === "bbox" && Array.isArray(s.bbox) && s.bbox.length === 4) {
    const nums = s.bbox.map((v) => Number(v));
    if (nums.every((n) => Number.isFinite(n))) {
      return { kind: "bbox", bbox: nums as LocalEditBbox };
    }
  }
  if (kind === "multi-bbox" && Array.isArray(s.bboxList)) {
    return {
      kind: "multi-bbox",
      bboxList: s.bboxList as LocalEditSelection extends { kind: "multi-bbox" }
        ? LocalEditSelection["bboxList"]
        : never,
    };
  }
  return undefined;
}
