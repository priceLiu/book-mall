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
  Sparkles,
  Undo2,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CANVAS_PROJECT_HISTORY_MAX } from "@/lib/canvas/canvas-autosave-settings";
import {
  CANVAS_PANEL_TAB_ACTIVE_CLASS,
  CANVAS_SEMANTIC_ERROR_CLASS,
  CANVAS_SEMANTIC_STATUS_CLASS,
  CANVAS_SEMANTIC_TITLE_CLASS,
  CANVAS_TOOLBAR_BTN_CLASS,
  CANVAS_PRIMARY_BTN_SM_CLASS,
} from "@/lib/canvas/canvas-chrome-semantics";

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
  onOpenGenerationRecords,
  onOpenMyCharacters,
  onOpenMySavedScripts,
  onOpenMyVideoLibrary,
  onOpenProjectCharacterAssets,
  onOpenPromptHistory,
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
  onOpenGenerationRecords?: () => void;
  onOpenMyCharacters?: () => void;
  onOpenMySavedScripts?: () => void;
  onOpenMyVideoLibrary?: () => void;
  onOpenProjectCharacterAssets?: () => void;
  onOpenPromptHistory?: () => void;
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
          className={CANVAS_TOOLBAR_BTN_CLASS}
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
          className={cn(
            "min-w-0 max-w-[min(280px,28vw)] truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-medium hover:border-white/10 focus:border-white/25 focus:bg-black/20 focus:outline-none",
            CANVAS_SEMANTIC_TITLE_CLASS,
          )}
          title="点击编辑画布名称"
          aria-label="画布名称"
        />
        {inflightTaskCount > 0 ? (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-orange-500/20 px-2 py-0.5 text-[10px] font-medium text-orange-200"
            title="画布上有任务正在生成"
          >
            <Loader2 className="size-3 animate-spin" />
            生成中 · {inflightTaskCount} 个任务
          </span>
        ) : null}
        <span
          className={cn(
            "hidden shrink-0 text-[11px] lg:inline",
            saving || lastSavedAt ? CANVAS_SEMANTIC_STATUS_CLASS : "",
          )}
        >
          {saving
            ? "保存中…"
            : saveError
              ? (
                  <span
                    className={cn("truncate", CANVAS_SEMANTIC_ERROR_CLASS)}
                    title={`保存失败：${saveError}`}
                  >
                    保存失败：{saveError}
                  </span>
                )
              : lastSavedAt
                ? `已保存 ${lastSavedAt.toLocaleTimeString("zh-CN")}`
                : ""}
        </span>
      </div>
      <div className="ml-auto flex min-w-0 shrink-0 items-center justify-end gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button type="button" onClick={onUndo} className={CANVAS_TOOLBAR_BTN_CLASS}>
          <Undo2 className="size-3" /> 撤销
        </button>
        <button type="button" onClick={onRedo} className={CANVAS_TOOLBAR_BTN_CLASS}>
          <Redo2 className="size-3" /> 重做
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className={cn(CANVAS_TOOLBAR_BTN_CLASS, "disabled:opacity-50")}
        >
          {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
          手动保存
        </button>
        {onOpenMyHistory ? (
          <button
            type="button"
            onClick={onOpenMyHistory}
            className={CANVAS_TOOLBAR_BTN_CLASS}
            title={`自动/手动保存各 ${CANVAS_PROJECT_HISTORY_MAX} 条，互不影响`}
          >
            <History className="size-3" />
            我的历史
          </button>
        ) : null}
        {onOpenGenerationRecords ? (
          <button
            type="button"
            onClick={onOpenGenerationRecords}
            className={CANVAS_TOOLBAR_BTN_CLASS}
            title="查看成功与失败的 AI 生成记录"
          >
            <Sparkles className="size-3" />
            生成记录
          </button>
        ) : null}
        {onOpenMyTemplates ? (
          <button
            type="button"
            onClick={onOpenMyTemplates}
            className={CANVAS_TOOLBAR_BTN_CLASS}
          >
            <Bookmark className="size-3" />
            我的模板
          </button>
        ) : null}
        {onOpenMyCharacters ? (
          <button
            type="button"
            onClick={onOpenMyCharacters}
            className={CANVAS_TOOLBAR_BTN_CLASS}
          >
            <UserRound className="size-3" />
            我的角色
          </button>
        ) : null}
        {onOpenMySavedScripts ? (
          <button
            type="button"
            onClick={onOpenMySavedScripts}
            className={CANVAS_TOOLBAR_BTN_CLASS}
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
            className={CANVAS_TOOLBAR_BTN_CLASS}
            title="查看从画布保存到云端的视频"
          >
            <Film className="size-3" />
            我的视频库
          </button>
        ) : null}
        {onOpenPromptHistory ? (
          <button
            type="button"
            onClick={onOpenPromptHistory}
            className={CANVAS_TOOLBAR_BTN_CLASS}
            title="已提交提示词自动归档，按文字/图片/视频与成败分类"
          >
            <Sparkles className="size-3" />
            我的提示词
          </button>
        ) : null}
        {onOpenProjectCharacterAssets ? (
          <button
            type="button"
            onClick={onOpenProjectCharacterAssets}
            className={CANVAS_TOOLBAR_BTN_CLASS}
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
            className={CANVAS_TOOLBAR_BTN_CLASS}
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
            className={CANVAS_TOOLBAR_BTN_CLASS}
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
            className={CANVAS_TOOLBAR_BTN_CLASS}
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
              CANVAS_TOOLBAR_BTN_CLASS,
              immersive && CANVAS_PANEL_TAB_ACTIVE_CLASS,
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
          className={CANVAS_PRIMARY_BTN_SM_CLASS}
        >
          {running ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
          运行全部
        </button>
      </div>
    </header>
  );
}
