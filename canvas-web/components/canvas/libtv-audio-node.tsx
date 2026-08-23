"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
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
import { Pro2NodeSidePlus } from "./pro2/pro2-node-side-plus";
import type { Pro2AddMenuSection } from "@/lib/canvas/pro2-add-node-menu";
import {
  LibtvMediaGeneratingState,
  isLibtvMediaGenerating,
} from "./libtv-media-generating-state";
import type { LibtvAudioNodeData } from "@/lib/canvas/libtv-audio-task-apply";
import { LIBTV_AUDIO_TRACK_WAVEFORM_HEIGHT } from "@/lib/canvas/libtv-node-chrome";

function formatAudioTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function buildAudioWavePath(
  width: number,
  height: number,
  amplitude: number,
  cycles: number,
): string {
  const mid = height / 2;
  const steps = 200;
  let d = "";
  for (let i = 0; i <= steps; i += 1) {
    const x = (i / steps) * width;
    const y = mid + amplitude * Math.sin((i / steps) * Math.PI * 2 * cycles);
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  return d;
}

const AUDIO_WAVE_VIEW_W = 800;
const AUDIO_WAVE_VIEW_H = 40;
const AUDIO_WAVE_PATH = buildAudioWavePath(AUDIO_WAVE_VIEW_W, AUDIO_WAVE_VIEW_H, 12, 5);

/** 横向录音波形 · 连续波浪线 */
function LibtvAudioWaveLine({
  progress = 0,
  className,
}: {
  progress?: number;
  className?: string;
}) {
  const clipId = useId();
  const lit = Math.min(1, Math.max(0, progress));

  return (
    <svg
      viewBox={`0 0 ${AUDIO_WAVE_VIEW_W} ${AUDIO_WAVE_VIEW_H}`}
      preserveAspectRatio="none"
      className={cn("block h-full w-full", className)}
      aria-hidden
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={AUDIO_WAVE_VIEW_W * lit} height={AUDIO_WAVE_VIEW_H} />
        </clipPath>
      </defs>
      <path
        d={AUDIO_WAVE_PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-white/22"
      />
      {lit > 0 ? (
        <path
          d={AUDIO_WAVE_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          clipPath={`url(#${clipId})`}
          className="text-white/80"
        />
      ) : null}
    </svg>
  );
}

/** 空态 · 横向长波浪占位 */
function LibtvAudioTrackEmptyState() {
  return (
    <div
      className="flex h-full min-h-0 flex-1 items-center px-4 py-2"
      title="输入旁白并选择模型生成"
    >
      <div
        className="w-full text-white/70"
        style={{ height: LIBTV_AUDIO_TRACK_WAVEFORM_HEIGHT - 8 }}
      >
        <LibtvAudioWaveLine progress={0} />
      </div>
    </div>
  );
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
    <div className="flex min-h-0 flex-1 items-center gap-2 px-3 py-2">
      <button
        type="button"
        className="nodrag flex size-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/15"
        onClick={onTogglePlay}
        aria-label={playing ? "暂停" : "播放"}
      >
        {playing ? (
          <Pause className="size-3" />
        ) : (
          <Play className="size-3 translate-x-px" />
        )}
      </button>
      <div
        className="relative min-w-0 flex-1 rounded-lg bg-black/30 px-2 py-1.5 text-white/70"
        style={{ height: LIBTV_AUDIO_TRACK_WAVEFORM_HEIGHT - 4 }}
      >
        <LibtvAudioWaveLine progress={progress} />
        <span
          className="pointer-events-none absolute bottom-1 top-1 w-px bg-rose-500/90"
          style={{ left: `${Math.min(100, progress * 100)}%` }}
        />
      </div>
      <span className="shrink-0 text-[10px] tabular-nums text-white/55">
        {formatAudioTime(current)}
      </span>
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
      return <LibtvMediaGeneratingState variant="violet" cancelNodeId={id} />;
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
        <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-1 px-3 py-2 text-center">
          <AlertTriangle className="size-5 text-red-400/90" strokeWidth={1.5} />
          <p className="text-[11px] font-medium text-red-300/95">生成失败</p>
          <p className="max-w-full text-[10px] leading-relaxed text-red-300/70">
            {errorMessage}
          </p>
        </div>
      );
    }
    return <LibtvAudioTrackEmptyState />;
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
              showPreview={hasAudio}
              onPreview={() => {
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
