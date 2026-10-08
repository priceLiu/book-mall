import type { LucideIcon } from "lucide-react";
import {
  Box,
  Clapperboard,
  Film,
  Image as ImageIcon,
  Mic,
  Mountain,
  Package,
  ScanFace,
  Shirt,
  Sparkles,
  Link2,
} from "lucide-react";

import type { GlobalAssetCatalogKind } from "@/docker-shared/global-asset-library/types";
import type { PlatformAssetHubSection } from "./platform-asset-hub-types";

export type AssetHubSubNavItem = {
  id: PlatformAssetHubSection;
  label: string;
  icon: LucideIcon;
  /** catalog 单 kind 二级页；无则为特殊面板或模特·素材 */
  fixedCatalogKind?: GlobalAssetCatalogKind;
};

/** 平台资产 / 我的共用 · 共用二级 Tab（仅数据 scope 不同） */
export const ASSET_LIBRARY_HUB_SUB_NAV: AssetHubSubNavItem[] = [
  { id: "catalog", label: "模特·素材", icon: Package },
  { id: "garment", label: "服装", icon: Shirt, fixedCatalogKind: "garment" },
  { id: "scene", label: "场景", icon: Mountain, fixedCatalogKind: "scene" },
  { id: "prop", label: "道具", icon: Box, fixedCatalogKind: "prop" },
  { id: "reference", label: "参考图", icon: Link2, fixedCatalogKind: "reference" },
  {
    id: "storyboard-image",
    label: "分镜图",
    icon: ImageIcon,
    fixedCatalogKind: "storyboard-image",
  },
  { id: "audio", label: "音频", icon: Mic, fixedCatalogKind: "audio" },
  {
    id: "storyboard-video",
    label: "分镜视频",
    icon: Film,
    fixedCatalogKind: "storyboard-video",
  },
  { id: "style", label: "风格", icon: Sparkles },
  { id: "camera-shot", label: "镜头描述", icon: Clapperboard },
  { id: "digital-human", label: "数字人", icon: ScanFace },
];

export function hubSectionFixedCatalogKind(
  section: PlatformAssetHubSection,
): GlobalAssetCatalogKind | null {
  const row = ASSET_LIBRARY_HUB_SUB_NAV.find((n) => n.id === section);
  return row?.fixedCatalogKind ?? null;
}
