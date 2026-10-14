"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useStore } from "@xyflow/react";
import type { CanvasTaskRecord } from "@/lib/canvas-api";
import {
  applyActiveImageGenerationSwitch,
  dedupeSucceededImageGenerationsByMedia,
  listSucceededImageGenerations,
  previewUrlForGenerationTask,
  resolveActiveImageTaskId,
} from "@/lib/canvas/libtv-image-generation-stack";
import {
  collectLibtvUsedImageTaskIds,
  type LibtvUsedImageTaskFields,
} from "@/lib/canvas/libtv-image-generation-used";
import { useCanvasStore } from "@/lib/canvas/store";
import { useNodeTaskHistory } from "@/lib/canvas/use-node-task-history";
import { cn } from "@/lib/utils";

const USED_DOT_CLASS =
  "pointer-events-none absolute left-2 top-2 z-[2] size-2.5 rounded-full bg-black";

type LibtvImageGenerationStackProps = {
  nodeId: string;
  stageContainerRef: RefObject<HTMLElement | null>;
  hidden?: boolean;
  edition?: "pro2" | "sbv1";
  stageImageFit?: "cover" | "contain";
  onOpenChange?: (open: boolean) => void;
};

/** 与 Stage 屏上尺寸一致（fixed 历史条须用 rect，不能用 clientWidth） */
function useStageScreenSize(
  ref: RefObject<HTMLElement | null>,
  flowTransform: readonly number[],
): { w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 });

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setSize({
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    });
  }, [ref]);

  useLayoutEffect(() => {
    sync();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [sync, ref, flowTransform]);

  return size;
}

function useStripFixedAnchor(
  open: boolean,
  stageContainerRef: RefObject<HTMLElement | null>,
  flowTransform: readonly number[],
): { left: number; top: number } | null {
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);

  const sync = useCallback(() => {
    const stage = stageContainerRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    setAnchor({
      left: rect.right + 8,
      top: rect.top,
    });
  }, [stageContainerRef]);

  useLayoutEffect(() => {
    if (!open) {
      setAnchor(null);
      return;
    }
    sync();
    const stage = stageContainerRef.current;
    if (!stage) return;
    const ro = new ResizeObserver(sync);
    ro.observe(stage);
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [open, sync, stageContainerRef, flowTransform]);

  return anchor;
}

export function LibtvImageGenerationStack({
  nodeId,
  stageContainerRef,
  hidden,
  stageImageFit = "cover",
  onOpenChange,
}: LibtvImageGenerationStackProps) {
  const setNodes = useCanvasStore((s) => s.setNodes);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const nodeData = useCanvasStore(
    (s) =>
      s.nodes.find((x) => x.id === nodeId)?.data as
        | LibtvUsedImageTaskFields
        | undefined,
  );
  const activeImageTaskId = nodeData?.activeImageTaskId;
  const runtimeTaskId = (
    nodeData as { runtime?: { taskId?: string } } | undefined
  )?.runtime?.taskId;
  const nodeStackFields = useMemo(
    () => ({ activeImageTaskId, runtime: { taskId: runtimeTaskId } }),
    [activeImageTaskId, runtimeTaskId],
  );
  const { history } = useNodeTaskHistory(nodeId);
  const succeeded = useMemo(
    () => listSucceededImageGenerations(history),
    [history],
  );
  const succeededUnique = useMemo(
    () => dedupeSucceededImageGenerationsByMedia(history),
    [history],
  );
  const activeId = useMemo(
    () => resolveActiveImageTaskId(nodeStackFields, succeeded),
    [nodeStackFields, succeeded],
  );

  const usedTaskIds = useMemo(
    () =>
      nodeData
        ? collectLibtvUsedImageTaskIds({
            nodeId,
            nodeData,
            nodes,
            edges,
            history,
          })
        : new Set<string>(),
    [nodeId, nodeData, nodes, edges, history],
  );

  const badgeCount = succeededUnique.length;
  const stripTasks = useMemo(
    () => succeededUnique.filter((t) => t.id !== activeId),
    [succeededUnique, activeId],
  );

  const flowTransform = useStore((s) => s.transform);
  const stageSize = useStageScreenSize(stageContainerRef, flowTransform);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const stripAnchor = useStripFixedAnchor(open, stageContainerRef, flowTransform);
  const [bodyReady, setBodyReady] = useState(false);
  useEffect(() => {
    setBodyReady(typeof document !== "undefined");
  }, []);

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

  if (hidden || badgeCount < 2) return null;

  const tileW = stageSize.w > 0 ? stageSize.w : undefined;
  const tileH = stageSize.h > 0 ? stageSize.h : undefined;
  const imageFitClass =
    stageImageFit === "contain" ? "object-contain" : "object-cover";

  const showMainUsedDot = Boolean(activeId && usedTaskIds.has(activeId));

  const strip =
    open && tileW && tileH && stripAnchor && stripTasks.length > 0 ? (
      <div
        ref={stripRef}
        data-canvas-block-nav-gesture
        className="nodrag nopan nowheel pointer-events-auto fixed z-[20040] flex flex-row items-stretch gap-2"
        style={{
          left: stripAnchor.left,
          top: stripAnchor.top,
          height: tileH,
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {stripTasks.map((task, index) => {
          const thumb = previewUrlForGenerationTask(task);
          const showUsed = usedTaskIds.has(task.id);
          return (
            <button
              key={task.id}
              type="button"
              title={`历史版本 ${index + 1}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(task);
              }}
              className={cn(
                "libtv-media-node-bg relative shrink-0 overflow-hidden rounded-2xl border border-solid border-white/10 bg-[#262626] box-border opacity-90 hover:border-white/20 hover:opacity-100",
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
                  className={cn("size-full", imageFitClass)}
                  draggable={false}
                />
              ) : (
                <span className="flex size-full items-center justify-center text-sm text-white/40">
                  {index + 1}
                </span>
              )}
              {showUsed ? (
                <span className={USED_DOT_CLASS} title="已用过" aria-hidden />
              ) : null}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <>
      {showMainUsedDot ? (
        <span className={USED_DOT_CLASS} title="已用过" aria-hidden />
      ) : null}

      <div
        ref={rootRef}
        className="pointer-events-none absolute right-2 top-2 z-[80]"
      >
        <button
          type="button"
          data-libtv-toolbar-interactive
          aria-expanded={open}
          aria-label={`已生成 ${badgeCount} 张，切换当前图片`}
          title={`${badgeCount} 张生成结果 · 点击展开`}
          onPointerDown={toggleOpen}
          className={cn(
            "pointer-events-auto nodrag nopan nowheel flex size-9 items-center justify-center rounded-full bg-black text-xs font-bold tabular-nums text-white",
            "transition hover:opacity-90 active:scale-95",
            open && "ring-2 ring-white/30 ring-inset",
          )}
        >
          {badgeCount}
        </button>
      </div>

      {strip && bodyReady ? createPortal(strip, document.body) : null}
    </>
  );
}
