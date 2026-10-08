"use client";

import type { GlobalAssetLibraryApiClient } from "@/docker-shared/global-asset-library/types";
import type { GlobalAssetPickItem } from "@/docker-shared/global-asset-library/types";
import type { AssetLibrarySection } from "@/docker-shared/global-asset-library/unified-asset-library-types";

import { CameraShotLibraryPanel } from "./camera-shot-library-panel";
import { DigitalHumanPlatformPanel } from "./digital-human-platform-panel";
import { hubSectionFixedCatalogKind } from "./platform-asset-hub-nav";
import type { PlatformAssetHubSection } from "./platform-asset-hub-types";
import { PlatformCatalogPanel } from "./platform-catalog-panel";
import { StyleLibraryGrid } from "@/components/canvas/style-library-grid";
import type { StyleLibraryPreset } from "@/lib/canvas/style-library/catalog";
import type { CameraShotPreset } from "@/lib/canvas/camera-shot-library/catalog";

const HUB_PREVIEW_Z = 2100;

export type AssetLibraryHubSubContentProps = {
  sub: PlatformAssetHubSection;
  platformOnly: boolean;
  catalogScope: Extract<AssetLibrarySection, "platform" | "shared">;
  api: GlobalAssetLibraryApiClient;
  maxSelect: number;
  catalogPickMode: boolean;
  onClose: () => void;
  onFinishCatalogPick: (items: GlobalAssetPickItem[], section: AssetLibrarySection) => void | Promise<void>;
  onPreviewCatalogItem: (item: GlobalAssetPickItem) => void;
  onInsertCatalogItem: (item: GlobalAssetPickItem) => void;
  onStyleSelect: (preset: StyleLibraryPreset) => void;
  onStylePreview: (preset: StyleLibraryPreset) => void;
  onCameraShotInsertToDock?: (preset: CameraShotPreset) => void;
};

export function AssetLibraryHubSubContent({
  sub,
  platformOnly,
  catalogScope,
  api,
  maxSelect,
  catalogPickMode,
  onClose,
  onFinishCatalogPick,
  onPreviewCatalogItem,
  onInsertCatalogItem,
  onStyleSelect,
  onStylePreview,
  onCameraShotInsertToDock,
}: AssetLibraryHubSubContentProps) {
  const catalogPickProps = catalogPickMode
    ? {
        onPick: async (items: GlobalAssetPickItem[]) => {
          await onFinishCatalogPick(items, catalogScope);
        },
        onCancel: onClose,
      }
    : { onPick: undefined, onCancel: undefined };

  const fixedKind = hubSectionFixedCatalogKind(sub);

  if (sub === "catalog") {
    return (
      <PlatformCatalogPanel
        api={api}
        catalogNav="hub-model"
        platformOnly={platformOnly}
        previewLightboxZIndex={HUB_PREVIEW_Z}
        maxSelect={maxSelect}
        onPreview={onPreviewCatalogItem}
        onInsert={onInsertCatalogItem}
        {...catalogPickProps}
      />
    );
  }

  if (fixedKind) {
    return (
      <PlatformCatalogPanel
        api={api}
        catalogNav="fixed-kind"
        fixedKind={fixedKind}
        platformOnly={platformOnly}
        previewLightboxZIndex={HUB_PREVIEW_Z}
        maxSelect={maxSelect}
        onPreview={onPreviewCatalogItem}
        onInsert={onInsertCatalogItem}
        {...catalogPickProps}
      />
    );
  }

  if (sub === "style") {
    return (
      <StyleLibraryGrid
        className="min-h-0 flex-1"
        filterClassName="px-0 pt-0"
        contentClassName="px-0 pb-1 pt-2"
        selectLabel="插入画布"
        onSelect={(p) => onStyleSelect(p)}
        onPreview={(p) => onStylePreview(p)}
        fixedFilter
        calmCards
      />
    );
  }

  if (sub === "camera-shot") {
    return (
      <CameraShotLibraryPanel onInsertToDock={onCameraShotInsertToDock} />
    );
  }

  if (sub === "digital-human") {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DigitalHumanPlatformPanel />
      </div>
    );
  }

  return null;
}
