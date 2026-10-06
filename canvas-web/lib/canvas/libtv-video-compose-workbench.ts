import {
  jianyingSnapshotToWorkbench,
  type JianyingComposeSnapshotInput,
  type JianyingSnapshotClip,
} from "@private/platform-compose-ui";
import type { ComposeWorkbenchState } from "@private/platform-compose-ui/types";

import { resolveLibtvAudioHttpsExportUrlFromNode } from "@/lib/canvas/libtv-audio-export-url";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/types";

const LIBTV_AUDIO_SOURCE_TYPES = new Set([
  "sbv1-audio-engine",
  "story-pro2-audio",
  "audio-engine",
]);

function incomingUpstreamAudioNodes(
  hostNodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowNode[] {
  const incoming = edges.filter((e) => {
    if (e.target !== hostNodeId) return false;
    const src = nodes.find((n) => n.id === e.source);
    const isAudio =
      !!src && LIBTV_AUDIO_SOURCE_TYPES.has(src.type ?? "");
    if (isAudio) {
      return (
        !e.targetHandle ||
        e.targetHandle === "in_audio" ||
        e.targetHandle === "in_video"
      );
    }
    return e.targetHandle === "in_audio";
  });
  return incoming
    .map((e) => nodes.find((n) => n.id === e.source))
    .filter(
      (n): n is CanvasFlowNode =>
        !!n && LIBTV_AUDIO_SOURCE_TYPES.has(n.type ?? ""),
    );
}

function audioLabelFromNode(node: CanvasFlowNode): string {
  const d = node.data as {
    label?: string;
    crewTaskLabel?: string;
    dockInput?: string;
  };
  const dialogue = String(d.dockInput ?? "").trim().replace(/\s+/g, " ");
  if (dialogue) {
    return dialogue.length > 48 ? `${dialogue.slice(0, 47)}…` : dialogue;
  }
  return d.label?.trim() || d.crewTaskLabel?.trim() || "配音";
}

/** 节点简易剪辑 · 上游视频（本节点成片）+ 入边配音 */
export function buildLibtvVideoTrimUpstreamSnapshot(args: {
  nodeId: string;
  sourceVideoUrl: string;
  label: string;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
}): JianyingComposeSnapshotInput {
  const videoClips: JianyingSnapshotClip[] = [
    {
      sourceNodeId: args.nodeId,
      videoUrl: args.sourceVideoUrl.trim(),
      label: args.label.trim() || "节点视频",
    },
  ];
  const audioClips: JianyingSnapshotClip[] = incomingUpstreamAudioNodes(
    args.nodeId,
    args.nodes,
    args.edges,
  )
    .map((node) => {
      const audioUrl = resolveLibtvAudioHttpsExportUrlFromNode(node)?.trim();
      if (!audioUrl) return null;
      return {
        sourceNodeId: node.id,
        videoUrl: "",
        audioUrl,
        audioMediaKey: audioUrl,
        label: audioLabelFromNode(node),
      } satisfies JianyingSnapshotClip;
    })
    .filter((c): c is JianyingSnapshotClip => Boolean(c));

  return { videoClips, audioClips };
}

/** 合并 persisted 入出点/分割段；源 URL 变更时只刷新 URL，不丢剪辑结构 */
function dropRedundantUpstreamRootClip(
  state: ComposeWorkbenchState,
  upstreamNodeId: string,
): ComposeWorkbenchState {
  if (state.orderedClipIds.length <= 1) return state;
  const root = state.clips.find((c) => c.id === upstreamNodeId);
  if (!root?.videoUrl?.trim()) return state;
  const hasTrim =
    (root.sourceStartSec != null && root.sourceStartSec > 0.02) ||
    root.sourceEndSec != null;
  if (hasTrim) return state;
  const hasSplitSiblings = state.orderedClipIds.some(
    (id) => id !== upstreamNodeId,
  );
  if (!hasSplitSiblings) return state;
  return {
    ...state,
    orderedClipIds: state.orderedClipIds.filter((id) => id !== upstreamNodeId),
    clips: state.clips.filter((c) => c.id !== upstreamNodeId),
  };
}

export function cloneComposeWorkbenchState(
  state: ComposeWorkbenchState,
): ComposeWorkbenchState {
  return JSON.parse(JSON.stringify(state)) as ComposeWorkbenchState;
}

export function resolveLibtvVideoTrimWorkbench(args: {
  nodeId: string;
  sourceVideoUrl: string;
  label: string;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  persisted?: ComposeWorkbenchState | null;
}): ComposeWorkbenchState {
  const snapshot = buildLibtvVideoTrimUpstreamSnapshot(args);
  const merged = jianyingSnapshotToWorkbench(snapshot, args.persisted ?? null);
  return dropRedundantUpstreamRootClip(merged, args.nodeId);
}
