"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Layers, LayoutGrid, X } from "lucide-react";

import { UnifiedProjectAssetsView } from "@/components/canvas/unified-project-assets-view";
import { StoryMediaPreviewModal } from "@/components/canvas/story-column-media-panel";
import { AssetLibraryHubSubContent } from "@/components/canvas/platform-asset-hub/asset-library-hub-sub-content";
import { ASSET_LIBRARY_HUB_SUB_NAV } from "@/components/canvas/platform-asset-hub/platform-asset-hub-nav";
import {
  platformCatalogPreviewUrl,
  platformCatalogPromptFirst,
} from "@/components/canvas/platform-asset-hub/platform-catalog-item-utils";
import type { PlatformAssetHubSection } from "@/components/canvas/platform-asset-hub/platform-asset-hub-types";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import type { UnifiedAssetLibraryDialogProps } from "@/docker-shared/global-asset-library/global-asset-library-provider";
import { sectionLabel } from "@/docker-shared/global-asset-library/open-asset-library-utils";
import type { GlobalAssetPickItem } from "@/docker-shared/global-asset-library/types";
import type { AssetLibrarySection } from "@/docker-shared/global-asset-library/unified-asset-library-types";
import { catalogItemToUnified } from "@/docker-shared/global-asset-library/unified-asset-library-types";
import { spawnCanvasNodesFromGlobalAssetPick } from "@/lib/canvas/spawn-global-asset-pick";
import { getCanvasSpawnProjectAssetActions } from "@/lib/canvas/open-canvas-asset-library";
import {
  detectCanvasEditionFromNodes,
  spawnProjectAssetAtViewportCenter,
} from "@/lib/canvas/spawn-project-asset-on-canvas";
import {
  spawnPro2StyleAssetFromPreset,
  spawnPro2StyleAssetLeftOfImageFromPreset,
} from "@/lib/canvas/pro2-spawn-style-asset";
import type { StyleLibraryPreset } from "@/lib/canvas/style-library/catalog";
import type { CameraShotPreset } from "@/lib/canvas/camera-shot-library/catalog";
import {
  CANVAS_MODAL_BACKDROP_CLASS,
  useModalBodyScrollLock,
  useModalEscapeClose,
} from "@/lib/canvas/use-modal-portal-effects";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  assetLibraryFloatingPanelSize,
  useCanvasFloatingPanelDrag,
} from "@/lib/canvas/use-canvas-floating-panel-drag";
import { cn } from "@/lib/utils";

const HUB_Z = 1190;
const HUB_PREVIEW_Z = 2100;
const HUB_SHELL_CLASS =
  "nodrag flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141414] shadow-2xl";

const TOP_SECTIONS: AssetLibrarySection[] = ["platform", "shared", "project"];

export function CanvasUnifiedAssetLibraryModal({
  open,
  api,
  options,
  onClose,
}: UnifiedAssetLibraryDialogProps) {
  const base = useBookMallBaseUrl();
  const title = options.title ?? "资产库";
  const maxSelect = Math.max(1, options.maxSelect ?? 9);
  const projectId = options.projectId ?? options.saveContext?.projectId ?? null;

  const [topSection, setTopSection] = useState<AssetLibrarySection>(
    options.defaultSection ?? "platform",
  );
  const [hubSub, setHubSub] = useState<PlatformAssetHubSection>("catalog");
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const styleLibImageNodeId = useCanvasStore((s) => s.pro2StyleLibImageNodeId);
  const platformAssetDockNodeId = useCanvasStore((s) => s.platformAssetDockNodeId);
  const getNodes = useCallback(() => useCanvasStore.getState().nodes, []);
  const getEdges = useCallback(() => useCanvasStore.getState().edges, []);

  const { pos, panelRef, onDragStart } = useCanvasFloatingPanelDrag(open);

  useModalBodyScrollLock(open);
  useModalEscapeClose(onClose, { active: open });

  useEffect(() => {
    if (!open) return;
    setTopSection(options.defaultSection ?? "platform");
    setHubSub("catalog");
  }, [open, options.defaultSection]);

  const pickUnifiedHandler = (
    options as typeof options & {
      onPickUnified?: (
        items: import("@/docker-shared/global-asset-library/unified-asset-library-types").UnifiedAssetPickItem[],
      ) => void | Promise<void>;
    }
  ).onPickUnified;

  const catalogScope: Extract<AssetLibrarySection, "platform" | "shared"> =
    topSection === "shared" ? "shared" : "platform";
  const platformOnly = topSection === "platform";

  const finishCatalogPick = useCallback(
    async (items: GlobalAssetPickItem[], section: AssetLibrarySection) => {
      const withMedia = items.filter(
        (i) => !platformCatalogPromptFirst(i) && i.ossUrl?.trim(),
      );
      if (pickUnifiedHandler && withMedia.length) {
        await pickUnifiedHandler(
          withMedia.map((i) => catalogItemToUnified(i, section)),
        );
      } else if (withMedia.length) {
        spawnCanvasNodesFromGlobalAssetPick(withMedia, {
          edition:
            detectCanvasEditionFromNodes(useCanvasStore.getState().nodes) === "sbv1"
              ? "sbv1"
              : "pro2",
          addNode,
          setNodes,
        });
      }
      onClose();
    },
    [addNode, onClose, pickUnifiedHandler, setNodes],
  );

  const insertCatalogItem = useCallback(
    (item: GlobalAssetPickItem) => {
      if (platformCatalogPromptFirst(item)) return;
      void finishCatalogPick([item], catalogScope);
    },
    [finishCatalogPick, catalogScope],
  );

  const previewCatalogItem = useCallback((item: GlobalAssetPickItem) => {
    const url = platformCatalogPreviewUrl(item);
    if (!url) return;
    setPreview({ url, title: item.title });
  }, []);

  const onStyleSelect = useCallback(
    (preset: StyleLibraryPreset) => {
      if (styleLibImageNodeId) {
        spawnPro2StyleAssetLeftOfImageFromPreset({
          preset,
          imageNodeId: styleLibImageNodeId,
          addNode,
          setNodes,
          setEdges,
          getNodes,
          getEdges,
          updateNodeData,
        });
      } else {
        spawnPro2StyleAssetFromPreset({
          preset,
          addNode,
          setNodes,
          setEdges,
          getNodes,
        });
      }
      onClose();
    },
    [
      styleLibImageNodeId,
      onClose,
      addNode,
      setNodes,
      setEdges,
      getNodes,
      getEdges,
      updateNodeData,
    ],
  );

  const onCameraShotInsertToDock = useCallback(
    (preset: CameraShotPreset) => {
      const nodeId = platformAssetDockNodeId;
      if (!nodeId) return;
      const nodes = useCanvasStore.getState().nodes;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const prev = String((node.data as { dockInput?: string }).dockInput ?? "");
      const token = `@<${preset.id}>`;
      const next = prev.trim() ? `${prev.trimEnd()} ${token} ` : `${token} `;
      updateNodeData(nodeId, { dockInput: next });
      onClose();
    },
    [platformAssetDockNodeId, onClose, updateNodeData],
  );

  const onInsertProjectAsset = useCallback(
    async (assetId: string) => {
      if (pickUnifiedHandler) {
        await pickUnifiedHandler([
          {
            id: assetId,
            title: "",
            ossUrl: "",
            section: "project",
            provenance: "projectAsset",
            insertMode: "projectAssetInsert",
          },
        ]);
        onClose();
        return;
      }
      if (!base?.trim()) return;
      await spawnProjectAssetAtViewportCenter({
        base,
        assetId,
        edition:
          detectCanvasEditionFromNodes(useCanvasStore.getState().nodes) === "sbv1"
            ? "sbv1"
            : "pro2",
        actions: getCanvasSpawnProjectAssetActions(),
      });
      onClose();
    },
    [base, onClose, pickUnifiedHandler],
  );

  if (!open || typeof document === "undefined" || !pos) return null;

  const catalogPickMode = Boolean(pickUnifiedHandler || options.mode === "pick");
  const panelSize = assetLibraryFloatingPanelSize();
  const showHubSubNav = topSection === "platform" || topSection === "shared";

  return createPortal(
    <>
      <div
        className={cn(CANVAS_MODAL_BACKDROP_CLASS, "fixed inset-0")}
        style={{ zIndex: HUB_Z }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          ref={panelRef}
          className={HUB_SHELL_CLASS}
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y,
            width: panelSize.w,
            height: panelSize.h,
            zIndex: HUB_Z + 1,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <header
            className="flex shrink-0 cursor-move select-none items-center justify-between border-b border-white/10 px-4 py-3"
            onMouseDown={onDragStart}
          >
            <div className="flex items-center gap-2">
              <Layers className="size-4 shrink-0 text-cyan-300" />
              <div>
                <h2 className="text-sm font-semibold text-white">{title}</h2>
                <p className="text-[10px] text-white/45">
                  平台资产 · 我的共用 · 本项目
                </p>
              </div>
            </div>
            <button
              type="button"
              className="cursor-pointer rounded-md p-1 text-white/50 hover:bg-white/5 hover:text-white"
              aria-label="关闭"
              data-no-drag
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </header>

          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-3 py-2">
            {TOP_SECTIONS.map((id) => (
              <button
                key={id}
                type="button"
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  topSection === id
                    ? "bg-cyan-500/20 text-cyan-100"
                    : "text-white/55 hover:bg-white/5 hover:text-white/85",
                )}
                onClick={() => setTopSection(id)}
              >
                {id === "platform" ? <LayoutGrid className="size-3.5" /> : null}
                {sectionLabel(id)}
              </button>
            ))}
          </nav>

          {showHubSubNav ? (
            <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-3 py-1.5">
              {ASSET_LIBRARY_HUB_SUB_NAV.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                    hubSub === id
                      ? "bg-white/10 text-white/90"
                      : "text-white/45 hover:bg-white/5 hover:text-white/75",
                  )}
                  onClick={() => setHubSub(id)}
                >
                  <Icon className="size-3" />
                  {label}
                </button>
              ))}
            </nav>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-2">
            {showHubSubNav ? (
              <AssetLibraryHubSubContent
                sub={hubSub}
                platformOnly={platformOnly}
                catalogScope={catalogScope}
                api={api}
                maxSelect={maxSelect}
                catalogPickMode={catalogPickMode}
                onClose={onClose}
                onFinishCatalogPick={finishCatalogPick}
                onPreviewCatalogItem={previewCatalogItem}
                onInsertCatalogItem={insertCatalogItem}
                onStyleSelect={onStyleSelect}
                onStylePreview={(p) =>
                  setPreview({ url: p.imageUrl, title: p.name })
                }
                onCameraShotInsertToDock={
                  platformAssetDockNodeId ? onCameraShotInsertToDock : undefined
                }
              />
            ) : null}

            {topSection === "project" ? (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <UnifiedProjectAssetsView
                  projectId={projectId}
                  compact
                  onInsertToCanvas={(id) => void onInsertProjectAsset(id)}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {preview ? (
        <StoryMediaPreviewModal
          url={preview.url}
          title={preview.title}
          stackZIndex={HUB_PREVIEW_Z}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>,
    document.body,
  );
}
