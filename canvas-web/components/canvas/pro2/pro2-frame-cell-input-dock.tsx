"use client";

import { useCallback, useMemo } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { useNodes } from "@xyflow/react";
import { useCanvasStore } from "@/lib/canvas/store";
import { useLibtvFloatingDockHidden } from "@/lib/canvas/use-libtv-floating-dock";
import { useStableLibtvDockFlowPlacement } from "@/lib/canvas/libtv-dock-flow-placement";
import { batchRunStoryRows } from "@/lib/canvas/batch-run-nodes";
import { PRO2_DOCK_TEXTAREA_CLASS, PRO2_DOCK_TEXTAREA_INSET_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import type { StoryProFrameRow } from "@/lib/canvas/story-pro-workspace-types";
import { RF_FORM_CONTROL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";
import { CanvasPromptTextarea } from "../canvas-prompt-textarea";
import { usePro2FrameCellDockPlacement } from "./use-pro2-frame-cell-dock-placement";
import { Pro2DockToolbar, Pro2InputDockShell } from "./pro2-input-dock-shell";

function frameRowStatus(row: StoryProFrameRow): "idle" | "running" | "error" {
  const st = row.runtime?.status;
  if (st === "running" || st === "pending") return "running";
  return "idle";
}

/** 2.0 分镜图板 · 单格底部输入坞 */
export function Pro2FrameCellInputDock() {
  const rfNodes = useNodes();
  const focus = useCanvasStore((s) => s.pro2FrameDockFocus);
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const selectedFrame = useMemo(() => {
    const picked = rfNodes.filter(
      (n) => n.selected && n.type === "story-pro2-frame",
    );
    return picked.length === 1 ? picked[0] : null;
  }, [rfNodes]);

  const dockNodeId = selectedFrame?.id ?? null;
  const dockHidden = useLibtvFloatingDockHidden(dockNodeId);

  const activeFocus = useMemo(() => {
    if (!focus || !selectedFrame || focus.nodeId !== selectedFrame.id) {
      return null;
    }
    return focus;
  }, [focus, selectedFrame]);

  const storeNode = useMemo(() => {
    if (!activeFocus) return null;
    return nodes.find((n) => n.id === activeFocus.nodeId) ?? null;
  }, [activeFocus, nodes]);

  const rawPlacement = usePro2FrameCellDockPlacement(
    activeFocus?.nodeId ?? null,
    activeFocus?.rowKey ?? null,
  );
  const placement = useStableLibtvDockFlowPlacement(rawPlacement);

  const row = useMemo(() => {
    if (!storeNode || !activeFocus) return null;
    const rows = (storeNode.data as { rows?: StoryProFrameRow[] }).rows ?? [];
    return rows.find((r) => r.key === activeFocus.rowKey) ?? null;
  }, [storeNode, activeFocus]);

  const onPromptChange = useCallback(
    (value: string, meta?: { commit?: boolean }) => {
      if (!storeNode || !activeFocus) return;
      const rows = (storeNode.data as { rows?: StoryProFrameRow[] }).rows ?? [];
      updateNodeData(
        storeNode.id,
        {
          rows: rows.map((r) =>
            r.key === activeFocus.rowKey ? { ...r, prompt: value } : r,
          ),
        },
        { commit: meta?.commit ?? true },
      );
    },
    [storeNode, activeFocus, updateNodeData],
  );

  const onRegenerate = useCallback(() => {
    if (!storeNode || !activeFocus || !row) return;
    batchRunStoryRows(storeNode.id, [activeFocus.rowKey], "frameImage", {
      forceFresh: true,
    });
  }, [storeNode, activeFocus, row]);

  if (!storeNode || !row || !placement || !activeFocus) return null;

  const running = frameRowStatus(row) === "running";
  const prompt = row.prompt ?? "";

  return (
    <Pro2InputDockShell
      flowAnchor={placement}
      dockClassName="pro2-frame-cell-dock"
      hidden={dockHidden}
      footer={
        <Pro2DockToolbar>
          <div className="min-w-0 flex-1" />
          <button
            type="button"
            disabled={running || !prompt.trim()}
            className="nodrag flex size-9 items-center justify-center rounded-xl bg-white text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            title="重新生成该镜分镜图"
            onClick={onRegenerate}
          >
            {running ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </button>
        </Pro2DockToolbar>
      }
    >
      <CanvasPromptTextarea
        className={cn(
          PRO2_DOCK_TEXTAREA_CLASS,
          RF_FORM_CONTROL,
          RF_NO_WHEEL,
          PRO2_DOCK_TEXTAREA_INSET_CLASS,
        )}
        placeholder="描述本镜画面…"
        value={prompt}
        disabled={running}
        rows={4}
        onChange={onPromptChange}
      />
    </Pro2InputDockShell>
  );
}
