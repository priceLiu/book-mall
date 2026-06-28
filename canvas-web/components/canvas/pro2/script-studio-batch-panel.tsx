"use client";

import { useCallback, useMemo } from "react";
import { Loader2, Play } from "lucide-react";
import { useCanvasStore } from "@/lib/canvas/store";
import { busEnqueueStoryRun } from "@/lib/canvas/canvas-run-bus";
import {
  SCRIPT_STUDIO_TOTAL_EPISODE_PRESETS,
  scriptStudioBatchCount,
  scriptStudioBatchRange,
} from "@/lib/canvas/script-studio-prompts";
import type { StoryProStarterNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { isPro2StoryOutlineTextNode } from "@/lib/canvas/pro2-text-purpose";
import { RF_FORM_CONTROL } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";
import { spawnScriptStudioMediaCardsFromWorkspace } from "@/lib/canvas/script-studio-media-spawn";
import { useDialogs } from "@/components/dialogs/dialog-provider";

function findScriptStudioStarter(
  nodes: ReturnType<typeof useCanvasStore.getState>["nodes"],
) {
  return nodes.find(
    (n) =>
      n.type === "story-pro2-starter" &&
      (n.data as StoryProStarterNodeData).scriptStudioMode === true &&
      isPro2StoryOutlineTextNode((n.data ?? {}) as Record<string, unknown>),
  );
}

/** 剧本创作 · 批次进度与下一批生成（挂载于 Pro2 画布） */
export function ScriptStudioBatchPanel() {
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const addNode = useCanvasStore((s) => s.addNode);
  const { alert } = useDialogs();

  const starter = useMemo(() => findScriptStudioStarter(nodes), [nodes]);
  const d = (starter?.data ?? {}) as StoryProStarterNodeData;

  const total = d.scriptStudioTotalEpisodes ?? 30;
  const batchIndex = d.scriptStudioBatchIndex ?? 0;
  const batchTotal = scriptStudioBatchCount(total);
  const generatedEpisodes = Math.min(batchIndex * 10, total);
  const rt = d.themeOutlineRuntime;
  const running =
    rt?.status === "pending" || rt?.status === "running" || rt?.status === "submitted";
  const hasMore = batchIndex < batchTotal;
  const range =
    batchIndex < batchTotal
      ? scriptStudioBatchRange(batchIndex, total)
      : scriptStudioBatchRange(Math.max(0, batchTotal - 1), total);

  const onTotalChange = useCallback(
    (v: number) => {
      if (!starter) return;
      updateNodeData(starter.id, { scriptStudioTotalEpisodes: v });
    },
    [starter, updateNodeData],
  );

  const onSystemChange = useCallback(
    (system: "original" | "adaptation") => {
      if (!starter) return;
      updateNodeData(starter.id, { scriptStudioSystem: system });
    },
    [starter, updateNodeData],
  );

  const onNextBatch = useCallback(() => {
    if (!starter || running || !hasMore) return;
    busEnqueueStoryRun({
      nodeId: starter.id,
      mediaKind: "themeOutline",
    });
  }, [starter, running, hasMore]);

  const onSpawnMediaCards = useCallback(async () => {
    const result = spawnScriptStudioMediaCardsFromWorkspace({
      nodes: useCanvasStore.getState().nodes,
      addNode: addNode as never,
      updateNodeData,
    });
    if (result.spawned === 0) {
      await alert({
        title: "无需生成",
        message:
          result.skipped > 0
            ? "道具/氛围/音效媒体卡已全部展开。"
            : "请先生成至少一批剧本（含模块 3/4/9 数据）后再展开媒体卡。",
        variant: "info",
      });
      return;
    }
    await alert({
      title: "已展开媒体卡",
      message: `新建 ${result.spawned} 张 LibTV 媒体卡${result.skipped ? `，跳过 ${result.skipped} 张已存在` : ""}。`,
      variant: "success",
    });
  }, [addNode, updateNodeData, alert]);

  if (!starter) return null;

  return (
    <div
      className="pointer-events-auto absolute right-3 top-3 z-[56] w-[min(340px,calc(100vw-24px))] rounded-xl border border-cyan-400/25 bg-[var(--canvas-surface)]/95 p-3 shadow-lg"
      role="region"
      aria-label="剧本创作 · 批次生成"
    >
      <div className="mb-2 text-[13px] font-medium text-cyan-50">
        工业化剧本 · 批次生成
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <span className="text-[11px] text-white/50">总集数</span>
        {SCRIPT_STUDIO_TOTAL_EPISODE_PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            className={cn(
              "rounded-md px-2 py-0.5 text-[11px] transition",
              RF_FORM_CONTROL,
              total === n
                ? "bg-cyan-500/30 text-cyan-50"
                : "bg-white/5 text-white/60 hover:bg-white/10",
            )}
            onClick={() => onTotalChange(n)}
          >
            {n} 集
          </button>
        ))}
      </div>
      <div className="mb-2 flex gap-2">
        <button
          type="button"
          className={cn(
            "flex-1 rounded-lg border px-2 py-1 text-[11px]",
            d.scriptStudioSystem !== "adaptation"
              ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-50"
              : "border-white/10 text-white/55 hover:bg-white/5",
          )}
          onClick={() => onSystemChange("original")}
        >
          从零原创
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 rounded-lg border px-2 py-1 text-[11px]",
            d.scriptStudioSystem === "adaptation"
              ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-50"
              : "border-white/10 text-white/55 hover:bg-white/5",
          )}
          onClick={() => onSystemChange("adaptation")}
        >
          原稿翻新
        </button>
      </div>
      <div className="mb-2 text-[11px] text-white/55">
        进度：已生成 {generatedEpisodes}/{total} 集 · 第 {batchIndex}/{batchTotal}{" "}
        批
        {d.scriptStudioFrozenBiblesMd?.trim() ? " · 冻结档案已锁定" : ""}
      </div>
      {hasMore ? (
        <button
          type="button"
          disabled={running}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-cyan-600/90 py-2 text-[12px] font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
          onClick={onNextBatch}
        >
          {running ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Play className="size-3.5" />
          )}
          {batchIndex === 0
            ? `生成冻结档案 + 第 ${range.start}–${range.end} 集`
            : `生成第 ${range.start}–${range.end} 集（下一批）`}
        </button>
      ) : (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-center text-[11px] text-emerald-200/90">
          全部批次已生成
        </div>
      )}
      <button
        type="button"
        className="mt-2 w-full rounded-lg border border-white/15 py-1.5 text-[11px] text-white/70 transition hover:bg-white/5"
        onClick={() => void onSpawnMediaCards()}
      >
        展开道具 / 氛围 / 音效媒体卡
      </button>
    </div>
  );
}
