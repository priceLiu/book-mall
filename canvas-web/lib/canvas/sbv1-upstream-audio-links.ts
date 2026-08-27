import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import type { LibtvAudioNodeData } from "./libtv-audio-task-apply";
import { edgeMatchesSbv1VideoRefInput } from "./sbv1-upstream-ref-links";

export type Sbv1UpstreamAudioLink = {
  id: string;
  index: number;
  label: string;
  previewUrl?: string;
  sourceNodeId: string;
  edgeId: string;
};

function isAudioUpstreamNode(
  node: Pick<CanvasFlowNode, "type"> | undefined,
): boolean {
  return node?.type === "story-pro2-audio";
}

function audioUrlFromNode(node: CanvasFlowNode): string | undefined {
  const d = node.data as LibtvAudioNodeData & {
    runtime?: { ossUrl?: string; ephemeralUrl?: string };
  };
  const oss = String(d.ossUrl ?? d.runtime?.ossUrl ?? "").trim();
  if (/^https?:\/\//.test(oss)) return oss;
  const blob = String(d.blobUrl ?? d.runtime?.ephemeralUrl ?? "").trim();
  if (/^https?:\/\//.test(blob)) return blob;
  return undefined;
}

/** sbv1-video-engine 入边中的音频上游（story-pro2-audio） */
export function resolveSbv1UpstreamAudioLinks(
  engineNodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): Sbv1UpstreamAudioLink[] {
  const incoming = edges.filter((e) =>
    edgeMatchesSbv1VideoRefInput(e, engineNodeId, nodes),
  );
  const links: Sbv1UpstreamAudioLink[] = [];
  let index = 0;
  for (const edge of incoming) {
    const source = nodes.find((n) => n.id === edge.source);
    if (!source || !isAudioUpstreamNode(source)) continue;
    index += 1;
    links.push({
      id: `sbv1-audio-${source.id}`,
      index,
      label: `音频 ${index}`,
      previewUrl: audioUrlFromNode(source),
      sourceNodeId: source.id,
      edgeId: edge.id,
    });
  }
  return links;
}

export function resolveSbv1UpstreamAudioUrls(
  engineNodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): string[] {
  const urls: string[] = [];
  for (const link of resolveSbv1UpstreamAudioLinks(engineNodeId, nodes, edges)) {
    const node = nodes.find((n) => n.id === link.sourceNodeId);
    if (!node) continue;
    const url = audioUrlFromNode(node);
    if (url) urls.push(url);
  }
  return [...new Set(urls)];
}
