"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BookmarkPlus,
  Loader2,
  Play,
  Redo2,
  Save,
  Undo2,
} from "lucide-react";

export function CanvasToolbar({
  projectName,
  onProjectNameChange,
  onProjectNameCommit,
  saving,
  saveError,
  lastSavedAt,
  onSave,
  onUndo,
  onRedo,
  onRunAll,
  onSaveTemplate,
  running,
  inflightTaskCount = 0,
}: {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onProjectNameCommit: () => void;
  saving: boolean;
  saveError: string | null;
  lastSavedAt: Date | null;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRunAll: () => void;
  onSaveTemplate?: () => void;
  running: boolean;
  inflightTaskCount?: number;
}) {
  return (
    <header className="relative z-50 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[var(--canvas-surface)] px-3 py-2 text-white">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Link
          href="/projects"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-[var(--canvas-muted)] hover:border-white/30 hover:text-white"
        >
          <ArrowLeft className="size-3" /> 返回
        </Link>
        <input
          type="text"
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          onBlur={() => onProjectNameCommit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          maxLength={80}
          className="min-w-0 max-w-[280px] truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-medium text-white hover:border-white/10 focus:border-[var(--canvas-accent)]/50 focus:bg-black/20 focus:outline-none"
          title="点击编辑画布名称"
          aria-label="画布名称"
        />
        {inflightTaskCount > 0 ? (
          <span
            className="shrink-0 rounded-md bg-emerald-500/85 px-2 py-0.5 text-[10px] font-medium text-black"
            title="画布上有节点正在生成"
          >
            {inflightTaskCount} 个任务进行中
          </span>
        ) : null}
        <span className="hidden shrink-0 text-[11px] text-[var(--canvas-muted)] sm:inline">
          {saving
            ? "保存中…"
            : saveError
              ? <span className="text-red-300">保存失败：{saveError}</span>
              : lastSavedAt
                ? `已保存 ${lastSavedAt.toLocaleTimeString("zh-CN")}`
                : ""}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onUndo}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-[var(--canvas-muted)] hover:border-white/30 hover:text-white"
        >
          <Undo2 className="size-3" /> 撤销
        </button>
        <button
          type="button"
          onClick={onRedo}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-[var(--canvas-muted)] hover:border-white/30 hover:text-white"
        >
          <Redo2 className="size-3" /> 重做
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-[var(--canvas-muted)] hover:border-white/30 hover:text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
          手动保存
        </button>
        {onSaveTemplate ? (
          <button
            type="button"
            onClick={onSaveTemplate}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-[var(--canvas-muted)] hover:border-white/30 hover:text-white"
          >
            <BookmarkPlus className="size-3" />
            存为模板
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRunAll}
          disabled={running}
          className="inline-flex items-center gap-1 rounded-md bg-[var(--canvas-accent)] px-3 py-1 text-[12px] font-medium text-black hover:bg-[var(--canvas-accent-soft)] hover:text-white disabled:opacity-60"
        >
          {running ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
          运行全部
        </button>
      </div>
    </header>
  );
}
