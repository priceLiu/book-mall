"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  crewBulletinTasksSignature,
  crewTaskNodeBadgeClass,
  crewTaskNodeBadgeTier,
} from "@/lib/canvas/crew-task-node-status";
import {
  CREW_NODE_COMPLETED_LABEL,
  CREW_NODE_PARTICIPATING_LABEL,
  crewNodeCenterBadgeLabel,
  crewNodeShowsParticipatingBadge,
  useCrewTaskCompleteProduction,
} from "@/components/canvas/libtv-node-header-bar";
import { cn } from "@/lib/utils";

/** 领取任务生成的工作节点 · 顶栏居中 · 参与制作 / 完成制作（同一徽章） */
export function Pro2CrewTaskStatusBadge({
  nodeId,
}: {
  nodeId: string;
}) {
  const signature = useCanvasStore((s) =>
    crewBulletinTasksSignature({ nodes: s.nodes, graphMeta: s.graphMeta }),
  );
  const nodes = useCanvasStore((s) => s.nodes);
  const graphMeta = useCanvasStore((s) => s.graphMeta);
  const { canComplete, submitting, onComplete } =
    useCrewTaskCompleteProduction(nodeId);

  const label = useMemo(
    () => crewNodeCenterBadgeLabel(nodeId, nodes, graphMeta),
    [nodeId, nodes, graphMeta, signature],
  );

  const visible = useMemo(
    () => crewNodeShowsParticipatingBadge(nodeId, nodes, graphMeta),
    [nodeId, nodes, graphMeta, signature],
  );

  if (!visible || !label) return null;

  const tier = crewTaskNodeBadgeTier(
    label === CREW_NODE_COMPLETED_LABEL ? "done" : "claimed",
  );
  const badgeClass = cn(
    "rounded-md px-2 py-0.5 text-[10px] font-medium leading-none shadow-sm",
    crewTaskNodeBadgeClass(tier),
  );
  const clickable =
    label === CREW_NODE_PARTICIPATING_LABEL && canComplete && !submitting;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] flex h-full items-center justify-center px-14">
      {clickable ? (
        <button
          type="button"
          className={cn(badgeClass, "nodrag pointer-events-auto transition hover:brightness-110")}
          title="完成制作 · 提交到公告栏"
          disabled={submitting}
          onClick={(e) => {
            e.stopPropagation();
            void onComplete();
          }}
        >
          {submitting ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            CREW_NODE_PARTICIPATING_LABEL
          )}
        </button>
      ) : (
        <span className={badgeClass} title={`任务 · ${label}`}>
          {label}
        </span>
      )}
    </div>
  );
}
