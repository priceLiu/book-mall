import type { CanvasFlowNode } from "@/lib/canvas/types";

const PICKABLE_IMAGE_NODE_TYPES = new Set([
  "sbv1-image",
  "story-pro2-image",
  "story-pro2-three-view",
  "story-pro2-prop",
  "story-pro2-mood",
  "image-engine",
  "three-view-engine",
  "image",
]);

function readRuntime(data: Record<string, unknown>) {
  const runtime = data.runtime;
  return runtime && typeof runtime === "object" && !Array.isArray(runtime)
    ? (runtime as { ossUrl?: string; ephemeralUrl?: string; posterUrl?: string })
    : undefined;
}

function imageUrlFromNodeData(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;
  const runtime = readRuntime(d);

  const poster = runtime?.posterUrl?.trim();
  if (poster?.startsWith("http")) return poster;

  const direct = typeof d.ossUrl === "string" ? d.ossUrl.trim() : "";
  if (direct.startsWith("http")) return direct;

  const fromRuntime = runtime?.ossUrl?.trim();
  if (fromRuntime?.startsWith("http")) return fromRuntime;

  const imageUrl = typeof d.imageUrl === "string" ? d.imageUrl.trim() : "";
  if (imageUrl.startsWith("http")) return imageUrl;

  const ephemeral = runtime?.ephemeralUrl?.trim();
  if (ephemeral?.startsWith("http")) return ephemeral;

  return "";
}

export type Pro2WizardCanvasImagePick = {
  nodeId: string;
  label: string;
  url: string;
  nodeType: string;
};

/** 向导 · 从当前画布收集可引用的图片节点 */
export function listPro2WizardCanvasImagePicks(
  nodes: CanvasFlowNode[],
): Pro2WizardCanvasImagePick[] {
  const out: Pro2WizardCanvasImagePick[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    const type = node.type ?? "";
    if (!PICKABLE_IMAGE_NODE_TYPES.has(type)) continue;
    const url = imageUrlFromNodeData(node.data);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const label =
      (typeof (node.data as { label?: string }).label === "string"
        ? (node.data as { label: string }).label.trim()
        : "") || type;
    out.push({ nodeId: node.id, label, url, nodeType: type });
  }
  return out;
}
