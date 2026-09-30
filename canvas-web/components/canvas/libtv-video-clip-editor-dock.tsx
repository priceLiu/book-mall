"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { Pro2InputDockShell } from "@/components/canvas/pro2/pro2-input-dock-shell";
import {
  useLibtvFloatingDock,
  useLibtvSoleSelectedNodeId,
} from "@/lib/canvas/use-libtv-floating-dock";
import { useLibtvShouldSuppressFloatingDock } from "@/lib/canvas/libtv-floating-dock-selection";
import { SBV1_VIDEO_DOCK_PLACEMENT_OPTS } from "@/lib/canvas/sbv1-video-dock-placement";
import type { Sbv1VideoEditSession, Sbv1VideoEngineNodeData } from "@/lib/canvas/sbv1-workspace-types";
import { useCanvasStore } from "@/lib/canvas/store";
import { runLibtvVideoFrameExtract } from "@/lib/canvas/libtv-video-frame-extract-run";
import { runLibtvVideoTrim } from "@/lib/canvas/libtv-video-trim-run";
import {
  fetchVideoFilmstrip,
  libtvVideoEditSourceReady,
  type VideoFilmstripFrame,
} from "@/lib/canvas/libtv-video-edit-client";
import { formatClipTimeSec } from "@/lib/canvas/libtv-video-clip-editor-format";
import { cn } from "@/lib/utils";

const CLIP_EDITOR_FLOW = { w: 560, h: 220 } as const;
const MIN_TRIM_SEC = 0.25;
/** 单格缩略图宽度 · 超出 Dock 宽时可横向滚动 */
const FILMSTRIP_THUMB_PX = 72;

function sessionOpen(
  session: Sbv1VideoEditSession | undefined,
): session is { open: true; mode: "pick-frame" | "trim-clip" } {
  return Boolean(session && session.open === true);
}

export function LibtvVideoClipEditorFloatingDock() {
  const suppressDock = useLibtvShouldSuppressFloatingDock();
  const dockNodeId = useLibtvSoleSelectedNodeId("sbv1-video-engine");

  const session = useCanvasStore(
    useCallback(
      (s) => {
        if (!dockNodeId) return undefined;
        const d = s.nodes.find((n) => n.id === dockNodeId)?.data as
          | Sbv1VideoEngineNodeData
          | undefined;
        return d?.videoEditSession;
      },
      [dockNodeId],
    ),
  );

  const nodeExists = useCanvasStore(
    useCallback(
      (s) => (dockNodeId ? s.nodes.some((n) => n.id === dockNodeId) : false),
      [dockNodeId],
    ),
  );

  const { placement, hidden } = useLibtvFloatingDock(
    nodeExists && sessionOpen(session) ? dockNodeId : null,
    SBV1_VIDEO_DOCK_PLACEMENT_OPTS,
  );

  if (
    suppressDock ||
    !dockNodeId ||
    !nodeExists ||
    !sessionOpen(session) ||
    !placement
  ) {
    return null;
  }

  return (
    <LibtvVideoClipEditorBody
      key={`${dockNodeId}-${session.mode}`}
      nodeId={dockNodeId}
      mode={session.mode}
      placement={placement}
      hidden={hidden}
    />
  );
}

const LibtvVideoClipEditorBody = memo(function LibtvVideoClipEditorBody({
  nodeId,
  mode,
  placement,
  hidden,
}: {
  nodeId: string;
  mode: "pick-frame" | "trim-clip";
  placement: NonNullable<ReturnType<typeof useLibtvFloatingDock>["placement"]>;
  hidden: boolean;
}) {
  const { alert } = useDialogs();
  const projectId = useCanvasStore((s) => s.projectId);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const addNodeInGroup = useCanvasStore((s) => s.addNodeInGroup);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const runtime = useCanvasStore(
    useCallback(
      (s) =>
        (s.nodes.find((n) => n.id === nodeId)?.data as Sbv1VideoEngineNodeData)
          ?.runtime,
      [nodeId],
    ),
  );

  const sourceVideoUrl = useMemo(
    () => libtvVideoEditSourceReady({ runtime }),
    [runtime],
  );

  const store = useMemo(
    () => ({ nodes, edges, addNode, addNodeInGroup, setNodes, setEdges }),
    [nodes, edges, addNode, addNodeInGroup, setNodes, setEdges],
  );

  const closeSession = useCallback(() => {
    updateNodeData(nodeId, {
      videoEditSession: { open: false },
    });
  }, [nodeId, updateNodeData]);

  const [loadingStrip, setLoadingStrip] = useState(true);
  const [stripError, setStripError] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(1);
  const [frames, setFrames] = useState<VideoFilmstripFrame[]>([]);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(1);
  const [busy, setBusy] = useState(false);

  const stripRef = useRef<HTMLDivElement | null>(null);
  const stripScrollRef = useRef<HTMLDivElement | null>(null);

  const stripTrackWidthPx = Math.max(
    frames.length * FILMSTRIP_THUMB_PX,
    FILMSTRIP_THUMB_PX * 4,
  );

  useEffect(() => {
    if (!sourceVideoUrl) {
      setStripError("需要已上传至云端的成片");
      setLoadingStrip(false);
      return;
    }
    let cancelled = false;
    setLoadingStrip(true);
    setStripError(null);
    void fetchVideoFilmstrip({
      sourceVideoUrl,
      projectId,
    })
      .then((r) => {
        if (cancelled) return;
        setDurationSec(Math.max(0.1, r.durationSec));
        setFrames(r.frames);
        setPlayheadSec(0);
        setTrimStart(0);
        setTrimEnd(Math.max(0.1, r.durationSec));
      })
      .catch((e) => {
        if (cancelled) return;
        setStripError(e instanceof Error ? e.message : "缩略图加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoadingStrip(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sourceVideoUrl, projectId]);

  const secFromClientX = useCallback(
    (clientX: number): number => {
      const el = stripRef.current;
      if (!el || durationSec <= 0) return 0;
      const scrollLeft = stripScrollRef.current?.scrollLeft ?? 0;
      const rect = el.getBoundingClientRect();
      const xOnTrack = clientX - rect.left + scrollLeft;
      const ratio = Math.min(1, Math.max(0, xOnTrack / el.offsetWidth));
      return ratio * durationSec;
    },
    [durationSec],
  );

  const setPlayheadFromClientX = useCallback(
    (clientX: number) => {
      setPlayheadSec(secFromClientX(clientX));
    },
    [secFromClientX],
  );

  const onStripClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode === "trim-clip") return;
    setPlayheadFromClientX(e.clientX);
  };

  const onThumbClick = (atSec: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (mode !== "pick-frame") return;
    setPlayheadSec(Math.min(durationSec, Math.max(0, atSec)));
  };

  const onConfirm = async () => {
    if (!sourceVideoUrl || busy) return;
    setBusy(true);
    try {
      if (mode === "pick-frame") {
        await runLibtvVideoFrameExtract({
          mode: "at",
          atSec: playheadSec,
          sourceNodeId: nodeId,
          sourceVideoUrl,
          projectId,
          store,
          updateNodeData: (id, patch) => updateNodeData(id, patch),
        });
        closeSession();
      } else {
        const start = Math.min(trimStart, trimEnd - MIN_TRIM_SEC);
        const end = Math.max(trimEnd, start + MIN_TRIM_SEC);
        await runLibtvVideoTrim({
          sourceNodeId: nodeId,
          sourceVideoUrl,
          projectId,
          startSec: start,
          endSec: end,
          store,
          updateNodeData: (id, patch) => updateNodeData(id, patch),
        });
        closeSession();
      }
    } catch (e) {
      await alert({
        title: mode === "pick-frame" ? "截帧失败" : "裁剪失败",
        message: e instanceof Error ? e.message : "处理失败",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const playheadPct =
    durationSec > 0 ? (playheadSec / durationSec) * 100 : 0;
  const trimStartPct =
    durationSec > 0 ? (trimStart / durationSec) * 100 : 0;
  const trimEndPct = durationSec > 0 ? (trimEnd / durationSec) * 100 : 100;

  const title =
    mode === "pick-frame" ? "自定义截帧" : "裁剪片段";

  const footer = (
    <div className="flex items-center justify-between gap-2 px-1 pt-2">
      <button
        type="button"
        className="nodrag rounded-lg px-3 py-1.5 text-xs text-white/55 hover:bg-white/[0.06]"
        disabled={busy}
        onClick={closeSession}
      >
        取消
      </button>
      <span className="truncate text-[11px] tabular-nums text-white/40">
        {mode === "pick-frame"
          ? `定格 ${formatClipTimeSec(playheadSec)} / ${formatClipTimeSec(durationSec)}`
          : `${formatClipTimeSec(trimStart)} – ${formatClipTimeSec(trimEnd)}（${formatClipTimeSec(Math.max(0, trimEnd - trimStart))}）`}
      </span>
      <button
        type="button"
        className="nodrag rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        disabled={busy || !sourceVideoUrl || Boolean(stripError)}
        onClick={() => void onConfirm()}
      >
        {busy ? (
          <Loader2 className="inline size-3.5 animate-spin" />
        ) : mode === "pick-frame" ? (
          "导出帧"
        ) : (
          "生成片段"
        )}
      </button>
    </div>
  );

  return (
    <Pro2InputDockShell
      flowAnchor={placement}
      hidden={hidden}
      anchorNodeId={nodeId}
      hideExpand
      flowSize={CLIP_EDITOR_FLOW}
      screenWidth={560}
      dockClassName="!bg-[#1a1a1e] !border-white/10"
      footer={footer}
    >
      <div className="nodrag flex min-h-0 flex-col gap-2 px-1 py-1">
        <p className="text-[11px] font-medium text-white/70">{title}</p>
        {loadingStrip ? (
          <div className="flex h-20 items-center justify-center gap-2 text-xs text-white/40">
            <Loader2 className="size-4 animate-spin" />
            正在生成时间轴缩略图…
          </div>
        ) : stripError ? (
          <p className="text-xs text-red-300/90">{stripError}</p>
        ) : (
          <>
            <div className="rounded-lg border border-white/10 bg-black/40">
              <div
                ref={stripScrollRef}
                className="nodrag overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20"
              >
                <div
                  ref={stripRef}
                  className="relative h-16 shrink-0 cursor-crosshair"
                  style={{ width: stripTrackWidthPx }}
                  onClick={onStripClick}
                >
                  <div className="flex h-full">
                    {frames.map((f, i) => (
                      <button
                        key={`${f.atSec}-${i}`}
                        type="button"
                        className="nodrag h-full shrink-0 overflow-hidden border-r border-white/5 p-0 last:border-r-0 hover:ring-1 hover:ring-inset hover:ring-violet-400/40"
                        style={{ width: FILMSTRIP_THUMB_PX }}
                        title={formatClipTimeSec(f.atSec)}
                        onClick={(e) => onThumbClick(f.atSec, e)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={f.thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      </button>
                    ))}
                  </div>
                  {mode === "trim-clip" ? (
                    <>
                      <div
                        className="pointer-events-none absolute inset-y-0 left-0 bg-black/55"
                        style={{ width: `${trimStartPct}%` }}
                      />
                      <div
                        className="pointer-events-none absolute inset-y-0 right-0 bg-black/55"
                        style={{ width: `${100 - trimEndPct}%` }}
                      />
                      <TrimHandle
                        side="start"
                        pct={trimStartPct}
                        stripRef={stripRef}
                        stripScrollRef={stripScrollRef}
                        durationSec={durationSec}
                        other={trimEnd}
                        minGap={MIN_TRIM_SEC}
                        onSec={(s) => setTrimStart(s)}
                      />
                      <TrimHandle
                        side="end"
                        pct={trimEndPct}
                        stripRef={stripRef}
                        stripScrollRef={stripScrollRef}
                        durationSec={durationSec}
                        other={trimStart}
                        minGap={MIN_TRIM_SEC}
                        onSec={(s) => setTrimEnd(s)}
                      />
                    </>
                  ) : (
                    <PlayheadHandle
                      pct={playheadPct}
                      stripRef={stripRef}
                      stripScrollRef={stripScrollRef}
                      durationSec={durationSec}
                      onSec={setPlayheadSec}
                    />
                  )}
                </div>
              </div>
            </div>
            <p className="text-[10px] leading-relaxed text-white/35">
              {mode === "pick-frame"
                ? "黄线 = 要导出的那一帧（可点击或拖动时间条；缩略图过多可左右滑动）。选好后点「导出帧」。裁视频片段请用顶栏「裁剪」（两条紫线）。"
                : "拖动左右紫线选择入出点，然后点「生成片段」"}
            </p>
          </>
        )}
      </div>
    </Pro2InputDockShell>
  );
});

function secFromPointerOnStrip(
  clientX: number,
  stripRef: React.RefObject<HTMLDivElement | null>,
  stripScrollRef: React.RefObject<HTMLDivElement | null>,
  durationSec: number,
): number {
  const el = stripRef.current;
  if (!el || durationSec <= 0) return 0;
  const scrollLeft = stripScrollRef.current?.scrollLeft ?? 0;
  const rect = el.getBoundingClientRect();
  const xOnTrack = clientX - rect.left + scrollLeft;
  const ratio = Math.min(1, Math.max(0, xOnTrack / el.offsetWidth));
  return ratio * durationSec;
}

function PlayheadHandle({
  pct,
  stripRef,
  stripScrollRef,
  durationSec,
  onSec,
}: {
  pct: number;
  stripRef: React.RefObject<HTMLDivElement | null>;
  stripScrollRef: React.RefObject<HTMLDivElement | null>;
  durationSec: number;
  onSec: (sec: number) => void;
}) {
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const move = (ev: PointerEvent) => {
      onSec(
        secFromPointerOnStrip(
          ev.clientX,
          stripRef,
          stripScrollRef,
          durationSec,
        ),
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      className="absolute top-0 z-20 flex h-full w-4 -translate-x-1/2 cursor-ew-resize flex-col items-center"
      style={{ left: `${pct}%` }}
      onPointerDown={onPointerDown}
      title="拖动选择定格时刻"
    >
      <div className="mt-0.5 size-2 rotate-45 border border-yellow-200 bg-yellow-300 shadow-sm" />
      <div className="min-h-0 w-0.5 flex-1 bg-yellow-300 shadow-[0_0_8px_rgba(253,224,71,0.85)]" />
    </div>
  );
}

function TrimHandle({
  side,
  pct,
  stripRef,
  stripScrollRef,
  durationSec,
  other,
  minGap,
  onSec,
}: {
  side: "start" | "end";
  pct: number;
  stripRef: React.RefObject<HTMLDivElement | null>;
  stripScrollRef: React.RefObject<HTMLDivElement | null>;
  durationSec: number;
  other: number;
  minGap: number;
  onSec: (sec: number) => void;
}) {
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const move = (ev: PointerEvent) => {
      let sec = secFromPointerOnStrip(
        ev.clientX,
        stripRef,
        stripScrollRef,
        durationSec,
      );
      if (side === "start") {
        sec = Math.min(sec, other - minGap);
        sec = Math.max(0, sec);
      } else {
        sec = Math.max(sec, other + minGap);
        sec = Math.min(durationSec, sec);
      }
      onSec(sec);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      className="absolute top-0 z-10 flex h-full w-3 -translate-x-1/2 cursor-ew-resize items-center justify-center"
      style={{ left: `${pct}%` }}
      onPointerDown={onPointerDown}
    >
      <div className="h-full w-1 rounded-full bg-violet-400 shadow-md" />
    </div>
  );
}
