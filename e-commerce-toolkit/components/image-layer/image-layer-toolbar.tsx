"use client";

import {
  Download,
  Eye,
  History,
  Layers,
  Plus,
  RotateCcw,
  Save,
  SquareDashed,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { EcomProjectListButton } from "@/components/layout/ecom-project-list-button";
import { EcomIconButton } from "@/components/ui/ecom-icon-button";
import { EcomIconToolbar, EcomIconToolbarGroup } from "@/components/ui/ecom-icon-toolbar";
import { ECOM_GENERATION_RECORD_LIBRARY_PATH } from "@/lib/ecom-generation-record-api";
import type { EcomProjectListItem } from "@/lib/ecom-project-list-types";

type Props = {
  projectTitle?: string | null;
  decomposeBusy: boolean;
  anyBusy: boolean;
  saveBusy?: boolean;
  hasPreview: boolean;
  hasStack: boolean;
  canSave: boolean;
  drawBboxMode: boolean;
  currentProjectId?: string | null;
  loadProjectList?: () => Promise<EcomProjectListItem[]>;
  onToggleDrawBbox: () => void;
  onDecompose: () => void;
  onSave?: () => void;
  onNewProject?: () => void;
  onSelectProject?: (id: string) => void | Promise<void>;
  onRemoveSource: () => void;
  onReset: () => void;
  previewBusy?: boolean;
  onPreviewExport: () => void;
  onExport: () => void;
};

export function ImageLayerToolbar({
  projectTitle,
  decomposeBusy,
  anyBusy,
  saveBusy,
  hasPreview,
  hasStack,
  canSave,
  drawBboxMode,
  currentProjectId,
  loadProjectList,
  onToggleDrawBbox,
  onDecompose,
  onSave,
  onNewProject,
  onSelectProject,
  onRemoveSource,
  onReset,
  previewBusy,
  onPreviewExport,
  onExport,
}: Props) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-20 border-b border-[#e8e8ed] bg-white px-5 py-3 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-[#1d1d1f]">
            {projectTitle?.trim() || "图片分层"}
          </h2>
          <p className="text-[11px] text-[#6e6e73]">
            上传后自动保存 · 先「预览成品」确认，再「导出 PNG」
          </p>
        </div>
        <EcomIconToolbar>
          <EcomIconToolbarGroup label="项目">
            {onNewProject ? (
              <EcomIconButton
                label="新建项目"
                icon={Plus}
                disabled={anyBusy || saveBusy}
                onClick={() => void onNewProject()}
              />
            ) : null}
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
            {onSave ? (
              <EcomIconButton
                label="保存"
                icon={Save}
                busy={saveBusy}
                disabled={!canSave || anyBusy || saveBusy}
                onClick={() => void onSave()}
              />
            ) : null}
            <EcomIconButton
              label="生成记录"
              icon={History}
              disabled={anyBusy}
              onClick={() => router.push(ECOM_GENERATION_RECORD_LIBRARY_PATH)}
            />
          </EcomIconToolbarGroup>
          <EcomIconToolbarGroup label="拆分">
            <EcomIconButton
              label="绘制拆分框"
              icon={SquareDashed}
              variant={drawBboxMode ? "accent" : "default"}
              disabled={!hasPreview || anyBusy || hasStack}
              onClick={onToggleDrawBbox}
            />
            <EcomIconButton
              label="AI 图层分离"
              icon={Layers}
              variant="accent"
              busy={decomposeBusy}
              disabled={decomposeBusy || !hasPreview}
              onClick={onDecompose}
            />
          </EcomIconToolbarGroup>
          <EcomIconToolbarGroup label="工作区">
            {hasPreview ? (
              <EcomIconButton
                label="删除图片"
                icon={Trash2}
                variant="destructive"
                disabled={anyBusy}
                onClick={onRemoveSource}
              />
            ) : null}
            <EcomIconButton
              label="重置"
              icon={RotateCcw}
              disabled={anyBusy || (!hasPreview && !hasStack)}
              onClick={onReset}
            />
          </EcomIconToolbarGroup>
          <EcomIconToolbarGroup label="导出">
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
        </EcomIconToolbar>
      </div>
    </header>
  );
}
