import { GALD_OFFICIAL_BADGE_BG, GALD_OFFICIAL_BADGE_CLASS } from "./theme";
import type { GlobalAssetPickItem } from "./types";

/** 资产库列表 · 仅平台素材展示角标 */
export function shouldShowCatalogPlatformBadge(item: GlobalAssetPickItem): boolean {
  if (item.promptOnly) return false;
  if (item.catalogKind === "works") return false;
  return item.scope === "platform";
}

/** 画布 / 缩略图 · 纯 UI 角标（不写入 OSS） */
export function GlobalAssetCatalogBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`${GALD_OFFICIAL_BADGE_CLASS} ${className}`}
      style={{ backgroundColor: GALD_OFFICIAL_BADGE_BG }}
      aria-hidden
    >
      官方
    </span>
  );
}
