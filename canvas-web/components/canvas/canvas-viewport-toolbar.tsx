"use client";

import { useCallback, useEffect, useState } from "react";
import { MiniMap, Panel, useReactFlow, useViewport } from "@xyflow/react";
import { LayoutGrid, Map, Minus, Plus, Video } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import { hasStoryComicPipeline } from "@/lib/canvas/story-comic-layout";
import type { CanvasFlowNode } from "@/lib/canvas/types";
import { cn } from "@/lib/utils";

export type CanvasViewportEdition = "pro2" | "sbv1" | "comic" | "generic";

function resolveViewportEdition(args: {
  pro2: boolean;
  sbv1: boolean;
  nodes: CanvasFlowNode[];
}): CanvasViewportEdition {
  if (args.pro2) return "pro2";
  if (args.sbv1) return "sbv1";
  if (hasStoryComicPipeline(args.nodes)) return "comic";
  return "generic";
}

function viewportBtnClass(active?: boolean) {
  return cn(
    "flex size-8 items-center justify-center rounded-lg transition",
    active
      ? "bg-white/15 text-white"
      : "text-white/70 hover:bg-white/10 hover:text-white",
  );
}

/** 画布右下角：画面整理 · 小地图 · 缩放比例 */
export const CANVAS_BACKGROUND_VIDEO_PANEL_TOGGLE_EVENT =
  "canvas:background-video-panel-toggle";
export const CANVAS_BACKGROUND_VIDEO_TASK_COUNT_EVENT =
  "canvas:background-video-task-count";

export function CanvasViewportToolbar({
  pro2Canvas = false,
  sbv1Canvas = false,
}: {
  pro2Canvas?: boolean;
  sbv1Canvas?: boolean;
}) {
  const { zoom } = useViewport();
  const { zoomIn, zoomOut } = useReactFlow();
  const [minimapOpen, setMinimapOpen] = useState(false);
  const [bgVideoOpen, setBgVideoOpen] = useState(false);
  const [bgVideoCount, setBgVideoCount] = useState(0);

  useEffect(() => {
    const onCount = (e: Event) => {
      const detail = (e as CustomEvent<{ count?: number }>).detail;
      setBgVideoCount(typeof detail?.count === "number" ? detail.count : 0);
    };
    const onOpen = (e: Event) => {
      const open = (e as CustomEvent<{ open?: boolean }>).detail?.open;
      if (typeof open === "boolean") setBgVideoOpen(open);
    };
    window.addEventListener(CANVAS_BACKGROUND_VIDEO_TASK_COUNT_EVENT, onCount);
    window.addEventListener("canvas:background-video-panel-open", onOpen);
    return () => {
      window.removeEventListener(CANVAS_BACKGROUND_VIDEO_TASK_COUNT_EVENT, onCount);
      window.removeEventListener("canvas:background-video-panel-open", onOpen);
    };
  }, []);

  const nodes = useCanvasStore((s) => s.nodes);
  const reflowPro2 = useCanvasStore((s) => s.reflowPro2Canvas);
  const reflowSbv1 = useCanvasStore((s) => s.reflowSbv1Canvas);
  const reflowComic = useCanvasStore((s) => s.reflowStoryComicLayout);
  const autoLayoutNodes = useCanvasStore((s) => s.autoLayoutNodes);

  const edition = resolveViewportEdition({
    pro2: pro2Canvas,
    sbv1: sbv1Canvas,
    nodes,
  });

  const onOrganize = useCallback(() => {
    if (edition === "pro2") {
      reflowPro2();
      return;
    }
    if (edition === "sbv1") {
      reflowSbv1();
      return;
    }
    if (edition === "comic") {
      reflowComic();
      return;
    }
    const ids = nodes
      .filter((n) => !n.parentId && n.type !== "group")
      .map((n) => n.id);
    if (ids.length >= 2) autoLayoutNodes(ids);
  }, [edition, reflowPro2, reflowSbv1, reflowComic, autoLayoutNodes, nodes]);

  const pct = Math.round(zoom * 100);
  const minimapNodeColor =
    edition === "sbv1"
      ? () => "rgba(34,211,238,0.65)"
      : () => "rgba(167,139,250,0.6)";

  const organizeHint =
    edition === "pro2" || edition === "sbv1"
      ? "重排工作区节点与媒体组"
      : edition === "comic"
        ? "按漫剧工作流重新排列"
        : "按连接关系自动整理";

  return (
    <>
      {minimapOpen ? (
        <MiniMap
          pannable
          zoomable
          nodeColor={minimapNodeColor}
          maskColor="rgba(11,11,20,0.82)"
          className="!bottom-[3.75rem] !right-4 !bg-[var(--canvas-surface)] !border !border-white/10 !rounded-lg !shadow-xl"
        />
      ) : null}
      <Panel position="bottom-right" className="!m-0 !mb-4 !mr-4">
        <div
          className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-white/10 bg-[#1c1c1e]/96 px-1 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={viewportBtnClass()}
            title={`画面整理 — ${organizeHint}`}
            aria-label={`画面整理 — ${organizeHint}`}
            onClick={onOrganize}
          >
            <LayoutGrid className="size-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={viewportBtnClass(minimapOpen)}
            title={minimapOpen ? "隐藏小地图" : "显示小地图"}
            aria-label={minimapOpen ? "隐藏小地图" : "显示小地图"}
            onClick={() => setMinimapOpen((open) => !open)}
          >
            <Map className="size-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={cn(
              viewportBtnClass(bgVideoOpen || bgVideoCount > 0),
              bgVideoCount > 0 && !bgVideoOpen && "text-orange-200",
            )}
            title={
              bgVideoCount > 0
                ? `后台视频 · ${bgVideoCount} 个任务`
                : "后台视频 — 长视频持续生成与恢复"
            }
            aria-label="后台视频"
            aria-pressed={bgVideoOpen}
            onClick={() => {
              setBgVideoOpen((open) => {
                const next = !open;
                window.dispatchEvent(
                  new CustomEvent(CANVAS_BACKGROUND_VIDEO_PANEL_TOGGLE_EVENT, {
                    detail: { open: next },
                  }),
                );
                return next;
              });
            }}
          >
            <span className="relative">
              <Video className="size-4" strokeWidth={1.75} />
              {bgVideoCount > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex size-3.5 items-center justify-center rounded-full bg-orange-500 text-[8px] font-bold text-white">
                  {bgVideoCount > 9 ? "9+" : bgVideoCount}
                </span>
              ) : null}
            </span>
          </button>
          <div className="mx-0.5 h-5 w-px shrink-0 bg-white/10" aria-hidden />
          <button
            type="button"
            className={viewportBtnClass()}
            title="缩小"
            aria-label="缩小画布"
            onClick={() => zoomOut({ duration: 150 })}
          >
            <Minus className="size-4" strokeWidth={1.75} />
          </button>
          <span
            className="min-w-[44px] select-none px-0.5 text-center text-[12px] font-medium tabular-nums text-white/90"
            aria-live="polite"
            aria-label={`画布缩放 ${pct}%`}
          >
            {pct}%
          </span>
          <button
            type="button"
            className={viewportBtnClass()}
            title="放大"
            aria-label="放大画布"
            onClick={() => zoomIn({ duration: 150 })}
          >
            <Plus className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </Panel>
    </>
  );
}
