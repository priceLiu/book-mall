import type { StoryboardSheet } from "@/lib/storyboard-types";

/** BFF 代理连 book-mall 失败时，服务端可能已完成写入 */
export function isStoryboardUpstreamTransportError(message: string): boolean {
  return /upstream_fetch_failed/i.test(message.trim());
}

type PanelRow = StoryboardSheet["panels"][number];

/** 批量生成结束后：若镜头已有 imageUrl/videoUrl，从失败列表剔除 */
export function filterStoryboardBatchFailuresByPanelMedia(
  failures: { index: number; message: string }[],
  panels: readonly PanelRow[],
  kind: "image" | "video",
): { index: number; message: string }[] {
  return failures.filter((f) => {
    const panel = panels.find((p) => p.index === f.index);
    if (!panel) return true;
    const url = kind === "image" ? panel.imageUrl : panel.videoUrl;
    return !url?.trim();
  });
}

export function storyboardPanelHasMedia(
  panels: readonly PanelRow[],
  panelIndex: number,
  kind: "image" | "video",
): boolean {
  const panel = panels.find((p) => p.index === panelIndex);
  if (!panel) return false;
  const url = kind === "image" ? panel.imageUrl : panel.videoUrl;
  return Boolean(url?.trim());
}
