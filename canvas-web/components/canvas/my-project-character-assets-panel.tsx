"use client";

import { X } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import {
  ProjectAssetsPanelIcon,
  ProjectAssetsView,
  type ProjectAssetTab,
} from "./project-assets-view";

export function MyProjectCharacterAssetsPanel({
  open,
  onClose,
  initialTab = "character",
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: ProjectAssetTab;
}) {
  const projectId = useCanvasStore((s) => s.projectId);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-black/45"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className="flex h-full w-full max-w-md flex-col border-l border-cyan-400/15 bg-[var(--canvas-surface)] text-white shadow-2xl"
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
          <ProjectAssetsView
            projectId={projectId}
            initialTab={initialTab}
            compact
          />
        </div>
      </aside>
    </div>
  );
}
