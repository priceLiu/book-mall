"use client";

import { useMemo, useState } from "react";
import type { CrewTaskKind } from "@/lib/canvas/crew-bulletin-types";
import type { CrewBulletinTask, CrewTaskStatus } from "@/lib/canvas/crew-bulletin-types";
import {
  crewBulletinTableColumns,
  type CrewBulletinTableColumn,
} from "@/lib/canvas/crew-bulletin-task-prompts";
import { cn } from "@/lib/utils";
import { MediaPreviewLightbox } from "../media-hover-box";

const CREW_PANEL_BG = "#0D1117";
const CREW_ROW_HOVER_BG = "#262626";

export type CrewBulletinEpisodeFilterProps = {
  episodes: number[];
  value: number | "all";
  onChange: (v: number | "all") => void;
};

/** 分镜 · 按集筛选 */
export function CrewBulletinEpisodeFilter({
  episodes,
  value,
  onChange,
}: CrewBulletinEpisodeFilterProps) {
  if (episodes.length <= 1) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-1 px-3 pt-1">
      <button
        type="button"
        className={cn(
          "rounded px-2 py-0.5 text-[10px]",
          value === "all"
            ? "bg-cyan-500/25 text-cyan-50"
            : "text-white/45 hover:bg-[#262626]",
        )}
        onClick={() => onChange("all")}
      >
        全部
      </button>
      {episodes.map((ep) => (
        <button
          key={ep}
          type="button"
          className={cn(
            "rounded px-2 py-0.5 text-[10px]",
            value === ep
              ? "bg-cyan-500/25 text-cyan-50"
              : "text-white/45 hover:bg-[#262626]",
          )}
          onClick={() => onChange(ep)}
        >
          第{ep}集
        </button>
      ))}
    </div>
  );
}

export type CrewBulletinVirtualTaskListProps = {
  tasks: CrewBulletinTask[];
  taskKind?: CrewTaskKind;
  episodeFilter?: number | "all";
  selectedTaskIds: Set<string>;
  claimableTaskIds: Set<string>;
  taskCells?: (task: CrewBulletinTask) => Record<string, string>;
  taskPreviewUrl?: (task: CrewBulletinTask) => string | undefined;
  onToggleSelect?: (taskId: string) => void;
  onSelectAll?: (taskIds: string[], select: boolean) => void;
  onSubmitDone?: (taskId: string) => void;
  onRevertDone?: (taskId: string) => void;
  statusLine: (task: CrewBulletinTask) => string;
  statusColor: (status: CrewTaskStatus) => string;
  /** 1=默认；1.2/1.45 放大表格字号 */
  contentScale?: number;
  /** 全屏模式：表格占满视口高度 */
  fullscreen?: boolean;
};

function gridTemplate(
  columns: CrewBulletinTableColumn[],
  fullscreen = false,
): string {
  const checkbox = "36px";
  const status = "76px";
  const preview = "52px";
  const actions = "48px";
  const dataCols = columns
    .map((c) => {
      if (!fullscreen) return c.minWidth;
      const grow = c.grow ?? 1;
      return `minmax(${c.minWidth}, ${grow}fr)`;
    })
    .join(" ");
  return `${checkbox} ${dataCols} ${status} ${preview} ${actions}`;
}

function TaskTableRow({
  task,
  columns,
  cells,
  selectable,
  selected,
  onToggleSelect,
  onSubmitDone,
  onRevertDone,
  statusLine,
  statusColor,
  previewUrl,
  onPreview,
  contentScale = 1,
  fullscreen = false,
}: {
  task: CrewBulletinTask;
  columns: CrewBulletinTableColumn[];
  cells: Record<string, string>;
  selectable: boolean;
  selected: boolean;
  onToggleSelect?: (taskId: string) => void;
  onSubmitDone?: (taskId: string) => void;
  onRevertDone?: (taskId: string) => void;
  statusLine: (task: CrewBulletinTask) => string;
  statusColor: (status: CrewTaskStatus) => string;
  previewUrl?: string;
  onPreview?: (url: string, title: string) => void;
  contentScale?: number;
  fullscreen?: boolean;
}) {
  const grid = gridTemplate(columns, fullscreen);
  const smallFontPx = Math.round(9 * contentScale);

  return (
    <div
      role="row"
      className={cn(
        "group grid w-full items-start gap-x-2 border-b border-white/[0.06] px-3 py-2.5 leading-relaxed transition-colors",
        selectable && onToggleSelect && "cursor-pointer",
        selected && selectable && "bg-white/[0.04]",
      )}
      style={{
        gridTemplateColumns: grid,
        backgroundColor: selected && selectable ? undefined : CREW_PANEL_BG,
      }}
      onMouseEnter={(e) => {
        if (!selected || !selectable) {
          e.currentTarget.style.backgroundColor = CREW_ROW_HOVER_BG;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor =
          selected && selectable ? "rgba(255,255,255,0.04)" : CREW_PANEL_BG;
      }}
      onClick={() => {
        if (selectable) onToggleSelect?.(task.id);
      }}
    >
      <div role="cell" className="flex items-start pt-0.5">
        <input
          type="checkbox"
          className="mt-0.5 shrink-0 disabled:cursor-not-allowed disabled:opacity-35"
          checked={selected}
          disabled={!selectable || !onToggleSelect}
          onChange={() => onToggleSelect?.(task.id)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {columns.map((col) => (
        <div
          key={col.key}
          role="cell"
          className="min-w-0 break-words text-white/65"
        >
          <span className="whitespace-pre-wrap">
            {cells[col.key]?.trim() || "—"}
          </span>
        </div>
      ))}

      <div
        role="cell"
        className={cn("pt-0.5", statusColor(task.status))}
        style={{ fontSize: `${smallFontPx}px` }}
      >
        {statusLine(task)}
      </div>

      <div role="cell" className="flex items-start pt-0.5">
        {previewUrl && onPreview ? (
          <button
            type="button"
            title="预览作品"
            className="nodrag block overflow-hidden rounded border border-white/15 bg-black/30 transition hover:border-cyan-400/40"
            onClick={(e) => {
              e.stopPropagation();
              onPreview(previewUrl, task.label);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-10 object-cover"
            />
          </button>
        ) : (
          <span className="text-white/20">—</span>
        )}
      </div>

      <div role="cell" className="flex flex-col gap-1 self-start pt-0.5">
        {(task.status === "claimed" || task.status === "generating") &&
        onSubmitDone ? (
          <button
            type="button"
            className="text-[9px] text-emerald-300/90 hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onSubmitDone(task.id);
            }}
          >
            提交
          </button>
        ) : null}
        {task.status === "done" && onRevertDone ? (
          <button
            type="button"
            className="text-[9px] text-amber-300/85 hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onRevertDone(task.id);
            }}
          >
            撤回
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function CrewBulletinVirtualTaskList({
  tasks,
  taskKind,
  episodeFilter = "all",
  selectedTaskIds,
  claimableTaskIds,
  taskCells,
  taskPreviewUrl,
  onToggleSelect,
  onSelectAll,
  onSubmitDone,
  onRevertDone,
  statusLine,
  statusColor,
  contentScale = 1,
  fullscreen = false,
}: CrewBulletinVirtualTaskListProps) {
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(
    null,
  );

  const filtered = useMemo(() => {
    if (episodeFilter === "all") return tasks;
    return tasks.filter((t) => t.episodeNo === episodeFilter);
  }, [tasks, episodeFilter]);

  const filteredClaimable = useMemo(
    () => filtered.filter((t) => claimableTaskIds.has(t.id)),
    [filtered, claimableTaskIds],
  );

  const columns = useMemo(
    () => crewBulletinTableColumns(taskKind ?? filtered[0]?.kind),
    [taskKind, filtered],
  );

  const grid = gridTemplate(columns, fullscreen);

  const allClaimableSelected =
    filteredClaimable.length > 0 &&
    filteredClaimable.every((t) => selectedTaskIds.has(t.id));

  if (!filtered.length) {
    return (
      <p className="px-3 py-3 text-[10px] text-white/40">当前筛选无任务</p>
    );
  }

  const baseFontPx = Math.round(10 * contentScale);
  const smallFontPx = Math.round(9 * contentScale);

  return (
    <>
    <div
      className={cn(
        fullscreen && "flex min-h-0 flex-1 flex-col",
      )}
      style={{ backgroundColor: CREW_PANEL_BG, fontSize: `${baseFontPx}px` }}
    >
      {onToggleSelect && filteredClaimable.length > 0 ? (
        <label
          className="flex shrink-0 cursor-pointer items-center gap-2 border-b border-white/[0.06] px-3 py-2 text-white/50 transition-colors hover:bg-[#262626]"
          style={{ backgroundColor: CREW_PANEL_BG, fontSize: `${baseFontPx}px` }}
        >
          <input
            type="checkbox"
            checked={allClaimableSelected}
            onChange={() => {
              onSelectAll?.(
                filteredClaimable.map((t) => t.id),
                !allClaimableSelected,
              );
            }}
          />
          全选（{filteredClaimable.length} 项待参与制作）
        </label>
      ) : null}

      <div
        className={cn(
          "overflow-x-auto overflow-y-auto",
          fullscreen ? "min-h-0 flex-1" : "max-h-[min(68vh,560px)]",
        )}
        style={{ backgroundColor: CREW_PANEL_BG }}
      >
        <div className={cn(fullscreen ? "w-full min-w-0" : "min-w-[780px]")}>
          <div
            role="row"
            className="sticky top-0 z-[1] grid w-full items-center gap-x-2 border-b border-white/10 px-3 py-2 font-medium text-white/45"
            style={{
              gridTemplateColumns: grid,
              backgroundColor: CREW_PANEL_BG,
              fontSize: `${baseFontPx}px`,
            }}
          >
            <div role="columnheader" />
            {columns.map((col) => (
              <div key={col.key} role="columnheader">
                {col.label}
              </div>
            ))}
            <div role="columnheader">状态</div>
            <div role="columnheader">作品</div>
            <div role="columnheader">操作</div>
          </div>

          {filtered.map((task) => {
            const selectable = claimableTaskIds.has(task.id);
            const cells = taskCells?.(task) ?? { 名称: task.label };
            const previewUrl =
              task.status === "done" ? taskPreviewUrl?.(task) : undefined;
            return (
              <TaskTableRow
                key={task.id}
                task={task}
                columns={columns}
                cells={cells}
                selectable={selectable}
                selected={selectedTaskIds.has(task.id)}
                onToggleSelect={selectable ? onToggleSelect : undefined}
                onSubmitDone={onSubmitDone}
                onRevertDone={onRevertDone}
                statusLine={statusLine}
                statusColor={statusColor}
                previewUrl={previewUrl}
                onPreview={(url, title) => setPreview({ url, title })}
                contentScale={contentScale}
                fullscreen={fullscreen}
              />
            );
          })}
        </div>
      </div>
    </div>
    {preview ? (
      <MediaPreviewLightbox
        src={preview.url}
        kind="image"
        alt={preview.title}
        onClose={() => setPreview(null)}
      />
    ) : null}
    </>
  );
}

export function collectEpisodeNumbers(tasks: CrewBulletinTask[]): number[] {
  const set = new Set<number>();
  for (const t of tasks) {
    if (t.episodeNo != null && t.episodeNo > 0) set.add(t.episodeNo);
  }
  return Array.from(set).sort((a, b) => a - b);
}
