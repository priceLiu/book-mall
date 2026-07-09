"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { AlertTriangle, Music, Pause, Play } from "lucide-react";
import { useDelayedPointerHover } from "@/lib/canvas/use-delayed-pointer-hover";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  LIBTV_CARD_DRAG_CLASS,
  LIBTV_MEDIA_CARD_SHELL_CLASS,
  LIBTV_MEDIA_STAGE_CLASS,
  LIBTV_NODE_HANDLE_CLASS,
  LIBTV_NODE_OUTER_CLASS,
  LIBTV_NODE_SIDE_PLUS_LAYER_CLASS,
  LIBTV_NODE_SIDE_PLUS_SIZE,
  libtvNodeBorderStyle,
} from "@/lib/canvas/libtv-node-chrome";
import {
  libtvMediaPreviewCanFallbackToBlob,
  resolveLibtvMediaPreviewUrl,
} from "@/lib/canvas/libtv-media-preview-url";
import { useLibtvIsNodeSoleSelected } from "@/lib/canvas/libtv-floating-dock-selection";
import { cn } from "@/lib/utils";
import { LibtvNodeHeaderActions } from "./libtv-node-header-preview-button";
import { useLibtvNodeDuplicate } from "./libtv-node-header-bar";
import { Pro2CrewTaskStatusBadge } from "./pro2/pro2-crew-task-status-badge";
import { Pro2ImageNodeToolbar } from "./pro2/pro2-image-node-toolbar";
import { LibtvNodeToolbarPortal } from "./libtv-node-toolbar-portal";
import { LibtvEditableNodeTitle } from "./libtv-editable-node-title";
import {
  Pro2MediaNodeEmptyState,
  Pro2MediaNodeErrorState,
} from "./pro2/pro2-media-node-empty";
import { Pro2NodeSidePlus } from "./pro2/pro2-node-side-plus";
import type { Pro2AddMenuSection } from "@/lib/canvas/pro2-add-node-menu";
import {
  LibtvMediaGeneratingState,
  isLibtvMediaGenerating,
} from "./libtv-media-generating-state";
import type { LibtvAudioNodeData } from "@/lib/canvas/libtv-audio-task-apply";

function formatAudioTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function LibtvAudioWaveform({
  src,
  playing,
  onTogglePlay,
  onTimeUpdate,
}: {
  src: string;
  playing: boolean;
  onTogglePlay: () => void;
  onTimeUpdate: (current: number, duration: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      void el.play().catch(() => undefined);
    } else {
      el.pause();
    }
  }, [playing, src]);

  useEffect(() => {
    setCurrent(0);
    setDuration(0);
  }, [src]);

  const progress = duration > 0 ? current / duration : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 pb-3 pt-1">
      <div className="relative flex h-16 items-end gap-0.5 overflow-hidden rounded-lg bg-black/35 px-2 py-2">
        {Array.from({ length: 48 }).map((_, i) => {
          const h = 18 + ((i * 17) % 55);
          const lit = i / 48 <= progress;
          return (
            <span
              key={i}
              className={cn(
                "w-1 shrink-0 rounded-full transition-colors",
                lit ? "bg-white/85" : "bg-white/20",
              )}
              style={{ height: `${h}%` }}
            />
          );
        })}
        <span
          className="pointer-events-none absolute bottom-0 top-0 w-px bg-rose-500/90"
          style={{ left: `${Math.min(100, progress * 100)}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="nodrag flex size-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/15"
          onClick={onTogglePlay}
          aria-label={playing ? "暂停" : "播放"}
        >
          {playing ? (
            <Pause className="size-3.5" />
          ) : (
            <Play className="size-3.5 translate-x-px" />
          )}
        </button>
        <span className="text-[11px] tabular-nums text-white/55">
          {formatAudioTime(current)} / {formatAudioTime(duration)}
        </span>
      </div>
      <audio
        ref={audioRef}
        src={src}
        className="hidden"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          setDuration(d);
          onTimeUpdate(e.currentTarget.currentTime, d);
        }}
        onTimeUpdate={(e) => {
          const c = e.currentTarget.currentTime;
          const d = e.currentTarget.duration || duration;
          setCurrent(c);
          onTimeUpdate(c, d);
        }}
        onEnded={() => onTogglePlay()}
      />
    </div>
  );
}

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
  onSelectAfterDuplicate,
}: LibtvAudioNodeProps) {
  const connectingFromNodeId = useCanvasStore((s) => s.connectingFromNodeId);
  const { hovered, onPointerEnter, onPointerLeave } = useDelayedPointerHover();
  const [playing, setPlaying] = useState(false);
  const [preferBlobPreview, setPreferBlobPreview] = useState(false);

  const d = data as unknown as LibtvAudioNodeData;
  useEffect(() => {
    setPreferBlobPreview(false);
    setPlaying(false);
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

  const soleSelected = useLibtvIsNodeSoleSelected(id, Boolean(selected));
  const showSidePlus = soleSelected && !connectingFromNodeId;
  const showToolbar = soleSelected && hasAudio && !isGenerating;

  const onDuplicateNode = useLibtvNodeDuplicate(id, "story-pro2-audio");

  const renderStage = () => {
    if (isGenerating) {
      return <LibtvMediaGeneratingState variant="violet" />;
    }
    if (hasAudio && previewUrl) {
      return (
        <LibtvAudioWaveform
          src={previewUrl}
          playing={playing}
          onTogglePlay={() => setPlaying((p) => !p)}
          onTimeUpdate={() => {
            if (preferBlobPreview) return;
            onPreviewLoadError();
          }}
        />
      );
    }
    if (hasError) {
      return (
        <Pro2MediaNodeErrorState
          icon={AlertTriangle}
          title="生成失败"
          message={errorMessage}
        />
      );
    }
    return (
      <Pro2MediaNodeEmptyState
        icon={Music}
        label="添加或生成音频"
        passNodeDrag
      />
    );
  };

  return (
    <div
      className={LIBTV_NODE_OUTER_CLASS}
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

      <div
        className={cn(
          LIBTV_MEDIA_CARD_SHELL_CLASS,
          LIBTV_CARD_DRAG_CLASS,
          "min-h-0 flex-1",
        )}
        style={libtvNodeBorderStyle({
          selected,
          hovered,
          edition: "pro2",
        })}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Music className={cn("size-3.5 shrink-0", "text-white/70")} />
            <LibtvEditableNodeTitle
              nodeId={id}
              defaultLabel="音频"
              textClassName="text-[12px] font-medium text-white/90"
            />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Pro2CrewTaskStatusBadge nodeId={id} />
            <LibtvNodeHeaderActions
              previewDisabled={!hasAudio}
              onExpandPreview={() => {
                if (previewUrl) setPlaying(true);
              }}
            />
          </div>
        </div>
        <div className={cn(LIBTV_MEDIA_STAGE_CLASS, "relative min-h-0 flex-1")}>
          {renderStage()}
        </div>
      </div>
    </div>
  );
}
