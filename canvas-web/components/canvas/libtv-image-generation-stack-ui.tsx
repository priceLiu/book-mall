"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type { CanvasTaskRecord } from "@/lib/canvas-api";
import {
  applyActiveImageGenerationSwitch,
  listSucceededImageGenerations,
  previewUrlForGenerationTask,
  resolveActiveImageTaskId,
} from "@/lib/canvas/libtv-image-generation-stack";
import { LIBTV_MEDIA_CARD_SHELL_CLASS } from "@/lib/canvas/libtv-node-chrome";
import { useCanvasStore } from "@/lib/canvas/store";
import { useNodeTaskHistory } from "@/lib/canvas/use-node-task-history";
import { cn } from "@/lib/utils";

type LibtvImageGenerationStackProps = {
  nodeId: string;
  /** 与 Stage 同尺寸的预览区容器（用于量宽高 · 横向条对齐） */
  stageContainerRef: RefObject<HTMLElement | null>;
  hidden?: boolean;
  edition?: "pro2" | "sbv1";
  onOpenChange?: (open: boolean) => void;
};

function useStageSize(ref: RefObject<HTMLElement | null>): { w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

export function LibtvImageGenerationStack({
  nodeId,
  stageContainerRef,
  hidden,
  edition = "pro2",
  onOpenChange,
}: LibtvImageGenerationStackProps) {
  const setNodes = useCanvasStore((s) => s.setNodes);
  const activeImageTaskId = useCanvasStore(
    (s) =>
      (s.nodes.find((x) => x.id === nodeId)?.data as { activeImageTaskId?: string })
        ?.activeImageTaskId,
  );
  const runtimeTaskId = useCanvasStore(
    (s) =>
      (
        s.nodes.find((x) => x.id === nodeId)?.data as {
          runtime?: { taskId?: string };
        }
      )?.runtime?.taskId,
  );
  const nodeStackFields = useMemo(
    () => ({ activeImageTaskId, runtime: { taskId: runtimeTaskId } }),
    [activeImageTaskId, runtimeTaskId],
  );
  const { history } = useNodeTaskHistory(nodeId);
  const succeeded = useMemo(
    () => listSucceededImageGenerations(history),
    [history],
  );
  const activeId = useMemo(
    () => resolveActiveImageTaskId(nodeStackFields, succeeded),
    [nodeStackFields, succeeded],
  );

  const stageSize = useStageSize(stageContainerRef);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const setOpenSafe = useCallback(
    (next: boolean | ((v: boolean) => boolean)) => {
      setOpen((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        onOpenChange?.(value);
        return value;
      });
    },
    [onOpenChange],
  );

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof globalThis.Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (stripRef.current?.contains(target)) return;
      setOpenSafe(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open, setOpenSafe]);

  const onSelect = useCallback(
    (task: CanvasTaskRecord) => {
      if (task.id !== activeId) {
        applyActiveImageGenerationSwitch(nodeId, task, setNodes);
      }
    },
    [activeId, nodeId, setNodes],
  );

  const toggleOpen = useCallback(
    (e: ReactPointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setOpenSafe((v) => !v);
    },
    [setOpenSafe],
  );

  if (hidden || succeeded.length < 2) return null;

  const selectedBorder =
    edition === "sbv1" ? "border-cyan-400/90" : "border-violet-400/90";
  const tileW = stageSize.w > 0 ? stageSize.w : undefined;
  const tileH = stageSize.h > 0 ? stageSize.h : undefined;

  return (
    <>
      <div
        ref={rootRef}
        className="pointer-events-none absolute right-2 top-2 z-[80]"
      >
        <button
          type="button"
          data-libtv-toolbar-interactive
          aria-expanded={open}
          aria-label={`已生成 ${succeeded.length} 张，切换当前图片`}
          title={`${succeeded.length} 张生成结果 · 点击展开`}
          onPointerDown={toggleOpen}
          className={cn(
            "pointer-events-auto nodrag nopan nowheel flex size-9 items-center justify-center rounded-full border-2 border-white/30 bg-black/85 text-xs font-bold tabular-nums text-white shadow-lg backdrop-blur-sm",
            "transition hover:scale-105 hover:bg-black active:scale-95",
            open && "border-white/50 ring-2 ring-white/25",
            edition === "sbv1"
              ? "hover:border-cyan-400/50"
              : "hover:border-violet-400/50",
          )}
        >
          {succeeded.length}
        </button>
      </div>

      {open && tileW && tileH ? (
        <div
          ref={stripRef}
          data-canvas-block-nav-gesture
          className="nodrag nopan nowheel pointer-events-auto absolute left-full top-0 z-[20040] ml-2 flex h-full flex-row items-stretch gap-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {succeeded.map((task, index) => {
            const thumb = previewUrlForGenerationTask(task);
            const selected = task.id === activeId;
            return (
              <button
                key={task.id}
                type="button"
                title={`第 ${index + 1} 次生成`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(task);
                }}
                className={cn(
                  LIBTV_MEDIA_CARD_SHELL_CLASS,
                  "libtv-media-node-bg relative shrink-0 overflow-hidden p-0",
                  selected
                    ? cn("border-2", selectedBorder)
                    : "border border-white/15 opacity-90 hover:opacity-100",
                )}
                style={{
                  width: tileW,
                  height: tileH,
                  minWidth: tileW,
                  minHeight: tileH,
                }}
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt=""
                    className="size-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-sm text-white/40">
                    {index + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
