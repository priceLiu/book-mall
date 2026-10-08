import type { GlobalAssetCatalogKind } from "./types";

/** 保存平台资产库 · 类型下拉（与项目资产命名对齐） */
export const PLATFORM_CATALOG_SAVE_TYPE_OPTIONS: Array<{
  id: GlobalAssetCatalogKind;
  label: string;
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

export function platformCatalogSaveTypeLabel(kind: GlobalAssetCatalogKind): string {
  return PLATFORM_CATALOG_SAVE_TYPE_OPTIONS.find((o) => o.id === kind)?.label ?? kind;
}

export function catalogKindSupportsImageImport(kind: GlobalAssetCatalogKind): boolean {
  return PLATFORM_CATALOG_SAVE_TYPE_OPTIONS.find((o) => o.id === kind)?.imageImport ?? false;
}

/** 模特·素材 Hub 子区（不含场景；场景与风格 / 镜头 / 数字人同级） */
/** 模特·素材 · 三级（服装已升为 Hub 二级 Tab） */
const PLATFORM_HUB_MODEL_CATALOG_KINDS = new Set<GlobalAssetCatalogKind>([
  "full-body",
  "avatar",
  "pose",
]);

export function platformHubModelCatalogNav(): Array<{
  id: GlobalAssetCatalogKind;
  label: string;
}> {
  return PLATFORM_CATALOG_SAVE_TYPE_OPTIONS.filter((o) =>
    PLATFORM_HUB_MODEL_CATALOG_KINDS.has(o.id),
  ).map((o) => ({ id: o.id, label: o.label }));
}

/** 选用侧栏 · 与保存类型对齐（含场景，与角色/道具等同级） */
export function platformCatalogPickNav(): Array<{
  id: GlobalAssetCatalogKind;
  label: string;
}> {
  return PLATFORM_CATALOG_SAVE_TYPE_OPTIONS.filter((o) => o.imageImport).map((o) => ({
    id: o.id,
    label: o.label,
  }));
}
