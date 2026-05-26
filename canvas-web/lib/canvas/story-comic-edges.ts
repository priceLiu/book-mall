import { nanoid } from "nanoid";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { hasStoryComicPipeline } from "./story-comic-layout";

const PREVIEW_TYPES = new Set([
  "md-preview",
  "image-preview",
  "video-preview",
  "audio-preview",
]);

/** hydrate 时移除只读预览节点及关联边 */
export function stripStoryPreviewNodes(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): { nodes: CanvasFlowNode[]; edges: CanvasFlowEdge[] } {
  const drop = new Set(
    nodes.filter((n) => PREVIEW_TYPES.has(n.type ?? "")).map((n) => n.id),
  );
  if (drop.size === 0) return { nodes, edges };
  return {
    nodes: nodes.filter((n) => !drop.has(n.id)),
    edges: edges.filter((e) => !drop.has(e.source) && !drop.has(e.target)),
  };
}

function hasEdge(
  edges: CanvasFlowEdge[],
  source: string,
  target: string,
): boolean {
  return edges.some((e) => e.source === source && e.target === target);
}

function upsertEdge(
  edges: CanvasFlowEdge[],
  edge: Omit<CanvasFlowEdge, "id"> & { id?: string },
): CanvasFlowEdge[] {
  const idx = edges.findIndex(
    (e) => e.source === edge.source && e.target === edge.target,
  );
  const next = { ...edge, id: edge.id ?? `e_${nanoid(8)}` } as CanvasFlowEdge;
  if (idx >= 0) {
    return edges.map((e, i) => (i === idx ? { ...e, ...next } : e));
  }
  return [...edges, next];
}

/**
 * 补全 / 修正漫剧连线（克隆后丢失、批量创建后缺边等）。
 */
export function repairStoryPreviewEdges(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowEdge[] {
  const stripped = stripStoryPreviewNodes(nodes, edges);
  nodes = stripped.nodes;
  let next = stripped.edges;

  if (!hasStoryComicPipeline(nodes)) return next;

  const charEngine = nodes.find((n) => n.type === "character-engine");
  const storyboard = nodes.find((n) => n.type === "storyboard-engine");
  const exportNode = nodes.find((n) => n.type === "jianying-export");

  for (const tv of nodes.filter((n) => n.type === "three-view-engine")) {
    const characterName = (tv.data as { characterName?: string }).characterName;

    // 勿把「角色引擎」整表 MD 直连三视图（仅经 [角色名] 文本节点注入单角色描述）
    if (charEngine) {
      next = next.filter(
        (e) =>
          !(
            e.source === charEngine.id &&
            e.target === tv.id &&
            e.targetHandle === "in_text"
          ),
      );
    }

    const descText = nodes.find((n) => {
      if (n.type !== "text") return false;
      const text = String((n.data as { text?: string }).text ?? "");
      if (!/^\[[^\]]+\]/.test(text)) return false;
      if (!characterName) return true;
      return text.startsWith(`[${characterName}]`);
    });
    if (descText) {
      next = upsertEdge(next, {
        source: descText.id,
        target: tv.id,
        sourceHandle: "text",
        targetHandle: "in_text",
      });
      if (charEngine && !hasEdge(next, charEngine.id, descText.id)) {
        next = upsertEdge(next, {
          source: charEngine.id,
          target: descText.id,
          sourceHandle: "text",
          targetHandle: "in_text",
        });
      }
    }
  }

  if (storyboard) {
    if (exportNode && !hasEdge(next, storyboard.id, exportNode.id)) {
      next = upsertEdge(next, {
        source: storyboard.id,
        target: exportNode.id,
        sourceHandle: "text",
        targetHandle: "in_storyboard",
      });
    }

    for (const n of nodes.filter(
      (x) =>
        x.type === "image-engine" ||
        x.type === "video-engine" ||
        x.type === "tts-engine",
    )) {
      if (!hasEdge(next, storyboard.id, n.id)) {
        next = upsertEdge(next, {
          source: storyboard.id,
          target: n.id,
          sourceHandle: "text",
          targetHandle: "in_text",
        });
      }

      if (n.type === "video-engine") {
        const fi = (n.data as { frameIndex?: number }).frameIndex;
        const img = nodes.find(
          (x) =>
            x.type === "image-engine" &&
            (x.data as { frameIndex?: number }).frameIndex === fi,
        );
        if (img && !hasEdge(next, img.id, n.id)) {
          next = upsertEdge(next, {
            source: img.id,
            target: n.id,
            sourceHandle: "image",
            targetHandle: "in_image",
          });
        }
        if (exportNode && !hasEdge(next, n.id, exportNode.id)) {
          next = upsertEdge(next, {
            source: n.id,
            target: exportNode.id,
            sourceHandle: "video",
            targetHandle: "in_video",
          });
        }
      }

      if (n.type === "tts-engine" && exportNode) {
        if (!hasEdge(next, n.id, exportNode.id)) {
          next = upsertEdge(next, {
            source: n.id,
            target: exportNode.id,
            sourceHandle: "audio",
            targetHandle: "in_storyboard",
          });
        }
      }
    }
  }

  const videoCol = nodes.find((n) => n.type === "story-video-column");
  const frameCol = nodes.find((n) => n.type === "story-frame-column");
  if (exportNode && videoCol && !hasEdge(next, videoCol.id, exportNode.id)) {
    next = upsertEdge(next, {
      source: videoCol.id,
      target: exportNode.id,
      sourceHandle: "text",
      targetHandle: "in_storyboard",
    });
  }
  if (exportNode && frameCol && !hasEdge(next, frameCol.id, exportNode.id)) {
    next = upsertEdge(next, {
      source: frameCol.id,
      target: exportNode.id,
      sourceHandle: "text",
      targetHandle: "in_storyboard",
    });
  }

  return next;
}
