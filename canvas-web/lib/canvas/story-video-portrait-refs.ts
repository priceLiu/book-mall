import type { CanvasFlowNode } from "./types";
import {
  portraitAssetRefFromNodeData,
  type CanvasPortraitNodeFields,
} from "./portrait-node-data";

const PORTRAIT_IMAGE_TYPES = new Set(["story-pro2-image", "sbv1-image"]);

/** Pro2/Story 分镜视频行 · 从关联的 LibTV 图片节点收集 asset:// */
export function resolveStoryVideoRowPortraitAssetRefs(
  nodes: CanvasFlowNode[],
  opts: {
    rowKey: string;
    frameColumnId?: string;
    referencedNodeIds?: string[];
    videoReferencedNodeIds?: string[];
  },
): Array<{ url: string; role: "reference_image" }> {
  const out: Array<{ url: string; role: "reference_image" }> = [];
  const seen = new Set<string>();

  const pushRef = (n: CanvasFlowNode | undefined) => {
    if (!n) return;
    const ref = portraitAssetRefFromNodeData(
      n.data as CanvasPortraitNodeFields,
    );
    if (!ref || seen.has(ref.url)) return;
    seen.add(ref.url);
    out.push(ref);
  };

  for (const nid of [
    ...(opts.referencedNodeIds ?? []),
    ...(opts.videoReferencedNodeIds ?? []),
  ]) {
    pushRef(nodes.find((n) => n.id === nid));
  }

  if (opts.frameColumnId) {
    for (const n of nodes) {
      if (!PORTRAIT_IMAGE_TYPES.has(n.type ?? "")) continue;
      const d = n.data as {
        pro2ControllerNodeId?: string;
        pro2RowKey?: string;
      };
      if (
        d.pro2ControllerNodeId === opts.frameColumnId &&
        d.pro2RowKey === opts.rowKey
      ) {
        pushRef(n);
      }
    }
  }

  return out;
}
