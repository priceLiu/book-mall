"use client";

import { useCallback, useEffect, useState } from "react";

import type { GlobalAssetPickItem } from "@/docker-shared/global-asset-library/types";
import { spawnCanvasNodesFromGlobalAssetPick } from "@/lib/canvas/spawn-global-asset-pick";
import { detectCanvasEditionFromNodes } from "@/lib/canvas/spawn-project-asset-on-canvas";
import { platformCatalogPreviewUrl, platformCatalogPromptFirst } from "./platform-catalog-item-utils";
import { createPortal } from "react-dom";
import { Clapperboard, LayoutGrid, Package, ScanFace, Sparkles, X } from "lucide-react";

import { StyleLibraryGrid } from "@/components/canvas/style-library-grid";
import { StoryMediaPreviewModal } from "@/components/canvas/story-column-media-panel";
import type { GlobalAssetLibraryApiClient } from "@/docker-shared/global-asset-library/types";
import { PlatformCatalogPanel } from "./platform-catalog-panel";
import {
  CANVAS_MODAL_BACKDROP_CLASS,
  useModalBodyScrollLock,
  useModalEscapeClose,
} from "@/lib/canvas/use-modal-portal-effects";
import type { StyleLibraryPreset } from "@/lib/canvas/style-library/catalog";
import {
  spawnPro2StyleAssetFromPreset,
  spawnPro2StyleAssetLeftOfImageFromPreset,
} from "@/lib/canvas/pro2-spawn-style-asset";
import { useCanvasStore } from "@/lib/canvas/store";
import type { PlatformAssetHubSection } from "./platform-asset-hub-types";
import { CameraShotLibraryPanel } from "./camera-shot-library-panel";
import { DigitalHumanPlatformPanel } from "./digital-human-platform-panel";
import type { CameraShotPreset } from "@/lib/canvas/camera-shot-library/catalog";
import { cn } from "@/lib/utils";

const HUB_Z = 1190;
/** 与风格库弹层一致 · 各分区共用固定外壳，避免切换 Tab 时尺寸跳动 */
const HUB_SHELL_CLASS =
  "nodrag flex h-[min(90vh,860px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141414] shadow-2xl";
const HUB_PREVIEW_Z = 2100;

const SECTIONS: Array<{
  id: PlatformAssetHubSection;
  label: string;
  icon: typeof Package;
}> = [
  { id: "catalog", label: "模特·素材", icon: Package },
  { id: "style", label: "风格", icon: Sparkles },
  { id: "camera-shot", label: "镜头描述", icon: Clapperboard },
  { id: "digital-human", label: "数字人", icon: ScanFace },
];

export type PlatformAssetHubModalProps = {
  open: boolean;
  onClose: () => void;
  api: GlobalAssetLibraryApiClient;
  initialSection?: PlatformAssetHubSection;
  /** 与双击画布 pick 模特一致 */
  catalogPick?: {
    maxSelect?: number;
    onPick: import("@/docker-shared/global-asset-library/types").OpenGlobalAssetLibraryOptions["onPick"];
  };
  onCameraShotInsertToDock?: (preset: CameraShotPreset) => void;
};

export function PlatformAssetHubModal({
  open,
  onClose,
  api,
  initialSection = "catalog",
  catalogPick,
  onCameraShotInsertToDock,
}: PlatformAssetHubModalProps) {
  const [section, setSection] = useState<PlatformAssetHubSection>(initialSection);
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  const styleLibImageNodeId = useCanvasStore((s) => s.pro2StyleLibImageNodeId);
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const getNodes = useCallback(() => useCanvasStore.getState().nodes, []);
  const getEdges = useCallback(() => useCanvasStore.getState().edges, []);

  const insertCatalogItem = useCallback(
    (item: GlobalAssetPickItem) => {
      if (platformCatalogPromptFirst(item)) return;
      const edition =
        detectCanvasEditionFromNodes(useCanvasStore.getState().nodes) === "sbv1"
          ? "sbv1"
          : "pro2";
      spawnCanvasNodesFromGlobalAssetPick([item], {
        edition,
        addNode,
        setNodes,
      });
      onClose();
    },
    [addNode, setNodes, onClose],
  );

  const previewCatalogItem = useCallback((item: GlobalAssetPickItem) => {
    const url = platformCatalogPreviewUrl(item);
    if (!url) return;
    setPreview({ url, title: item.title });
  }, []);

  useModalBodyScrollLock(open);
  useModalEscapeClose(onClose, { active: open });

  useEffect(() => {
    if (open) setSection(initialSection);
  }, [open, initialSection]);

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

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className={cn(CANVAS_MODAL_BACKDROP_CLASS, "z-[1190]")}
        style={{ zIndex: HUB_Z }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-label="平台资产库"
      >
        <div
          className={HUB_SHELL_CLASS}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <LayoutGrid className="size-4 text-cyan-300" />
              <div>
                <h2 className="text-sm font-semibold text-white">平台资产库</h2>
                <p className="text-[10px] text-white/45">
                  平台提供 · 选用后插入画布或写入 Dock（不进「我的资产」）
                </p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-md p-1 text-white/50 hover:bg-white/5 hover:text-white"
              aria-label="关闭"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </header>

          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-3 py-2">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  section === id
                    ? "bg-cyan-500/20 text-cyan-100"
                    : "text-white/55 hover:bg-white/5 hover:text-white/85",
                )}
                onClick={() => setSection(id)}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </nav>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-2">
            {section === "catalog" ? (
              <PlatformCatalogPanel
                api={api}
                previewLightboxZIndex={HUB_PREVIEW_Z}
                maxSelect={catalogPick?.maxSelect ?? 9}
                onPick={
                  catalogPick
                    ? async (items) => {
                        const withImage = items.filter(
                          (i) => !platformCatalogPromptFirst(i) && i.ossUrl?.trim(),
                        );
                        if (withImage.length > 0) {
                          await catalogPick.onPick(withImage);
                        }
                        onClose();
                      }
                    : undefined
                }
                onCancel={catalogPick ? onClose : undefined}
                onPreview={previewCatalogItem}
                onInsert={insertCatalogItem}
              />
            ) : null}
            {section === "style" ? (
              <StyleLibraryGrid
                className="min-h-0 flex-1"
                filterClassName="px-0 pt-0"
                contentClassName="px-0 pb-1 pt-2"
                selectLabel="插入画布"
                onSelect={(p) => onStyleSelect(p)}
                onPreview={(p) =>
                  setPreview({ url: p.imageUrl, title: p.name })
                }
                fixedFilter
                calmCards
              />
            ) : null}
            {section === "camera-shot" ? (
              <CameraShotLibraryPanel
                onInsertToDock={
                  onCameraShotInsertToDock
                    ? (preset) => {
                        onCameraShotInsertToDock(preset);
                        onClose();
                      }
                    : undefined
                }
              />
            ) : null}
            {section === "digital-human" ? (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <DigitalHumanPlatformPanel />
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
