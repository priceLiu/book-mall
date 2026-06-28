"use client";

import { useMemo } from "react";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  crewBulletinTasksSignature,
  crewTaskNodeBadgeClass,
  crewTaskNodeBadgeLabel,
  crewTaskNodeBadgeTier,
  crewTaskStatusForNodeId,
} from "@/lib/canvas/crew-task-node-status";
import { cn } from "@/lib/utils";

/** 领取任务生成的工作节点 · 与公告栏三色状态一致 */
export function Pro2CrewTaskStatusBadge({
  nodeId,
  placement = "inline",
}: {
  nodeId: string;
  /** inline=顶栏角标；center=卡片中央（右侧留给预览等 logo） */
  placement?: "inline" | "center";
}) {
  const signature = useCanvasStore((s) =>
    crewBulletinTasksSignature({ nodes: s.nodes, graphMeta: s.graphMeta }),
  );

  const status = useMemo(() => {
    const { nodes, graphMeta } = useCanvasStore.getState();
    return crewTaskStatusForNodeId(nodes, graphMeta, nodeId);
  }, [signature, nodeId]);

  if (!status || status === "unclaimed") return null;

  const tier = crewTaskNodeBadgeTier(status);
  const label = crewTaskNodeBadgeLabel(status);

  if (placement === "center") {
    return (
      <div className="pointer-events-none absolute inset-0 z-[12] flex items-center justify-center">
        <span
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-medium leading-none shadow-sm",
            crewTaskNodeBadgeClass(tier),
          )}
          title={`任务 · ${label}`}
        >
          {label}
        </span>
      </div>
    );
  }

  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium leading-none",
        crewTaskNodeBadgeClass(tier),
      )}
      title={`任务 · ${label}`}
    >
      {label}
    </span>
  );
}
