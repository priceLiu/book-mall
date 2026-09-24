"use client";

import {
  Download,
  Eraser,
  Eye,
  History,
  Images,
  Layers,
  LayoutGrid,
  Paintbrush,
  Plus,
  Save,
  Trash2,
  Undo2 as UndoLayerIcon,
  SquareDashed,
  Undo2,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { EcomProjectListButton } from "@/components/layout/ecom-project-list-button";
import { EcomIconButton } from "@/components/ui/ecom-icon-button";
import { EcomIconToolbar, EcomIconToolbarGroup } from "@/components/ui/ecom-icon-toolbar";
import { ECOM_GENERATION_RECORD_LIBRARY_PATH } from "@/lib/ecom-generation-record-api";
import type { EcomProjectListItem } from "@/lib/ecom-project-list-types";
import type { ImageLayerCanvasToolMode } from "@/lib/image-layer-tool-mode";
import { cn } from "@/lib/utils";

function ToolbarDivider() {
  return (
    <div
      className="mx-0.5 hidden h-6 w-px shrink-0 bg-[#d2d2d7] sm:block"
      aria-hidden
    />
  );
}

type Props = {
  projectTitle?: string | null;
  toolMode: ImageLayerCanvasToolMode;
  decomposeBusy: boolean;
  anyBusy: boolean;
  saveBusy?: boolean;
  hasPreview: boolean;
  hasStack: boolean;
  canSave: boolean;
  pendingBboxCount?: number;
  currentProjectId?: string | null;
  loadProjectList?: () => Promise<EcomProjectListItem[]>;
  onToolModeChange: (mode: ImageLayerCanvasToolMode) => void;
  onUndoBbox: () => void;
  onClearBboxes: () => void;
  onDecompose: () => void;
  onSave?: () => void;
  onCancelLayerSession?: () => void;
  layerSessionLocked?: boolean;
  onNewProject?: () => void;
  onSelectProject?: (id: string) => void | Promise<void>;
  onReset: () => void;
  previewBusy?: boolean;
  onPreviewExport: () => void;
  onExport: () => void;
};

export function ImageLayerToolbar({
  projectTitle,
  toolMode,
  decomposeBusy,
  anyBusy,
  saveBusy,
  hasPreview,
  hasStack,
  canSave,
  pendingBboxCount = 0,
  currentProjectId,
  loadProjectList,
  onToolModeChange,
  onUndoBbox,
  onClearBboxes,
  onDecompose,
  onSave,
  onCancelLayerSession,
  layerSessionLocked = false,
  onNewProject,
  onSelectProject,
  onReset,
  previewBusy,
  onPreviewExport,
  onExport,
}: Props) {
  const router = useRouter();
  const canUseTools = hasPreview && !anyBusy;
  const canDecomposeBbox = canUseTools && !hasStack;
  const canLocalEdit = canUseTools && !layerSessionLocked;
  const hasBboxes = pendingBboxCount > 0;

  const setMode = (mode: ImageLayerCanvasToolMode) => {
    if (!canUseTools && mode !== "layer-view") return;
    onToolModeChange(mode);
  };

  return (
    <header className="z-20 border-b border-[#e8e8ed] bg-white px-5 py-3 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-[#1d1d1f]">
            {projectTitle?.trim() || "图片分层"}
          </h2>
          <p className="text-[11px] text-[#6e6e73]">
            换背景 / 擦除 / 重绘 / 拆层
          </p>
        </div>
        <EcomIconToolbar className={cn(anyBusy && "pointer-events-none opacity-70")}>
          <EcomIconToolbarGroup label="新建">
            {onNewProject ? (
              <EcomIconButton
                label="新建项目"
                icon={Plus}
                disabled={anyBusy || saveBusy}
                onClick={() => void onNewProject()}
              />
            ) : null}
          </EcomIconToolbarGroup>

          <ToolbarDivider />

          <EcomIconToolbarGroup label="换背景">
            <EcomIconButton
              label="换背景"
              icon={Images}
              variant={toolMode === "bg-replace" ? "accent" : "default"}
              disabled={!canLocalEdit}
              onClick={() => setMode("bg-replace")}
            />
          </EcomIconToolbarGroup>

          <ToolbarDivider />

          <EcomIconToolbarGroup label="擦除重绘">
            <EcomIconButton
              label="擦除"
              icon={Eraser}
              variant={toolMode === "erase" ? "accent" : "default"}
              disabled={!canLocalEdit}
              onClick={() => setMode("erase")}
            />
            <EcomIconButton
              label="局部重绘"
              icon={Paintbrush}
              variant={toolMode === "retouch" ? "accent" : "default"}
              disabled={!canLocalEdit}
              onClick={() => setMode("retouch")}
            />
          </EcomIconToolbarGroup>

          <ToolbarDivider />

          <EcomIconToolbarGroup label="图片分层">
            {hasStack ? (
              <EcomIconButton
                label="图层编辑"
                icon={LayoutGrid}
                variant={toolMode === "layer-view" ? "accent" : "default"}
                disabled={!canUseTools}
                onClick={() => setMode("layer-view")}
              />
            ) : null}
            <EcomIconButton
              label={
                pendingBboxCount > 0
                  ? `框选拆分区域（${pendingBboxCount}）`
                  : "框选拆分区域"
              }
              icon={SquareDashed}
              variant={toolMode === "decompose-bbox" ? "accent" : "default"}
              disabled={!canDecomposeBbox}
              onClick={() => setMode("decompose-bbox")}
            />
            <EcomIconButton
              label="AI 图层分离"
              icon={Layers}
              variant="accent"
              busy={decomposeBusy}
              disabled={decomposeBusy || !hasPreview || anyBusy}
              onClick={() => void onDecompose()}
            />
            <EcomIconButton
              label="撤销上一框"
              icon={Undo2}
              disabled={!canDecomposeBbox || !hasBboxes || toolMode !== "decompose-bbox"}
              onClick={onUndoBbox}
            />
            <EcomIconButton
              label="清除全部框"
              icon={XCircle}
              disabled={!canDecomposeBbox || !hasBboxes || toolMode !== "decompose-bbox"}
              onClick={onClearBboxes}
            />
            {hasStack && onCancelLayerSession ? (
              <EcomIconButton
                label="取消分层"
                icon={UndoLayerIcon}
                disabled={anyBusy || decomposeBusy}
                onClick={() => void onCancelLayerSession()}
              />
            ) : null}
            <EcomIconButton
              label="预览成品"
              icon={Eye}
              busy={previewBusy}
              disabled={!hasStack || anyBusy}
              onClick={onPreviewExport}
            />
            <EcomIconButton
              label="导出 PNG"
              icon={Download}
              disabled={!hasStack || anyBusy}
              onClick={onExport}
            />
          </EcomIconToolbarGroup>

          <ToolbarDivider />

          <EcomIconToolbarGroup label="项目">
            {onSave ? (
              <EcomIconButton
                label="保存图片"
                icon={Save}
                busy={saveBusy}
                disabled={!canSave || anyBusy || saveBusy}
                onClick={() => void onSave()}
              />
            ) : null}
            <EcomIconButton
              label="删除全部"
              icon={Trash2}
              variant="destructive"
              disabled={anyBusy || (!hasPreview && !hasStack)}
              onClick={onReset}
            />
            {loadProjectList && onSelectProject ? (
              <EcomProjectListButton
                disabled={anyBusy || saveBusy}
                currentProjectId={currentProjectId}
                loadProjects={loadProjectList}
                onSelectProject={onSelectProject}
                title="图片分层 · 项目列表"
                emptyHint="还没有保存过的图片分层项目。"
              />
            ) : null}
            <EcomIconButton
              label="生成记录"
              icon={History}
              disabled={anyBusy}
              onClick={() => router.push(ECOM_GENERATION_RECORD_LIBRARY_PATH)}
            />
          </EcomIconToolbarGroup>
        </EcomIconToolbar>
      </div>
    </header>
  );
}
