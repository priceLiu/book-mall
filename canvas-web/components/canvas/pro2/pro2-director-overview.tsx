"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, LayoutDashboard } from "lucide-react";
import { useCanvasStore } from "@/lib/canvas/store";
import type { CanvasFlowNode } from "@/lib/canvas/types";
import type {
  StoryProFrameRow,
  StoryProStarterNodeData,
} from "@/lib/canvas/story-pro-workspace-types";
import type { StoryPro2WorkspaceIds } from "@/lib/canvas/story-pro2-workspace-types";
import {
  scriptStudioBatchCount,
} from "@/lib/canvas/script-studio-prompts";
import { cn } from "@/lib/utils";

type EpisodeAgg = {
  episodeNo: number;
  frameCount: number;
  submitted: number;
  draft: number;
  collapsed: boolean;
};

function aggregateEpisodes(
  rows: StoryProFrameRow[],
  totalEpisodes: number,
): EpisodeAgg[] {
  const map = new Map<number, { submitted: number; draft: number }>();
  for (const r of rows) {
    const ep = r.episodeNo ?? 0;
    if (!ep) continue;
    const cur = map.get(ep) ?? { submitted: 0, draft: 0 };
    if (r.stageStatus === "submitted") cur.submitted += 1;
    else cur.draft += 1;
    map.set(ep, cur);
  }
  const out: EpisodeAgg[] = [];
  for (let ep = 1; ep <= totalEpisodes; ep++) {
    const c = map.get(ep) ?? { submitted: 0, draft: 0 };
    out.push({
      episodeNo: ep,
      frameCount: c.submitted + c.draft,
      submitted: c.submitted,
      draft: c.draft,
      collapsed: ep > 3,
    });
  }
  return out;
}

function columnRows(
  col: CanvasFlowNode | undefined,
): StoryProFrameRow[] {
  const data = col?.data as { rows?: StoryProFrameRow[] } | undefined;
  return data?.rows ?? [];
}

/** 导演进度总览 · 各集分镜提交聚合（轻量看板） */
export function Pro2DirectorOverview() {
  const [open, setOpen] = useState(false);
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<number>>(
    () => new Set([1, 2, 3]),
  );
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const { starter, frameRows, total, batchIndex } = useMemo(() => {
    const st = nodes.find(
      (n) =>
        n.type === "story-pro2-starter" &&
        (n.data as StoryProStarterNodeData).scriptStudioMode,
    );
    const d = (st?.data ?? {}) as StoryProStarterNodeData;
    const ws = d.workspaceIds as StoryPro2WorkspaceIds | undefined;
    const frameCol = ws?.frameColumnId
      ? nodes.find((n) => n.id === ws.frameColumnId)
      : undefined;
    const rows = columnRows(frameCol);
    return {
      starter: st,
      frameRows: rows,
      total: d.scriptStudioTotalEpisodes ?? 30,
      batchIndex: d.scriptStudioBatchIndex ?? 0,
    };
  }, [nodes]);

  const episodes = useMemo(
    () => aggregateEpisodes(frameRows, total),
    [frameRows, total],
  );

  const batchTotal = scriptStudioBatchCount(total);
  const doneBatches = batchIndex;
  const scriptPct = batchTotal
    ? Math.round((doneBatches / batchTotal) * 100)
    : 0;

  const frameColumnId = useMemo(() => {
    const ws = (starter?.data as StoryProStarterNodeData | undefined)
      ?.workspaceIds as StoryPro2WorkspaceIds | undefined;
    return ws?.frameColumnId;
  }, [starter]);

  const episodeFrames = useMemo(() => {
    const map = new Map<number, StoryProFrameRow[]>();
    for (const r of frameRows) {
      const ep = r.episodeNo ?? 0;
      if (!ep) continue;
      const list = map.get(ep) ?? [];
      list.push(r);
      map.set(ep, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.frameIndex - b.frameIndex);
    }
    return map;
  }, [frameRows]);

  const patchFrameRows = (nextRows: StoryProFrameRow[]) => {
    if (!frameColumnId) return;
    updateNodeData(frameColumnId, { rows: nextRows });
  };

  const toggleFrameStatus = (rowKey: string) => {
    patchFrameRows(
      frameRows.map((r) =>
        r.key === rowKey
          ? {
              ...r,
              stageStatus:
                r.stageStatus === "submitted"
                  ? ("draft" as const)
                  : ("submitted" as const),
            }
          : r,
      ),
    );
  };

  const submitEpisode = (episodeNo: number) => {
    patchFrameRows(
      frameRows.map((r) =>
        r.episodeNo === episodeNo
          ? { ...r, stageStatus: "submitted" as const }
          : r,
      ),
    );
  };

  if (!starter) return null;

  return (
    <div className="pointer-events-none absolute right-3 bottom-20 z-[56] flex flex-col items-end">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/80 px-3 py-1.5 text-[12px] text-white/80 shadow-lg hover:bg-black/90"
      >
        <LayoutDashboard className="size-4" />
        导演总览
        {open ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
      </button>
      {open ? (
        <div className="pointer-events-auto mt-2 max-h-[min(420px,50vh)] w-[min(360px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-white/10 bg-[var(--canvas-surface)]/98 p-3 shadow-xl">
          <div className="mb-2 text-[12px] text-white/55">
            剧本批次 {doneBatches}/{batchTotal}（{scriptPct}%）· 分镜按集汇总
          </div>
          <div className="space-y-1">
            {episodes.map((ep) => {
              const expanded = expandedEpisodes.has(ep.episodeNo);
              const hasFrames = ep.frameCount > 0;
              const epDone =
                hasFrames && ep.submitted > 0 && ep.draft === 0;
              return (
                <div
                  key={ep.episodeNo}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.03]"
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-2 py-1.5 text-left text-[11px]"
                    onClick={() =>
                      setExpandedEpisodes((prev) => {
                        const next = new Set(prev);
                        if (next.has(ep.episodeNo)) next.delete(ep.episodeNo);
                        else next.add(ep.episodeNo);
                        return next;
                      })
                    }
                  >
                    <span className="text-white/85">
                      第 {String(ep.episodeNo).padStart(2, "0")} 集
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5",
                        epDone
                          ? "bg-emerald-500/20 text-emerald-200"
                          : hasFrames
                            ? "bg-amber-500/15 text-amber-100"
                            : "bg-white/5 text-white/40",
                      )}
                    >
                      {hasFrames
                        ? `${ep.submitted}/${ep.frameCount} 已提交`
                        : "未展开"}
                    </span>
                  </button>
                  {expanded && hasFrames ? (
                    <div className="border-t border-white/[0.06] px-2 py-1.5 space-y-1">
                      {(episodeFrames.get(ep.episodeNo) ?? []).map((row) => (
                        <div
                          key={row.key}
                          className="flex items-center justify-between gap-2 text-[10px]"
                        >
                          <span className="truncate text-white/70">
                            镜 {row.frameIndex}
                            {row.shotNo ? ` · ${row.shotNo}` : ""}
                          </span>
                          <button
                            type="button"
                            className={cn(
                              "shrink-0 rounded px-1.5 py-0.5",
                              row.stageStatus === "submitted"
                                ? "bg-emerald-500/20 text-emerald-200"
                                : "bg-white/10 text-white/55 hover:bg-white/15",
                            )}
                            onClick={() => toggleFrameStatus(row.key)}
                          >
                            {row.stageStatus === "submitted" ? "已提交" : "草稿"}
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="mt-1 text-[10px] text-cyan-300/90 hover:underline"
                        onClick={() => submitEpisode(ep.episodeNo)}
                      >
                        本集全部标记为已提交
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
