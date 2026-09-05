"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { AlertTriangle, GripVertical, Music } from "lucide-react";
import { useDelayedPointerHover } from "@/lib/canvas/use-delayed-pointer-hover";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  LIBTV_AUDIO_MINI_PLAYER_HEIGHT,
  LIBTV_CARD_DRAG_CLASS,
  LIBTV_NODE_HANDLE_CLASS,
  LIBTV_NODE_OUTER_CLASS,
  LIBTV_NODE_SIDE_PLUS_LAYER_CLASS,
  LIBTV_NODE_SIDE_PLUS_SIZE,
  libtvNodeBorderStyle,
  libtvNodeInteractiveBorderClass,
} from "@/lib/canvas/libtv-node-chrome";
import {
  libtvMediaPreviewCanFallbackToBlob,
  resolveLibtvMediaPreviewUrl,
} from "@/lib/canvas/libtv-media-preview-url";
import { useLibtvIsNodeSoleSelected } from "@/lib/canvas/libtv-floating-dock-selection";
import { PRO2_TEXT_NODE_TITLE_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import { cn } from "@/lib/utils";
import {
  crewNodeShowsParticipatingBadge,
  useLibtvNodeDuplicate,
} from "./libtv-node-header-bar";
import { Pro2CrewTaskStatusBadge } from "./pro2/pro2-crew-task-status-badge";
import { Pro2ImageNodeToolbar } from "./pro2/pro2-image-node-toolbar";
import { LibtvNodeToolbarPortal } from "./libtv-node-toolbar-portal";
import { Pro2NodeSidePlus } from "./pro2/pro2-node-side-plus";
import type { Pro2AddMenuSection } from "@/lib/canvas/pro2-add-node-menu";
import {
  mergeLibtvAudioRunText,
  resolveLibtvAudioPredecessorTexts,
} from "@/lib/canvas/libtv-audio-run-text";
import { resolvePro2DockUpstreamLinks } from "@/lib/canvas/pro2-dock-upstream-links";
import {
  LibtvMediaGeneratingState,
  isLibtvMediaGenerating,
} from "./libtv-media-generating-state";
import type { LibtvAudioNodeData } from "@/lib/canvas/libtv-audio-task-apply";
import { LibtvMiniAudioPlayer } from "./libtv-mini-audio-player";
import { resolveLibtvAudioDisplayTitle } from "@/lib/canvas/libtv-audio-display-title";
import { LibtvEditableNodeTitle } from "./libtv-editable-node-title";

export type LibtvAudioNodeProps = NodeProps & {
  leftMenuSections: Pro2AddMenuSection[];
  rightMenuSections: Pro2AddMenuSection[];
  onSidePickLeft: (itemId: string, nodeType?: string) => void;
  onSidePickRight: (itemId: string, nodeType?: string) => void;
  onSelectAfterDuplicate: (newId: string) => void;
};

/** LibTV 统一音频节点（影视专业 2.0） */
export function LibtvAudioNode({
  id,
  data,
  selected,
  leftMenuSections,
  rightMenuSections,
  onSidePickLeft,
  onSidePickRight,
}: LibtvAudioNodeProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const graphMeta = useCanvasStore((s) => s.graphMeta);
  const connectingFromNodeId = useCanvasStore((s) => s.connectingFromNodeId);
  const { hovered, onPointerEnter, onPointerLeave } = useDelayedPointerHover();
  const [preferBlobPreview, setPreferBlobPreview] = useState(false);

  const d = data as unknown as LibtvAudioNodeData;
  useEffect(() => {
    setPreferBlobPreview(false);
  }, [d.ossUrl, d.blobUrl, d.uploading]);

  const previewUrl = useMemo(
    () =>
      resolveLibtvMediaPreviewUrl({
        ossUrl: d.ossUrl,
        blobUrl: d.blobUrl,
        uploading: d.uploading,
        preferBlob: preferBlobPreview,
      }),
    [d.ossUrl, d.blobUrl, d.uploading, preferBlobPreview],
  );

  const onPreviewLoadError = useCallback(() => {
    if (libtvMediaPreviewCanFallbackToBlob(d)) {
      setPreferBlobPreview(true);
    }
  }, [d]);

  const hasAudio = Boolean(previewUrl);
  const isGenerating = isLibtvMediaGenerating(d);
  const hasRuntimeError = d.runtime?.status === "error";
  const hasUploadError = Boolean(d.uploadError?.trim()) && !isGenerating;
  const hasError = hasRuntimeError || hasUploadError;
  const errorMessage =
    d.uploadError?.trim() ||
    d.runtime?.failMessage?.trim() ||
    "生成失败，请重试";

  const displayTitle = useMemo(() => {
    const upstreamLinks = resolvePro2DockUpstreamLinks(
      id,
      "story-pro2-audio",
      nodes,
      edges,
    );
    const dialogueText = mergeLibtvAudioRunText(
      String(d.dockInput ?? ""),
      upstreamLinks,
      resolveLibtvAudioPredecessorTexts(nodes, edges, id),
    );
    return resolveLibtvAudioDisplayTitle({
      label: d.label,
      dockInput: d.dockInput,
      dialogueText,
      ossUrl: d.ossUrl,
      hasAudio,
    });
  }, [id, d.label, d.dockInput, d.ossUrl, hasAudio, nodes, edges]);

  const defaultNodeLabel = useMemo(() => {
    const audios = nodes.filter((n) => n.type === "story-pro2-audio");
    const idx = audios.findIndex((n) => n.id === id);
    return `音频 ${idx >= 0 ? idx + 1 : ""}`.trim();
  }, [nodes, id]);

  const soleSelected = useLibtvIsNodeSoleSelected(id, Boolean(selected));
  const showSidePlus = Boolean(
    (hovered || selected || connectingFromNodeId) && !isGenerating,
  );
  const showToolbar = soleSelected && hasAudio && !isGenerating;

  const onDuplicateNode = useLibtvNodeDuplicate(id, "story-pro2-audio");

  const playerShellClass = cn(
    "relative w-full shrink-0 overflow-hidden rounded-[12px]",
    libtvNodeInteractiveBorderClass({ selected: !!selected, edition: "audio" }),
  );
  const playerShellStyle = libtvNodeBorderStyle({
    selected: !!selected,
    edition: "audio",
  });
  const playerHeightPx = LIBTV_AUDIO_MINI_PLAYER_HEIGHT;

  return (
    <div
      className={cn(LIBTV_NODE_OUTER_CLASS, LIBTV_CARD_DRAG_CLASS, "flex flex-col")}
      data-pro2-dock-anchor={id}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <Handle
        id="in_audio"
        type="target"
        position={Position.Left}
        className={cn(
          LIBTV_NODE_HANDLE_CLASS,
          showSidePlus
            ? "pointer-events-none opacity-0"
            : selected
              ? "opacity-100"
              : "pointer-events-none opacity-0",
        )}
        title="上游文本/参考"
      />
      <Handle
        id="audio"
        type="source"
        position={Position.Right}
        className={cn(
          LIBTV_NODE_HANDLE_CLASS,
          showSidePlus
            ? "pointer-events-none opacity-0"
            : selected
              ? "opacity-100"
              : "pointer-events-none opacity-0",
        )}
        title="连线到下游"
      />

      <Pro2NodeSidePlus
        side="left"
        handleId="plus_left"
        visible={showSidePlus}
        size={LIBTV_NODE_SIDE_PLUS_SIZE}
        className={LIBTV_NODE_SIDE_PLUS_LAYER_CLASS}
        sections={leftMenuSections}
        onPick={onSidePickLeft}
      />
      <Pro2NodeSidePlus
        side="right"
        handleId="audio"
        visible={showSidePlus}
        size={LIBTV_NODE_SIDE_PLUS_SIZE}
        className={LIBTV_NODE_SIDE_PLUS_LAYER_CLASS}
        sections={rightMenuSections}
        onPick={onSidePickRight}
      />

      {showToolbar ? (
        <LibtvNodeToolbarPortal nodeId={id} visible={showToolbar}>
          <Pro2ImageNodeToolbar
            passNodeDrag
            minimal
            previewUrl={previewUrl}
            onDuplicateNode={onDuplicateNode}
          />
        </LibtvNodeToolbarPortal>
      ) : null}

      <div className={cn(PRO2_TEXT_NODE_TITLE_CLASS, "relative mb-1.5 shrink-0")}>
        <GripVertical className="size-3.5 shrink-0 text-white/30" />
        <Music className="size-3.5 shrink-0 text-emerald-300" />
        <LibtvEditableNodeTitle
          nodeId={id}
          defaultLabel={defaultNodeLabel}
          textClassName="text-[11px] text-white"
        />
        {crewNodeShowsParticipatingBadge(id, nodes, graphMeta) ? (
          <Pro2CrewTaskStatusBadge nodeId={id} />
        ) : null}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-visible bg-transparent shadow-none">
        {isGenerating ? (
          <div
            className={playerShellClass}
            style={{ ...playerShellStyle, height: playerHeightPx }}
          >
            <LibtvMiniAudioPlayer
              passNodeDrag
              title={displayTitle}
              controlsEnabled={false}
              className="h-full"
            />
            <div className="absolute inset-0">
              <LibtvMediaGeneratingState
                variant="violet"
                cancelNodeId={id}
                passNodeDrag
              />
            </div>
          </div>
        ) : hasError ? (
          <div
            className={playerShellClass}
            style={{ ...playerShellStyle, height: playerHeightPx }}
          >
            <LibtvMiniAudioPlayer
              passNodeDrag
              title={displayTitle}
              controlsEnabled={false}
              className="h-full"
            />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/55 px-3 text-center">
              <AlertTriangle className="size-4 text-red-400/90" strokeWidth={1.5} />
              <p className="line-clamp-2 text-[10px] leading-snug text-red-200/90">
                {errorMessage}
              </p>
            </div>
          </div>
        ) : (
          <div
            className={playerShellClass}
            style={{ ...playerShellStyle, height: playerHeightPx }}
          >
            <LibtvMiniAudioPlayer
              passNodeDrag
              src={previewUrl ?? undefined}
              title={displayTitle}
              controlsEnabled={hasAudio}
              onMediaError={onPreviewLoadError}
              className="h-full"
            />
          </div>
        )}
      </div>
    </div>
  );
}
