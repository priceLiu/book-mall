import type { ToolSuiteNavKey } from "@/lib/tool-suite-nav-keys";

/** toolKey / clientPage 前缀 → navKey（Phase D 月费分组）。 */
export function toolKeyToServiceNavKey(toolKey: string): ToolSuiteNavKey | null {
  const t = toolKey.trim();
  if (!t) return null;
  if (t === "fitting-room" || t.startsWith("fitting-room__")) return "fitting-room";
  if (t === "text-to-image" || t.startsWith("text-to-image__")) return "text-to-image";
  if (t === "image-to-video" || t.startsWith("image-to-video__")) return "image-to-video";
  if (t === "visual-lab" || t.startsWith("visual-lab__")) return "visual-lab";
  if (t === "smart-support" || t.startsWith("smart-support__")) return "smart-support";
  return null;
}

export function clientPageToServiceNavKey(clientPage: string): ToolSuiteNavKey | null {
  const p = clientPage.trim().toLowerCase();
  if (p.startsWith("canvas") || p.includes("ai-poster")) return "ai-poster-canvas";
  if (p.startsWith("story") || p.includes("story-theater")) return "story-theater";
  return toolKeyToServiceNavKey(p);
}
