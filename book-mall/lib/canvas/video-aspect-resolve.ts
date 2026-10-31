/**
 * 画布 / 分镜视频 · 提交厂商时的画幅比例。
 * 产品规则：用户选了固定比例（16:9 等）则必须原样提交，不得因参考图/参考视频改为 adaptive。
 */

const FIXED_VIDEO_ASPECTS = new Set([
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "3:4",
]);

export function resolveCanvasVideoAspectRatio(
  params: Record<string, unknown>,
  nodeAspectRatio?: string | null,
): string {
  const fromNode = nodeAspectRatio?.trim() ?? "";
  const fromParams = String(params.ratio ?? params.aspect_ratio ?? "").trim();

  /** 节点 data.aspectRatio（Dock 选择）优先于 engine.params 残留 */
  if (fromNode && FIXED_VIDEO_ASPECTS.has(fromNode)) return fromNode;
  if (fromParams && FIXED_VIDEO_ASPECTS.has(fromParams)) return fromParams;

  if (fromNode === "adaptive" || fromNode === "auto") return "adaptive";
  if (fromParams === "adaptive" || fromParams === "auto") return "adaptive";

  return fromNode || fromParams || "16:9";
}
