"use client";

import { X } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import {
  CANVAS_TOOLBAR_SIDE_PANEL_OVERLAY_CLASS,
  canvasToolbarSidePanelAsideClass,
} from "@/lib/canvas/canvas-toolbar-side-panel";
import {
  ProjectAssetsPanelIcon,
} from "./unified-project-assets-view";
import {
  UnifiedProjectAssetsView,
  type UnifiedProjectAssetTab,
} from "./unified-project-assets-view";

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

  if (!open) return null;

  return (
    <div
      className={`${CANVAS_TOOLBAR_SIDE_PANEL_OVERLAY_CLASS} z-[60]`}
      onClick={onClose}
      role="presentation"
    >
      <aside
        className={canvasToolbarSidePanelAsideClass(
          "border-l border-cyan-400/15",
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="项目资产"
      >
        <header className="border-b border-cyan-400/15 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ProjectAssetsPanelIcon />
              <p className="text-sm font-medium">项目资产</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-[var(--canvas-muted)] hover:bg-white/5 hover:text-white"
              aria-label="关闭"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <UnifiedProjectAssetsView
            projectId={projectId}
            initialTab={initialTab}
            compact
            onInsertToCanvas={onInsertToCanvas}
          />
        </div>
      </aside>
    </div>
  );
}
