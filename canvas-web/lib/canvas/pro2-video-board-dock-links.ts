"use client";

import { buildFrameRowScriptPrompt } from "./story-column-sync";
import type { Pro2DockUpstreamLink } from "./pro2-dock-upstream-links";
import { resolvePro2FrameBoardGroupIdForColumn } from "./pro2-resolve-frame-board-group";
import { pickRuntimeImagePreviewUrl } from "./task-media-url";
import type { StoryProFrameRow } from "./story-pro-workspace-types";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

function isPro2VideoBoardCell(node: CanvasFlowNode | undefined): boolean {
  if (!node || node.type !== "sbv1-video-engine") return false;
  const d = node.data as {
    pro2MediaRole?: string;
    pro2ControllerNodeId?: string;
  };
  return (
    d.pro2MediaRole === "video" && Boolean(d.pro2ControllerNodeId?.trim())
  );
}

/** 分镜视频组格 Dock · 注入同镜分镜图 + 分镜脚本 @ 引用 */
export function resolvePro2VideoBoardCellDockLinks(
  nodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): Pro2DockUpstreamLink[] {
  const node = nodes.find((n) => n.id === nodeId);
  if (!isPro2VideoBoardCell(node)) return [];

  const d = node!.data as {
    pro2ControllerNodeId?: string;
    pro2RowKey?: string;
  };
  const rowKey = d.pro2RowKey?.trim();
  const videoCol = nodes.find((n) => n.id === d.pro2ControllerNodeId);
  const frameColumnId = (
    videoCol?.data as { frameColumnId?: string }
  )?.frameColumnId?.trim();
  if (!frameColumnId || !rowKey) return [];

  const out: Pro2DockUpstreamLink[] = [];
  const seen = new Set<string>();

  const push = (link: Pro2DockUpstreamLink) => {
    if (seen.has(link.id)) return;
    seen.add(link.id);
    out.push(link);
  };

  const refEdge = edges.find(
    (e) => e.target === nodeId && e.targetHandle === "in_ref",
  );
  let frameImg = refEdge
    ? nodes.find((n) => n.id === refEdge.source)
    : undefined;
  if (!frameImg) {
    frameImg = nodes.find(
      (n) =>
        n.type === "story-pro2-image" &&
        (n.data as { pro2ControllerNodeId?: string; pro2RowKey?: string })
          .pro2ControllerNodeId === frameColumnId &&
        (n.data as { pro2RowKey?: string }).pro2RowKey === rowKey,
    );
  }
  if (frameImg) {
    const url =
      (frameImg.data as { ossUrl?: string; blobUrl?: string }).ossUrl ??
      (frameImg.data as { blobUrl?: string }).blobUrl ??
      pickRuntimeImagePreviewUrl(
        (frameImg.data as { runtime?: { ossUrl?: string; ephemeralUrl?: string } })
          .runtime,
        undefined,
      );
    if (url) {
      push({
        id: `up-frame-img-${frameImg.id}`,
        kind: "image",
        label: ((frameImg.data as { label?: string }).label ?? "分镜图").trim(),
        previewUrl: url,
        sourceNodeId: frameImg.id,
      });
    }
  }

  const frameCol = nodes.find((n) => n.id === frameColumnId);
  const frameRows =
    ((frameCol?.data as { rows?: StoryProFrameRow[] })?.rows as
      | StoryProFrameRow[]
      | undefined) ?? [];
  const frameRow = frameRows.find((r) => r.key === rowKey);
  if (frameRow) {
    const script =
      frameRow.prompt?.trim() || buildFrameRowScriptPrompt(frameRow).trim();
    if (script) {
      push({
        id: `up-frame-script-${rowKey}`,
        kind: "text",
        label: `镜 ${frameRow.frameIndex} · 分镜脚本`,
        previewMd: script,
        sourceNodeId: frameColumnId,
      });
    }
  }

  return out;
}

/** 分镜视频组格 · 有效 prompt（prompt / dockInput / 同镜分镜脚本） */
export function resolvePro2VideoBoardCellDefaultPrompt(
  nodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): string {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return "";
  const d = node.data as { prompt?: string; dockInput?: string };
  const direct = d.prompt?.trim() || d.dockInput?.trim();
  if (direct) return direct;
  const script = resolvePro2VideoBoardCellDockLinks(nodeId, nodes, edges).find(
    (l) => l.kind === "text",
  )?.previewMd;
  return script?.trim() ?? "";
}

export function resolvePro2FrameBoardGroupIdForVideoColumn(
  videoColumnId: string,
  nodes: CanvasFlowNode[],
): string | null {
  const videoCol = nodes.find((n) => n.id === videoColumnId);
  const frameColumnId = (
    videoCol?.data as { frameColumnId?: string }
  )?.frameColumnId?.trim();
  if (!frameColumnId) return null;
  return resolvePro2FrameBoardGroupIdForColumn(frameColumnId, nodes);
}
