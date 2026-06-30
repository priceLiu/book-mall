import type { QrTemplateJson, QrTemplateListFilters } from "@/lib/quick-replica/qr-types";

/** 右栏瀑布流模板（OpenArt 图像库） */
export function isQrImageGalleryTemplate(t: Pick<QrTemplateJson, "id">): boolean {
  return t.id.startsWith("qr-image-gallery-");
}

/** 右栏瀑布流模板（OpenArt 角色库） */
export function isQrCharacterGalleryTemplate(t: Pick<QrTemplateJson, "id">): boolean {
  return t.id.startsWith("qr-character-gallery-");
}

/** 右栏瀑布流模板（OpenArt 场景库） */
export function isQrWorldGalleryTemplate(t: Pick<QrTemplateJson, "id">): boolean {
  return t.id.startsWith("qr-world-gallery-");
}

/** 右栏瀑布流模板（OpenArt 视频库） */
export function isQrVideoGalleryTemplate(t: Pick<QrTemplateJson, "id">): boolean {
  return t.id.startsWith("qr-video-gallery-");
}

/** 右栏瀑布流模板（OpenArt 运动同步库） */
export function isQrMotionSyncGalleryTemplate(t: Pick<QrTemplateJson, "id">): boolean {
  return t.id.startsWith("qr-motion-sync-gallery-");
}

/** 用户已产生作品（有 output）才混入分类模板瀑布流 */
export function isQrUserProducedTemplate(t: Pick<QrTemplateJson, "source" | "output">): boolean {
  return t.source === "user" && Boolean(t.output?.url?.trim());
}

/** 管理后台维护的公开运营模板（非内置 id 覆盖） */
export function isQrPlatformCatalogTemplate(t: Pick<QrTemplateJson, "source">): boolean {
  return t.source === "catalog";
}

export function isQrGalleryTemplate(t: Pick<QrTemplateJson, "id">): boolean {
  return (
    isQrImageGalleryTemplate(t) ||
    isQrCharacterGalleryTemplate(t) ||
    isQrWorldGalleryTemplate(t) ||
    isQrVideoGalleryTemplate(t) ||
    isQrMotionSyncGalleryTemplate(t)
  );
}

/** 中栏 kind 卡片占位，不进右栏模板区 */
export function isQrKindThumbBuiltin(t: Pick<QrTemplateJson, "id">): boolean {
  return (
    t.id.startsWith("builtin-image-") ||
    t.id.startsWith("builtin-character-") ||
    t.id.startsWith("builtin-world-") ||
    t.id.startsWith("builtin-video-") ||
    t.id.startsWith("builtin-audio-")
  );
}

export function filterBuiltinsForKindBrowse(templates: QrTemplateJson[]): QrTemplateJson[] {
  return templates.filter((t) => !isQrGalleryTemplate(t));
}

/** 右栏模板列表：排除 kind 占位；图像分类未选子类时只展示 gallery */
export function filterTemplatesForGallery(
  templates: QrTemplateJson[],
  filters: QrTemplateListFilters,
): QrTemplateJson[] {
  let items = templates.filter((t) => !isQrKindThumbBuiltin(t));

  const isMotionSyncBrowse =
    filters.kind === "motion-sync" || filters.toolKey === "motion-sync";

  if (filters.category === "image" && !filters.kind && (filters.scope ?? "all") === "all") {
    items = items.filter((t) => isQrImageGalleryTemplate(t) || isQrUserProducedTemplate(t));
  }

  if (filters.category === "character" && !filters.kind && (filters.scope ?? "all") === "all") {
    items = items.filter((t) => isQrCharacterGalleryTemplate(t) || isQrUserProducedTemplate(t));
  }

  if (filters.category === "world" && !filters.kind && (filters.scope ?? "all") === "all") {
    items = items.filter((t) => isQrWorldGalleryTemplate(t) || isQrUserProducedTemplate(t));
  }

  if (
    filters.category === "video" &&
    !filters.kind &&
    !isMotionSyncBrowse &&
    (filters.scope ?? "all") === "all"
  ) {
    items = items.filter((t) => isQrVideoGalleryTemplate(t) || isQrUserProducedTemplate(t));
  }

  if (
    filters.category === "video" &&
    isMotionSyncBrowse &&
    (filters.scope ?? "all") === "all"
  ) {
    items = items.filter(
      (t) =>
        isQrMotionSyncGalleryTemplate(t) ||
        isQrUserProducedTemplate(t) ||
        (isQrPlatformCatalogTemplate(t) && t.kind === "motion-sync"),
    );
  }

  if (
    filters.category === "video" &&
    filters.kind &&
    filters.kind !== "motion-sync" &&
    (filters.scope ?? "all") === "all"
  ) {
    items = items.filter(
      (t) =>
        isQrUserProducedTemplate(t) ||
        (isQrVideoGalleryTemplate(t) && t.kind === filters.kind),
    );
  }

  return items;
}
