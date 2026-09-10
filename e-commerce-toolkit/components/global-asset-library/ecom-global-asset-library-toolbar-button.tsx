"use client";

import { Package } from "lucide-react";

import { EcomIconButton } from "@/components/ui/ecom-icon-button";
import type { GlobalAssetCatalogKind, GlobalAssetPickItem } from "@/docker-shared/global-asset-library";
import { useGlobalAssetLibrary } from "@/docker-shared/global-asset-library";

type Props = {
  title?: string;
  defaultCatalog?: GlobalAssetCatalogKind;
  maxSelect?: number;
  onPick?: (items: GlobalAssetPickItem[]) => void;
};

/** Studio 顶栏 · 打开 GALD 选用素材 */
export function EcomGlobalAssetLibraryToolbarButton({
  title = "全局资产库",
  defaultCatalog = "full-body",
  maxSelect = 1,
  onPick,
}: Props) {
  const { openGlobalAssetLibrary } = useGlobalAssetLibrary();

  return (
    <EcomIconButton
      label={title}
      icon={Package}
      onClick={() => {
        openGlobalAssetLibrary({
          mode: "pick",
          defaultTab: "catalog",
          defaultCatalog,
          maxSelect,
          onPick,
        });
      }}
    />
  );
}
