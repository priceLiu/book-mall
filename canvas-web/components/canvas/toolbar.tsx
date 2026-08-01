"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
  Save,
  Share2,
  Sparkles,
  Undo2,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CANVAS_PROJECT_HISTORY_MAX } from "@/lib/canvas/canvas-autosave-settings";
import {
  CANVAS_SEMANTIC_ERROR_CLASS,
  CANVAS_SEMANTIC_STATUS_CLASS,
  CANVAS_SEMANTIC_TITLE_CLASS,
  CANVAS_TOOLBAR_BTN_CLASS,
  CANVAS_PRIMARY_BTN_SM_CLASS,
} from "@/lib/canvas/canvas-chrome-semantics";
import {
  CanvasToolbarDropdownItem,
  CanvasToolbarDropdownMenu,
  CanvasToolbarDropdownTrigger,
  useCanvasToolbarDropdown,
} from "@/components/canvas/canvas-toolbar-dropdown";
import { flushCanvasGraphPersist } from "@/lib/canvas/canvas-graph-persist-bridge";
import {
  CANVAS_IMAGE_UPLOADS_CHANGED,
  hasPendingCanvasImageUploads,
  pendingCanvasImageUploadCount,
  waitForPendingCanvasImageUploads,
  flushPendingCanvasImageUploadPersist,
} from "@/lib/canvas/canvas-pending-image-uploads";

type ToolbarMenuKey = "mine";

export function CanvasToolbar({
  projectName,
  onProjectNameChange,
  onProjectNameCommit,
  saving,
  saveError,
  lastSavedAt,
  onSave,
  onUndo,
  onSaveTemplate,
  onShareTemplate,
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
  inflightTaskCount = 0,
  immersive = false,
  onToggleImmersive,
  centerLeading,
}: {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onProjectNameCommit: () => void;
  saving: boolean;
  saveError: string | null;
  lastSavedAt: Date | null;
  onSave: () => void;
  onUndo: () => void;
  onSaveTemplate?: () => void;
  onShareTemplate?: () => void;
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
  inflightTaskCount?: number;
  immersive?: boolean;
  onToggleImmersive?: () => void;
  /** 顶栏中部 · 「回到画布列表」左侧（如 Pro2 关联剧本包） */
  centerLeading?: ReactNode;
}) {
  const router = useRouter();
  const mineMenu = useCanvasToolbarDropdown();
  const [openMenu, setOpenMenu] = useState<ToolbarMenuKey | null>(null);
  const [leavingProject, setLeavingProject] = useState(false);
  const [imageUploadPending, setImageUploadPending] = useState(false);
  const [imageUploadCount, setImageUploadCount] = useState(0);

  useEffect(() => {
    const sync = () => {
      setImageUploadPending(hasPendingCanvasImageUploads());
      setImageUploadCount(pendingCanvasImageUploadCount());
    };
    sync();
    window.addEventListener(CANVAS_IMAGE_UPLOADS_CHANGED, sync);
    return () =>
      window.removeEventListener(CANVAS_IMAGE_UPLOADS_CHANGED, sync);
  }, []);

  const onBackToProjects = useCallback(
    async (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      if (leavingProject) return;
      setLeavingProject(true);
      try {
        await waitForPendingCanvasImageUploads(60_000);
        await flushPendingCanvasImageUploadPersist();
        await flushCanvasGraphPersist(true);
        router.push("/projects");
      } finally {
        setLeavingProject(false);
      }
    },
    [leavingProject, router],
  );

  useEffect(() => {
    mineMenu.setOpen(openMenu === "mine");
  }, [openMenu, mineMenu]);

  const closeMenus = useCallback(() => {
    setOpenMenu(null);
  }, []);

  const toggleMenu = useCallback((key: ToolbarMenuKey) => {
    setOpenMenu((prev) => (prev === key ? null : key));
  }, []);

  const runMenuAction = useCallback(
    (action: () => void) => {
      closeMenus();
      action();
    },
    [closeMenus],
  );

  const mineItems = useMemo(() => {
    const items: Array<{
      icon: React.ComponentType<{ className?: string }>;
      label: string;
      title?: string;
      onClick: () => void;
    }> = [];
    if (onOpenMyHistory) {
      items.push({
        icon: History,
        label: "我的历史",
        title: `自动/手动保存各 ${CANVAS_PROJECT_HISTORY_MAX} 条`,
        onClick: () => runMenuAction(onOpenMyHistory),
      });
    }
    if (onOpenMyTemplates) {
      items.push({
        icon: Bookmark,
        label: "我的模板",
        onClick: () => runMenuAction(onOpenMyTemplates),
      });
    }
    if (onOpenMyCharacters) {
      items.push({
        icon: UserRound,
        label: "我的角色",
        onClick: () => runMenuAction(onOpenMyCharacters),
      });
    }
    if (onOpenMySavedScripts) {
      items.push({
        icon: BookOpen,
        label: "我保存的剧本",
        title: "本画布内故事定稿的只读剧本历史",
        onClick: () => runMenuAction(onOpenMySavedScripts),
      });
    }
    if (onOpenMyVideoLibrary) {
      items.push({
        icon: Film,
        label: "我的视频库",
        onClick: () => runMenuAction(onOpenMyVideoLibrary),
      });
    }
    if (onOpenPromptHistory) {
      items.push({
        icon: Sparkles,
        label: "我的提示词",
        title: "已提交提示词自动归档",
        onClick: () => runMenuAction(onOpenPromptHistory),
      });
    }
    if (onOpenGenerationRecords) {
      items.push({
        icon: Sparkles,
        label: "生成记录",
        title: "成功与失败的 AI 生成记录",
        onClick: () => runMenuAction(onOpenGenerationRecords),
      });
    }
    return items;
  }, [
    onOpenMyHistory,
    onOpenMyTemplates,
    onOpenMyCharacters,
    onOpenMySavedScripts,
    onOpenMyVideoLibrary,
    onOpenPromptHistory,
    onOpenGenerationRecords,
    runMenuAction,
  ]);

  return (
    <header
      data-canvas-toolbar
      className="relative grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 overflow-hidden border-b border-white/10 bg-[#181818] px-3 py-2 text-white"
    >
      <div
        data-canvas-toolbar-meta
        className="flex min-w-0 max-w-full items-center justify-start gap-2 overflow-hidden"
      >
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
        {imageUploadPending ? (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-cyan-500/15 px-2 py-0.5 text-[10px] font-medium text-cyan-100"
            title="粘贴/上传图片正在写入 OSS"
          >
            <Loader2 className="size-3 animate-spin" />
            图片上传中
            {imageUploadCount > 1 ? ` · ${imageUploadCount}` : ""}
          </span>
        ) : null}
        {saving || leavingProject ? (
          <span
            className={cn(
              "hidden min-w-0 max-w-[min(220px,28vw)] shrink truncate text-[11px] lg:inline",
              CANVAS_SEMANTIC_STATUS_CLASS,
            )}
            title="画布数据写入云端"
          >
            {leavingProject ? "正在保存并离开…" : "保存中…"}
          </span>
        ) : !imageUploadPending && (lastSavedAt || saveError) ? (
          <span
            className={cn(
              "hidden min-w-0 max-w-[min(220px,28vw)] shrink truncate text-[11px] lg:inline",
              saveError ? CANVAS_SEMANTIC_ERROR_CLASS : CANVAS_SEMANTIC_STATUS_CLASS,
            )}
            title={saveError ? `保存失败：${saveError}` : undefined}
          >
            {saveError ? (
              <>保存失败：{saveError}</>
            ) : lastSavedAt ? (
              `已保存 ${lastSavedAt.toLocaleTimeString("zh-CN")}`
            ) : (
              ""
            )}
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 items-center justify-center gap-2">
        {centerLeading}
        <Link
          href="/projects"
          onClick={(e) => void onBackToProjects(e)}
          className={cn(
            CANVAS_TOOLBAR_BTN_CLASS,
            "whitespace-nowrap",
            (leavingProject || imageUploadPending) && "opacity-80",
          )}
        >
          {leavingProject ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <ArrowLeft className="size-3" />
          )}{" "}
          {leavingProject ? "正在保存图片…" : "回到画布列表"}
        </Link>
      </div>
      <div
        data-canvas-toolbar-actions
        className="flex min-w-0 items-center justify-end gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <button type="button" onClick={onUndo} className={CANVAS_TOOLBAR_BTN_CLASS}>
          <Undo2 className="size-3" /> 撤销
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className={cn(CANVAS_TOOLBAR_BTN_CLASS, "disabled:opacity-50")}
        >
          {saving ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Save className="size-3" />
          )}
          保存
        </button>

        {mineItems.length > 0 ? (
          <>
            <CanvasToolbarDropdownTrigger
              label="我的"
              open={openMenu === "mine"}
              anchorRef={mineMenu.anchorRef}
              onClick={() => toggleMenu("mine")}
            />
            <CanvasToolbarDropdownMenu
              open={openMenu === "mine"}
              onClose={closeMenus}
              rect={mineMenu.rect}
              align="end"
              minWidth={196}
            >
              {mineItems.map((item) => (
                <CanvasToolbarDropdownItem
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  title={item.title}
                  onClick={item.onClick}
                />
              ))}
            </CanvasToolbarDropdownMenu>
          </>
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
        {onShareTemplate ? (
          <button
            type="button"
            onClick={onShareTemplate}
            className={CANVAS_TOOLBAR_BTN_CLASS}
            title="将当前画布分享到社区模板"
          >
            <Share2 className="size-3" />
            分享到社区
          </button>
        ) : null}
        {onToggleImmersive ? (
          <button
            type="button"
            onClick={onToggleImmersive}
            className={CANVAS_PRIMARY_BTN_SM_CLASS}
            title={
              immersive
                ? "退出全屏（Esc）"
                : "全屏编辑：隐藏顶栏，鼠标移到屏幕顶部可唤出"
            }
          >
            {immersive ? (
              <Minimize2 className="size-3" />
            ) : (
              <Maximize2 className="size-3" />
            )}
            {immersive ? "退出全屏" : "全屏"}
          </button>
        ) : null}
      </div>
    </header>
  );
}
