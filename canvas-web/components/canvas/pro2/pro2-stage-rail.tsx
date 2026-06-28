"use client";

import { useCallback } from "react";
import { useCanvasStore } from "@/lib/canvas/store";
import { handlePro2ToolbarAddNodePick } from "@/lib/canvas/pro2-add-node-pick";
import { PRO2_STAGE_RAIL_ITEMS } from "@/lib/canvas/pro2-add-node-menu";
import { useDialogs } from "@/components/dialogs/dialog-provider";

/** 2.0 画布左侧竖向环节工具条 · 点击在视口中心生成对应 2.0 节点 */
export function Pro2StageRail({
  onOpenStyleLibrary,
}: {
  onOpenStyleLibrary?: () => void;
}) {
  const { alert, confirm } = useDialogs();
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);

  const onPick = useCallback(
    async (itemId: string, nodeType?: string) => {
      await handlePro2ToolbarAddNodePick(
        itemId,
        nodeType,
        { addNode, setNodes },
        { alert, confirm },
        { edition: "pro2", onOpenStyleLibrary },
      );
    },
    [addNode, setNodes, alert, confirm, onOpenStyleLibrary],
  );

  return (
    <div
      className="pointer-events-none absolute left-3 top-1/2 z-[55] flex -translate-y-1/2 flex-col"
      role="toolbar"
      aria-label="影视专业 2.0 · 工作环节"
    >
      <div className="pointer-events-auto flex flex-col gap-1 rounded-xl border border-cyan-400/20 bg-[var(--canvas-surface)]/95 p-1.5 shadow-lg">
        {PRO2_STAGE_RAIL_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              aria-label={item.label}
              disabled={!item.enabled}
              onClick={() => void onPick(item.id, item.nodeType)}
              className="group/rail relative flex size-9 shrink-0 items-center justify-center rounded-lg text-cyan-100/80 transition hover:bg-cyan-500/20 hover:text-cyan-50 disabled:opacity-40"
            >
              <Icon className="size-[18px]" aria-hidden />
              <span
                className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-white/10 bg-black/90 px-2 py-1 text-[11px] text-white shadow-lg group-hover/rail:block"
                role="tooltip"
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
