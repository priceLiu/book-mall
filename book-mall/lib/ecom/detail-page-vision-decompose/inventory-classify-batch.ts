/** 单次归类 LLM 请求的 segment 上限，避免 49 条 × 大 JSON 触发上游 10min 超时 */
export const DETAIL_PAGE_VISION_CLASSIFY_BATCH_SIZE = 12;

export function chunkDetailPageVisionSegments<T>(items: T[], size: number): T[][] {
  if (size <= 0) return items.length ? [items] : [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
