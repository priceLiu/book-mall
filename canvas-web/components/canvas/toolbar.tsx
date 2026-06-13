"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Bookmark,
  BookmarkPlus,
  BookOpen,
  Film,
  History,
  LayoutGrid,
  LayoutTemplate,
  Loader2,
  Maximize2,
  Minimize2,
  Play,
  Redo2,
  Save,
  Undo2,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  onOpenMyTemplates,
  onOpenMyHistory,
  onOpenMyCharacters,
  onOpenMySavedScripts,
  onOpenMyVideoLibrary,
  onOpenProjectCharacterAssets,
  onOpenStyleLibrary,
  onReflowStoryLayout,
  running,
  inflightTaskCount = 0,
  runAllDisabled = false,
  immersive = false,
  onToggleImmersive,
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
  onOpenMyTemplates?: () => void;
  onOpenMyHistory?: () => void;
  onOpenMyCharacters?: () => void;
  onOpenMySavedScripts?: () => void;
  onOpenMyVideoLibrary?: () => void;
  onOpenProjectCharacterAssets?: () => void;
  onOpenStyleLibrary?: () => void;
  onReflowStoryLayout?: () => void;
  running: boolean;
  inflightTaskCount?: number;
  runAllDisabled?: boolean;
  /** 沉浸全屏模式（Pro2 / 分镜 1.0） */
  immersive?: boolean;
  onToggleImmersive?: () => void;
}) {
  return (
    <header className="relative flex shrink-0 items-center gap-2 border-b border-white/10 bg-[var(--canvas-surface)] px-3 py-2 text-white">
      <div className="flex min-w-0 shrink items-center gap-2">
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
          className="min-w-0 max-w-[min(280px,28vw)] truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-medium text-emerald-200 hover:border-white/10 focus:border-emerald-400/40 focus:bg-black/20 focus:outline-none"
          title="点击编辑画布名称"
          aria-label="画布名称"
        />
        {inflightTaskCount > 0 ? (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-violet-500/25 px-2 py-0.5 text-[10px] font-medium text-violet-100"
            title="画布上有任务正在生成"
          >
            <Loader2 className="size-3 animate-spin" />
            生成中 · {inflightTaskCount} 个任务
          </span>
        ) : null}
        <span className="hidden shrink-0 text-[11px] text-emerald-300/75 lg:inline">
          {saving
            ? "保存中…"
            : saveError
              ? <span className="truncate text-red-400/90" title={`保存失败：${saveError}`}>保存失败：{saveError}</span>
              : lastSavedAt
                ? `已保存 ${lastSavedAt.toLocaleTimeString("zh-CN")}`
                : ""}
        </span>
      </div>
      <div className="ml-auto flex min-w-0 shrink-0 items-center justify-end gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
        {onOpenMyHistory ? (
          <button
            type="button"
            onClick={onOpenMyHistory}
            className="inline-flex items-center gap-1 rounded-md border border-violet-400/25 bg-violet-500/8 px-2 py-1 text-[11px] text-violet-100/90 hover:border-violet-400/40 hover:bg-violet-500/15 hover:text-violet-50"
            title="查看自动/手动保存的历史版本（每项目最多 15 条）"
          >
            <History className="size-3" />
            我的历史
          </button>
        ) : null}
        {onOpenMyTemplates ? (
          <button
            type="button"
            onClick={onOpenMyTemplates}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-[var(--canvas-muted)] hover:border-white/30 hover:text-white"
          >
            <Bookmark className="size-3" />
            我的模板
          </button>
        ) : null}
        {onOpenMyCharacters ? (
          <button
            type="button"
            onClick={onOpenMyCharacters}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-[var(--canvas-muted)] hover:border-white/30 hover:text-white"
          >
            <UserRound className="size-3" />
            我的角色
          </button>
        ) : null}
        {onOpenMySavedScripts ? (
          <button
            type="button"
            onClick={onOpenMySavedScripts}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-400/25 bg-emerald-500/8 px-2 py-1 text-[11px] text-emerald-100/90 hover:border-emerald-400/40 hover:bg-emerald-500/15 hover:text-emerald-50"
            title="查看本画布内故事定稿的只读剧本历史"
          >
            <BookOpen className="size-3" />
            我保存的剧本
          </button>
        ) : null}
        {onOpenMyVideoLibrary ? (
          <button
            type="button"
            onClick={onOpenMyVideoLibrary}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-[var(--canvas-muted)] hover:border-white/30 hover:text-white"
            title="查看从画布保存到云端的视频"
          >
            <Film className="size-3" />
            我的视频库
          </button>
        ) : null}
        {onOpenProjectCharacterAssets ? (
          <button
            type="button"
            onClick={onOpenProjectCharacterAssets}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-400/25 bg-emerald-500/8 px-2 py-1 text-[11px] text-emerald-100/90 hover:border-emerald-400/40 hover:bg-emerald-500/15 hover:text-emerald-50"
            title="查看本项目角色与场景资产库"
          >
            <UserRound className="size-3" />
            项目资产
          </button>
        ) : null}
        {onOpenStyleLibrary ? (
          <button
            type="button"
            onClick={onOpenStyleLibrary}
            className="inline-flex items-center gap-1 rounded-md border border-cyan-400/25 bg-cyan-500/8 px-2 py-1 text-[11px] text-cyan-100/90 hover:border-cyan-400/40 hover:bg-cyan-500/15 hover:text-cyan-50"
            title="浏览平台内置风格库并套用到风格定义节点"
          >
            <LayoutGrid className="size-3" />
            风格库
          </button>
        ) : null}
        {onReflowStoryLayout ? (
          <button
            type="button"
            onClick={onReflowStoryLayout}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-100 hover:border-emerald-400/50 hover:bg-emerald-500/20"
            title="按漫剧工作流重新排列节点"
          >
            <LayoutTemplate className="size-3" />
            重排
          </button>
        ) : null}
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
        {onToggleImmersive ? (
          <button
            type="button"
            onClick={onToggleImmersive}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition",
              immersive
                ? "border-cyan-400/35 bg-cyan-500/12 text-cyan-100 hover:border-cyan-400/50 hover:bg-cyan-500/20"
                : "border-white/10 text-[var(--canvas-muted)] hover:border-white/30 hover:text-white",
            )}
            title={immersive ? "退出全屏（Esc）" : "全屏编辑：隐藏顶栏，鼠标移到屏幕顶部可唤出"}
          >
            {immersive ? (
              <Minimize2 className="size-3" />
            ) : (
              <Maximize2 className="size-3" />
            )}
            {immersive ? "退出全屏" : "全屏"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRunAll}
          disabled={running || runAllDisabled}
          title={
            runAllDisabled
              ? "请先在 Book 个人中心绑定 AI 模型密钥"
              : undefined
          }
          className="inline-flex items-center gap-1 rounded-md bg-[var(--canvas-accent)] px-3 py-1 text-[12px] font-medium text-black hover:bg-[var(--canvas-accent-soft)] hover:text-white disabled:opacity-60"
        >
          {running ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
          运行全部
        </button>
      </div>
    </header>
  );
}
