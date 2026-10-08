import type { GlobalAssetCatalogKind } from "@/lib/ecom/ecom-global-asset-catalog";

/** 入库 UI · 与项目资产类型命名对齐（图片入口） */
export const PLATFORM_CATALOG_SAVE_TYPE_OPTIONS: Array<{
  id: GlobalAssetCatalogKind;
  label: string;
  /** 当前「从图片入库」是否支持 */
  imageImport: boolean;
}> = [
  { id: "character", label: "角色", imageImport: true },
  { id: "prop", label: "道具", imageImport: true },
  { id: "scene", label: "场景", imageImport: true },
  { id: "style", label: "风格", imageImport: true },
  { id: "audio", label: "音频", imageImport: false },
  { id: "storyboard-image", label: "分镜图", imageImport: true },
  { id: "storyboard-video", label: "分镜视频", imageImport: false },
  { id: "reference", label: "参考图", imageImport: true },
  { id: "pose", label: "姿势", imageImport: true },
  { id: "avatar", label: "模特头像", imageImport: true },
  { id: "full-body", label: "全身模特", imageImport: true },
  { id: "garment", label: "服装", imageImport: true },
];

export function catalogKindUsesModelLibraryGender(
  kind: GlobalAssetCatalogKind,
): boolean {
  return (
    kind === "pose" ||
    kind === "avatar" ||
    kind === "garment" ||
    kind === "full-body" ||
    kind === "character"
  );
}

export function catalogKindToGarmentKind(
  kind: GlobalAssetCatalogKind,
): string | null {
  if (kind === "garment") return "flat";
  if (kind === "reference") return "reference";
  if (kind === "prop") return "prop";
  if (kind === "storyboard-image") return "storyboard-image";
  if (kind === "storyboard-video") return "storyboard-video";
  return null;
}

export function isGarmentBackedCatalogKind(kind: GlobalAssetCatalogKind): boolean {
  return catalogKindToGarmentKind(kind) !== null;
}

export function isCharacterCatalogKind(kind: GlobalAssetCatalogKind): boolean {
  return kind === "character";
}

export function isAvatarCatalogKind(kind: GlobalAssetCatalogKind): boolean {
  return kind === "avatar";
}
