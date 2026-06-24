"use client";

import { X } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import { CanvasToolbarSidePanelShell } from "@/components/canvas/canvas-toolbar-side-panel-shell";
import { ProjectAssetsPanelIcon } from "./unified-project-assets-view";
import {
  UnifiedProjectAssetsView,
  type UnifiedProjectAssetTab,
} from "./unified-project-assets-view";
import {
  CANVAS_PANEL_SHELL_BODY_CLASS,
  CANVAS_PANEL_SHELL_HEADER_CLASS,
} from "@/lib/canvas/canvas-chrome-semantics";

export function MyProjectCharacterAssetsPanel({
  open,
  onClose,
  initialTab = "all" as const,
  onInsertToCanvas,
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: UnifiedProjectAssetTab;
  onInsertToCanvas?: (assetId: string) => void;
}) {
  const projectId = useCanvasStore((s) => s.projectId);

  return (
    <CanvasToolbarSidePanelShell
      open={open}
      onClose={onClose}
      ariaLabel="项目资产"
    >
      <header className={CANVAS_PANEL_SHELL_HEADER_CLASS}>
        <div className="flex items-center gap-2">
          <ProjectAssetsPanelIcon />
          <div>
            <p className="text-sm font-medium">项目资产</p>
            <p className="text-[10px] text-white/45">
              角色、场景、分镜等媒体资产
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-[var(--canvas-muted)] hover:bg-white/5 hover:text-white"
          aria-label="关闭"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className={CANVAS_PANEL_SHELL_BODY_CLASS}>
        <UnifiedProjectAssetsView
          projectId={projectId}
          initialTab={initialTab}
          compact
          onInsertToCanvas={onInsertToCanvas}
        />
      </div>
    </CanvasToolbarSidePanelShell>
  );
}
